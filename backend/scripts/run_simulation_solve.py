import os
import sys
import json
import time
from typing import List, Dict, Tuple

backend_dir = os.path.dirname(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.models.domain import Base, Institution, AcademicWorkspace, FacultyProfile, Section, SubjectAllocation, AllocationComponent, Subject
from app.models.timetable import TimetableConfiguration, TimetableRoom, TimetableFacultyAvailability, SynchronizedGroup, SynchronizedGroupMember, TeachingSession, AvailabilityStatusEnum, TimetableRun, TimetableStatusEnum, TimetablePeriod, TimetableWorkingDay, TimetableSectionAvailability, TimetableRoomAvailability

# Append KAIROS safely to the end of sys.path AFTER importing from backend app
sys.path.append(os.path.join(backend_dir, 'vendor', 'KAIROS'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.timetabling.model import Instructor, Section as KSection, Block, Room, Assignment
from src.timetabling.config import Config
from src.timetabling.pipeline import run_pipeline

def erp_period_to_solver_slot(period: int) -> int:
    """
    SRM P1 -> 0
    SRM P2 -> 1
    SRM P3 -> 2
    BREAK -> (no slot, unmapped)
    SRM P4 -> 3
    SRM P5 -> 4
    SRM P6 -> 5
    """
    return period - 1

def solver_slot_to_erp_period(slot: int) -> int:
    return slot + 1

def run_simulation(db_url="sqlite:///simulation.db", seed_db=True):
    if "supabase" in db_url.lower() and "production" in db_url.lower():
        print("ERROR: Refusing to touch production database.")
        sys.exit(1)

    # First, seed the data
    if seed_db:
        from scripts.seed_timetable_simulation import seed_simulation
        seed_simulation(db_url)
    
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    print("\n--- EXTRACTING ERP MODELS ---")
    erp_rooms = db.query(TimetableRoom).filter(TimetableRoom.active == True).all()
    erp_faculty = db.query(FacultyProfile).all()
    erp_sections = db.query(Section).filter(Section.is_active == True).all()
    erp_sessions = db.query(TeachingSession).all()
    erp_faculty_avail = db.query(TimetableFacultyAvailability).all()

    # 1. Verification
    expected_duration = 0
    for alloc in db.query(SubjectAllocation).all():
        for comp in alloc.components:
            expected_duration += (comp.theory_hours + comp.practical_hours)
    
    actual_duration = sum([ts.duration_in_periods for ts in erp_sessions])
    
    print(f"Expected Duration (hrs): {expected_duration}")
    print(f"Scheduled Duration (sessions): {actual_duration}")
    if expected_duration != actual_duration:
        print("Discrepancy in durations! Aborting.")
        sys.exit(1)

    print("\n--- MAPPING TO KAIROS ---")
    k_rooms: List[Room] = []
    for r in erp_rooms:
        r_type = "normal"
        if r.room_type == "LAB": r_type = "lab"
        elif r.room_type == "PC_LAB": r_type = "pc"
        elif r.room_type == "STUDIO": r_type = "studio"
        
        k_rooms.append(Room(
            room=str(r.id),
            cap=r.capacity,
            is_lab=(r_type != "normal"),
            is_physical=True,
            type=r_type
        ))

    k_instructors: List[Instructor] = []
    for f in erp_faculty:
        k_instructors.append(Instructor(
            staff_id=str(f.id),
            name=f.name,
            is_staff=True,
            home_dept=str(f.home_department_id)
        ))

    # KAIROS DAYS map
    kairos_day_map = {0: "Mo", 1: "Tu", 2: "We", 3: "Th", 4: "Fr", 5: "Sa", 6: "Su"}

    erp_working_days = db.query(TimetableWorkingDay).filter(TimetableWorkingDay.active == True).all()
    if erp_working_days:
        active_days = tuple(kairos_day_map[wd.day_index] for wd in erp_working_days)
    else:
        active_days = ("Mo", "Tu", "We", "Th", "Fr")

    # KAIROS Config
    k_config = Config(
        horizon_start=0,
        horizon_end=6,  # 0, 1, 2, 3, 4, 5
        undergrad_end=6,
        saturday_enabled=False,
        solve_time_limit_s=15.0,
        active_days=active_days
    )

    # Blackouts from Availability
    blackouts = []
    for avail in erp_faculty_avail:
        if avail.status == AvailabilityStatusEnum.UNAVAILABLE:
            blackouts.append((str(avail.faculty_id), kairos_day_map[avail.day_index], erp_period_to_solver_slot(avail.period_number)))
    k_config.instr_unavailable = frozenset(blackouts)

    erp_section_avail = db.query(TimetableSectionAvailability).all()
    sec_blackouts = []
    for avail in erp_section_avail:
        if avail.status == AvailabilityStatusEnum.UNAVAILABLE:
            sec_blackouts.append((str(avail.section_id), kairos_day_map[avail.day_index], erp_period_to_solver_slot(avail.period_number)))
    k_config.section_unavailable = frozenset(sec_blackouts)

    erp_room_avail = db.query(TimetableRoomAvailability).all()
    room_blackouts = []
    for avail in erp_room_avail:
        if avail.status == AvailabilityStatusEnum.UNAVAILABLE:
            room_blackouts.append((str(avail.room_id), kairos_day_map[avail.day_index], erp_period_to_solver_slot(avail.period_number)))
    k_config.room_unavailable = frozenset(room_blackouts)

    # Mapping TeachingSessions to Sections and Blocks
    # In KAIROS, a Section represents a cohort taking a course, and Blocks are the periods.
    k_sections: List[KSection] = []
    
    # We group teaching sessions by Section and Subject (or Allocation)
    from collections import defaultdict
    session_groups = defaultdict(list)
    for ts in erp_sessions:
        session_groups[(ts.section_id, ts.allocation_id)].append(ts)

    print("[TRACE] Calculating valid starts", flush=True)
    # Fetch periods to determine valid contiguity
    erp_periods = db.query(TimetablePeriod).order_by(TimetablePeriod.period_number).all()
    # Find contiguous periods. Periods are contiguous if end_time == next.start_time
    contiguous_slots = []
    for i in range(len(erp_periods)):
        contig = [erp_period_to_solver_slot(erp_periods[i].period_number)]
        curr = erp_periods[i]
        for j in range(i+1, len(erp_periods)):
            next_p = erp_periods[j]
            if curr.end_time == next_p.start_time:
                contig.append(erp_period_to_solver_slot(next_p.period_number))
                curr = next_p
            else:
                break
        contiguous_slots.append(contig)

    def get_valid_starts_for_length(length: int) -> frozenset:
        valid = set()
        for contig in contiguous_slots:
            if len(contig) >= length:
                valid.add(contig[0])
        return frozenset(valid)

    valid_starts_cache = {}
    
    # ---------------------------------------------------------
    # TEST SUITE: Break Contiguity Validation
    # ---------------------------------------------------------
    print("\n--- CONTIGUITY TESTS ---", flush=True)
    v1 = get_valid_starts_for_length(1)
    v2 = get_valid_starts_for_length(2)
    v3 = get_valid_starts_for_length(3)
    print(f"Test 1: P1+P2 duration-2 accepted (slot 0 in v2): {0 in v2}", flush=True)
    print(f"Test 2: P2+P3 duration-2 accepted (slot 1 in v2): {1 in v2}", flush=True)
    print(f"Test 3: P3+P4 duration-2 rejected (slot 2 NOT in v2): {2 not in v2}", flush=True)
    print(f"Test 4: P4+P5 duration-2 accepted (slot 3 in v2): {3 in v2}", flush=True)
    print(f"Test 5: P5+P6 duration-2 accepted (slot 4 in v2): {4 in v2}", flush=True)
    print(f"Test 6: one-period P3 session accepted (slot 2 in v1): {2 in v1}", flush=True)
    print(f"Test 7: duration-3 block cannot cross break (slot 1 and 2 NOT in v3): {1 not in v3 and 2 not in v3}", flush=True)
    print(f"Test 8: adapter dynamically derived from {len(erp_periods)} periods.", flush=True)
    print("------------------------\n", flush=True)

    # Map ERP section to all its KAIROS section_ids
    erp_sec_to_kairos_sec = defaultdict(list)
    for (s_id, a_id) in session_groups.keys():
        erp_sec_to_kairos_sec[s_id].append(str(s_id) + "_" + str(a_id))

    sync_members = db.query(SynchronizedGroupMember).all()
    ts_to_extra_kairos_sections = defaultdict(set)
    sync_group_to_ts = defaultdict(list)
    
    for sgm in sync_members:
        if sgm.teaching_session_id not in sync_group_to_ts[sgm.synchronized_group_id]:
            sync_group_to_ts[sgm.synchronized_group_id].append(sgm.teaching_session_id)
            
        ts = db.query(TeachingSession).get(sgm.teaching_session_id)
        if sgm.section_id and sgm.section_id != ts.section_id:
            for k_sec in erp_sec_to_kairos_sec[sgm.section_id]:
                ts_to_extra_kairos_sections[ts.id].add(k_sec)
                
    valid_sync_groups = []
    for sg_id, ts_list in sync_group_to_ts.items():
        durations = set(db.query(TeachingSession).get(ts_id).duration_in_periods for ts_id in ts_list)
        if len(durations) > 1:
            print(f"[ERROR] SynchronizedGroup {sg_id} rejected! Mismatched durations: {durations}")
            # Reject the synchronized group as invalid input
            continue
        valid_sync_groups.append(tuple(str(ts_id) for ts_id in ts_list))

    k_config.synchronized_blocks = tuple(valid_sync_groups)

    print("[TRACE] Mapping sessions to blocks", flush=True)
    for (sec_id, alloc_id), sessions in session_groups.items():
        erp_section = db.query(Section).get(sec_id)
        alloc = db.query(SubjectAllocation).get(alloc_id)
        subj = db.query(Subject).get(alloc.subject_id) if alloc.subject_id else None
        subj_name = subj.course_name if subj else "Unknown"
        k_blocks: List[Block] = []
        instr_ids = set()
        needs_lab = False
        lab_type_needed = ""
        
        for i, ts in enumerate(sessions):
            kind = "theory" if ts.teaching_type == "THEORY" else "lab"
            if kind == "lab":
                needs_lab = True
                lab_type_needed = "pc" # Simplify for mock
                
            length = ts.duration_in_periods
            if length not in valid_starts_cache:
                valid_starts_cache[length] = get_valid_starts_for_length(length)

            k_blocks.append(Block(
                block_id=str(ts.id),
                section_id=str(sec_id) + "_" + str(alloc_id),
                kind=kind,
                length=length,
                needs_lab=(kind == "lab"),
                valid_start_slots=valid_starts_cache[length],
                extra_section_ids=tuple(ts_to_extra_kairos_sections[ts.id])
            ))
            instr_ids.add(str(ts.faculty_id))
            
        max_students = erp_section.student_strength
        for ts in sessions:
            involved = [ts.section_id]
            sgms = [sgm for sgm in sync_members if sgm.teaching_session_id == ts.id]
            for sgm in sgms:
                if sgm.section_id and sgm.section_id not in involved:
                    involved.append(sgm.section_id)
            ts_students = sum(db.query(Section).get(sec).student_strength for sec in involved)
            if ts_students > max_students:
                max_students = ts_students
                
        k_sections.append(KSection(
            section_id=str(sec_id) + "_" + str(alloc_id),
            period="2026-27",
            code=subj_name,
            name=subj_name,
            level=1,
            dept_code="CS",
            department="CS",
            cohort_key=str(sec_id),
            instructor_ids=list(instr_ids),
            students=max_students,
            T=sum(b.length for b in k_blocks if b.kind=="theory"),
            P=sum(b.length for b in k_blocks if b.kind=="lab"),
            L=sum(b.length for b in k_blocks if b.kind=="lab"),
            Cr=3,
            category="Core",
            blocks=k_blocks,
            requires_lab_room=needs_lab,
            required_room_type=lab_type_needed if needs_lab else ""
        ))

    print("\n--- RUNNING SOLVER ---")
    start_time = time.time()
    
    # KAIROS pipeline expects these inputs
    # signature: run_pipeline(period, sections, rooms: Dict, instructors: Dict, config, solver="auto", ...)
    
    room_dict = {r.room: r for r in k_rooms}
    instructor_dict = {i.staff_id: i for i in k_instructors}
    
    print("\n[DEBUG] Rooms:")
    for r in k_rooms:
        print(f"  {r.room} (type={r.type}, cap={r.cap}, is_lab={r.is_lab})")
    
    print("\n[DEBUG] Sections:")
    for s in k_sections:
        print(f"  {s.section_id} (students={s.students}, req_lab={s.requires_lab_room}, req_rt={s.required_room_type})")
        for b in s.blocks:
            print(f"    Block {b.block_id}: len={b.length} needs_lab={b.needs_lab}")
    
    try:
        from src.timetabling.pipeline import run_pipeline
        
        res = run_pipeline("2026-27", k_sections, room_dict, instructor_dict, k_config, solver="cpsat")
        
        assignments = res.assignments
        status = res.stats.get("status", "OPTIMAL")
        wall_time = time.time() - start_time
    except Exception as e:
        import traceback
        traceback.print_exc()
        status = "ERROR"
        assignments = []
        wall_time = time.time() - start_time
        print(f"Solver error: {e}")

    print(f"Status: {status}")
    print(f"Wall time: {wall_time:.2f}s")
    
    num_blocks = sum(len(s.blocks) for s in k_sections)
    print(f"Blocks submitted: {num_blocks}")
    print(f"Blocks placed: {len(assignments)}")
    print(f"Blocks unplaced: {num_blocks - len(assignments)}")

    print("\n--- ERP VALIDATOR ---")
    violations = []
    
    # Construct mappings for quick check
    assigned_faculty = defaultdict(list)
    assigned_rooms = defaultdict(list)
    assigned_sections = defaultdict(list)
    
    # Mapped assignments
    for a in assignments:
        erp_period = solver_slot_to_erp_period(a.start)
        block = next((b for s in k_sections for b in s.blocks if b.block_id == a.block_id), None)
        erp_ts = db.query(TeachingSession).get(int(a.block_id))
        
        for slot_idx in range(a.start, a.end):
            erp_p = solver_slot_to_erp_period(slot_idx)
            
            # Faculty overlap check
            if erp_p in assigned_faculty[(erp_ts.faculty_id, a.day)]:
                violations.append(f"Faculty {erp_ts.faculty_id} double booked on {a.day} P{erp_p}")
            assigned_faculty[(erp_ts.faculty_id, a.day)].append(erp_p)
            
            # Room overlap check
            if erp_p in assigned_rooms[(a.room, a.day)]:
                violations.append(f"Room {a.room} double booked on {a.day} P{erp_p}")
            assigned_rooms[(a.room, a.day)].append(erp_p)
            
            # Section overlap check
            # Determine all sections involved (including mixed section members)
            involved_sections = [erp_ts.section_id]
            sgms = [sgm for sgm in sync_members if sgm.teaching_session_id == erp_ts.id]
            for sgm in sgms:
                if sgm.section_id and sgm.section_id not in involved_sections:
                    involved_sections.append(sgm.section_id)
            
            for inv_sec in involved_sections:
                if erp_p in assigned_sections[(inv_sec, a.day)]:
                    violations.append(f"Section {inv_sec} double booked on {a.day} P{erp_p}")
                assigned_sections[(inv_sec, a.day)].append(erp_p)
            
            # Break check
            # For a multi-period session, if we are at slot_idx > a.start,
            # we ensure that (slot_idx-1) and slot_idx are contiguous
            if slot_idx > a.start:
                prev_p = solver_slot_to_erp_period(slot_idx - 1)
                # Check if prev_p and erp_p are contiguous in erp_periods
                p1_obj = next((p for p in erp_periods if p.period_number == prev_p), None)
                p2_obj = next((p for p in erp_periods if p.period_number == erp_p), None)
                if p1_obj and p2_obj and p1_obj.end_time != p2_obj.start_time:
                    violations.append(f"Block {a.block_id} crosses non-contiguous boundary between P{prev_p} and P{erp_p}")

            # Availability check - Faculty
            for avail in erp_faculty_avail:
                if str(avail.faculty_id) == str(erp_ts.faculty_id) and avail.period_number == erp_p and avail.status == AvailabilityStatusEnum.UNAVAILABLE:
                    if a.day == kairos_day_map.get(avail.day_index, ""):
                        violations.append(f"Faculty {erp_ts.faculty_id} placed during UNAVAILABLE slot {a.day} P{erp_p}")
            
            # Availability check - Section
            for inv_sec in involved_sections:
                for avail in erp_section_avail:
                    if str(avail.section_id) == str(inv_sec) and avail.period_number == erp_p and avail.status == AvailabilityStatusEnum.UNAVAILABLE:
                        if a.day == kairos_day_map.get(avail.day_index, ""):
                            violations.append(f"Section {inv_sec} placed during UNAVAILABLE slot {a.day} P{erp_p}")

            # Availability check - Room
            for avail in erp_room_avail:
                if str(avail.room_id) == a.room and avail.period_number == erp_p and avail.status == AvailabilityStatusEnum.UNAVAILABLE:
                    if a.day == kairos_day_map.get(avail.day_index, ""):
                        violations.append(f"Room {a.room} placed during UNAVAILABLE slot {a.day} P{erp_p}")

        # Room Capacity and Type Checks
        erp_room = next((r for r in erp_rooms if str(r.id) == a.room), None)
        if erp_room:
            erp_section = db.query(Section).get(erp_ts.section_id)
            # Student strength might come from multiple sections in mixed section scenario
            total_students = sum(db.query(Section).get(sec).student_strength for sec in involved_sections)
            if erp_room.capacity < total_students:
                violations.append(f"Room {a.room} capacity {erp_room.capacity} is less than required {total_students} for TS {erp_ts.id}")
            
            if erp_ts.teaching_type == "LAB" and erp_room.room_type not in ("LAB", "PC_LAB", "STUDIO"):
                violations.append(f"TS {erp_ts.id} requires LAB room but assigned to {erp_room.room_type}")
            if erp_ts.teaching_type == "THEORY" and erp_room.room_type not in ("CLASSROOM", "THEORY"):
                violations.append(f"TS {erp_ts.id} requires THEORY room but assigned to {erp_room.room_type}")
        else:
            violations.append(f"Invalid room ID {a.room} assigned")
    for sg_id, ts_list in sync_group_to_ts.items():
        if not ts_list:
            continue
        # Find all assignments for these TSs
        sg_assignments = [a for a in assignments if int(a.block_id) in ts_list]
        if len(sg_assignments) != len(ts_list):
            violations.append(f"Sync Group {sg_id} is missing assignments. Expected {len(ts_list)}, found {len(sg_assignments)}")
            continue
        first_a = sg_assignments[0]
        for a in sg_assignments[1:]:
            if a.day != first_a.day or a.start != first_a.start or a.end != first_a.end:
                violations.append(f"Sync Group {sg_id} not synchronized: block {first_a.block_id} at {first_a.day} P{first_a.start} vs block {a.block_id} at {a.day} P{a.start}")

    print(f"ERP Validator Violations: {len(violations)}")
    for v in violations:
        print(f" - {v}")

    print("\n--- FINAL REPORT ---")
    
    print("\n--- SYNCHRONIZATION VERIFICATION ---")
    sync_g1 = db.query(SynchronizedGroup).filter_by(description="MCA Elective 1 (Meet 1)").first()
    if sync_g1:
        members = db.query(SynchronizedGroupMember).filter_by(synchronized_group_id=sync_g1.id).all()
        ts_ids = [m.teaching_session_id for m in members]
        print(f"3-Member Sync (Group {sync_g1.id}):")
        for a in [a for a in assignments if int(a.block_id) in ts_ids]:
            print(f"  Session {a.block_id}: Day {a.day}, Slot {a.start}")

    sync_m = db.query(SynchronizedGroup).filter_by(description="MCA Mixed Section Seminar").first()
    if sync_m:
        members = db.query(SynchronizedGroupMember).filter_by(synchronized_group_id=sync_m.id).all()
        ts_ids = [m.teaching_session_id for m in members]
        print(f"Mixed Section Sync (Group {sync_m.id}):")
        for a in [a for a in assignments if int(a.block_id) in ts_ids]:
            print(f"  Session {a.block_id}: Day {a.day}, Slot {a.start}")

    is_success = (status in ("OPTIMAL", "FEASIBLE", 4, 2)) and (len(violations) == 0) and (len(assignments) == num_blocks)
    config_id = 1
    config = db.query(TimetableConfiguration).first()
    if config:
        config_id = config.id
        
    run = TimetableRun(
        run_id=f"RUN-{int(time.time())}",
        workspace_id="FLABS-MCA",
        configuration_id=config_id,
        status=TimetableStatusEnum.COMPLETED if is_success else TimetableStatusEnum.FAILED,
        solver_name="KAIROS_CP_SAT",
        duration_seconds=int(wall_time),
        expected_sessions=num_blocks,
        scheduled_sessions=len(assignments),
        hard_violation_count=len(violations)
    )
    db.add(run)
    db.commit()
    
    if is_success:
        from app.models.timetable import TimetableVersion, TimetableEntry, TimetableVersionStatusEnum
        version = TimetableVersion(
            run_id=run.id,
            status=TimetableVersionStatusEnum.DRAFT
        )
        db.add(version)
        db.commit()
        
        entries_to_add = []
        for a in assignments:
            day_idx = next(k for k, v in kairos_day_map.items() if v == a.day)
            erp_ts = db.query(TeachingSession).get(int(a.block_id))
            for slot_idx in range(a.start, a.end):
                erp_p = solver_slot_to_erp_period(slot_idx)
                entry = TimetableEntry(
                    timetable_version_id=version.id,
                    teaching_session_id=erp_ts.id,
                    faculty_id=erp_ts.faculty_id,
                    section_id=erp_ts.section_id,
                    subject_id=erp_ts.subject_id,
                    room_id=int(a.room) if a.room else 1, # fallback just in case
                    day_index=day_idx,
                    start_period=erp_p,
                    duration_in_periods=1,
                    session_type=erp_ts.teaching_type,
                    synchronization_group_id=erp_ts.synchronization_group_id
                )
                entries_to_add.append(entry)
        db.add_all(entries_to_add)
        db.commit()
    
    print(f"Simulation run recorded with status: {run.status}")
    
    version_id = version.id if is_success else None
    
    db.close()
    engine.dispose()
    
    return run.status, violations, version_id

if __name__ == "__main__":
    run_simulation()
