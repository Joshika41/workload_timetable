"""
KAIROS Solver Adapter Service.

Provides a clean, tested integration boundary between canonical ERP PostgreSQL
models (TeachingSession, TimetableRoom, TimetableFacultyAvailability, etc.) and
the KAIROS CP-SAT / Repair solver engine.

Responsibilities:
1. Maps validated TeachingSession records into KAIROS Section and Block data structures.
2. Formulates KAIROS Config, Rooms, and Instructors respecting FLABS Shift 1 constraints:
   - 6 periods mapped to slots 0..5 (08:00 to 12:45).
   - Lunch/Tea break between P3 and P4 (slot 2 and slot 3) prevents 2-period lab blocks
     from spanning across the break.
3. Translates KAIROS solver results (Assignments & Violations) back into canonical
   TimetableEntry objects without mutating production status or auto-publishing.
4. Enforces strict scope preservation: no cross-workspace or odd/even semester leakage.
"""

import sys
import os
from typing import List, Dict, Tuple, Optional, Set
from collections import defaultdict
from sqlalchemy.orm import Session

# Add vendor/KAIROS to sys.path safely if not present
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
kairos_dir = os.path.join(backend_dir, "vendor", "KAIROS")
if kairos_dir not in sys.path:
    sys.path.append(kairos_dir)

from src.timetabling.model import Instructor, Section as KSection, Block, Room as KRoom, Assignment
from src.timetabling.config import Config
from src.timetabling.pipeline import run_pipeline, PipelineResult

from app.models.domain import (
    AcademicWorkspace,
    FacultyProfile,
    Section,
    SubjectAllocation,
    Subject,
    AllocationComponent
)
from app.models.timetable import (
    TeachingSession,
    TimetableRoom,
    TimetableFacultyAvailability,
    TimetableSectionAvailability,
    TimetableRoomAvailability,
    AvailabilityStatusEnum,
    SynchronizedGroup,
    SynchronizedGroupMember,
    TimetablePeriod,
    TimetableEntry,
    TimetableRun,
    TimetableStatusEnum,
    TimetableVersion,
    TimetableVersionStatusEnum
)


# Slot conversion helpers for 6-period shift
# P1 -> 0, P2 -> 1, P3 -> 2, [Break], P4 -> 3, P5 -> 4, P6 -> 5
def erp_period_to_slot(period: int) -> int:
    return period - 1

def slot_to_erp_period(slot: int) -> int:
    return slot + 1

KAIROS_DAY_MAP = {0: "Mo", 1: "Tu", 2: "We", 3: "Th", 4: "Fr", 5: "Sa", 6: "Su"}
REVERSE_DAY_MAP = {"Mo": 0, "Tu": 1, "We": 2, "Th": 3, "Fr": 4, "Sa": 5, "Su": 6}


class KairosAdapterError(Exception):
    """Raised when adapter transformation or validation fails."""
    pass


class KairosTimetableAdapter:
    """Adapter bridging canonical database sessions to KAIROS solver."""

    def __init__(self, db: Session):
        self.db = db

    def calculate_valid_start_slots(self, periods: List[TimetablePeriod]) -> Dict[int, frozenset]:
        """
        Calculates valid start slots for blocks of varying lengths (1, 2, 3...)
        ensuring that consecutive-period blocks cannot span across the morning break.
        """
        sorted_periods = sorted(periods, key=lambda p: p.period_number)
        contiguous_slots = []

        for i in range(len(sorted_periods)):
            contig = [erp_period_to_slot(sorted_periods[i].period_number)]
            curr = sorted_periods[i]
            for j in range(i + 1, len(sorted_periods)):
                next_p = sorted_periods[j]
                if curr.end_time == next_p.start_time:
                    contig.append(erp_period_to_slot(next_p.period_number))
                    curr = next_p
                else:
                    break
            contiguous_slots.append(contig)

        valid_starts = {}
        for length in [1, 2, 3, 4]:
            valid = set()
            for contig in contiguous_slots:
                if len(contig) >= length:
                    valid.add(contig[0])
            valid_starts[length] = frozenset(valid)

        return valid_starts

    def build_solver_inputs(
        self,
        workspace_id: str,
        sessions: List[TeachingSession],
        rooms: List[TimetableRoom],
        periods: List[TimetablePeriod]
    ) -> Tuple[List[KSection], Dict[str, KRoom], Dict[str, Instructor], Config]:
        """
        Translates canonical database objects for a single workspace into KAIROS inputs.
        Maintains strict backward compatibility.
        """
        return self.build_multi_workspace_solver_inputs(
            workspace_ids=[workspace_id],
            sessions=sessions,
            rooms=rooms,
            periods=periods
        )

    def build_multi_workspace_solver_inputs(
        self,
        workspace_ids: List[str],
        sessions: List[TeachingSession],
        rooms: List[TimetableRoom],
        periods: List[TimetablePeriod],
        respect_existing_reservations: bool = True,
        skip_capacity_verification: bool = False
    ) -> Tuple[List[KSection], Dict[str, KRoom], Dict[str, Instructor], Config]:
        """
        Translates canonical database objects for multiple coordinated workspaces into KAIROS inputs.
        Guarantees:
        - Mutual exclusion for shared faculty across all included workspaces.
        - Mutual exclusion for shared physical rooms across all included workspaces.
        - Unified faculty daily free-period constraint across their combined schedule.
        - Strict section isolation (each section's workload and blocks remain separate).
        - Protection against collisions with existing active timetable reservations in omitted workspaces.
        """
        if not workspace_ids:
            raise KairosAdapterError("No workspace IDs provided for multi-workspace solve.")

        if not sessions:
            raise KairosAdapterError(f"No teaching sessions provided for workspaces: {workspace_ids}.")

        # 1. Validate Scope & Exclusions
        ws_set = set(workspace_ids)
        for ws_id in workspace_ids:
            ws = self.db.query(AcademicWorkspace).filter(AcademicWorkspace.id == ws_id).first()
            if not ws:
                raise KairosAdapterError(f"Workspace '{ws_id}' not found.")

        for ts in sessions:
            if ts.workspace_id not in ws_set:
                if len(workspace_ids) == 1:
                    raise KairosAdapterError(
                        f"TeachingSession ID {ts.id} belongs to workspace '{ts.workspace_id}', not '{workspace_ids[0]}'."
                    )
                else:
                    raise KairosAdapterError(
                        f"TeachingSession ID {ts.id} belongs to workspace '{ts.workspace_id}', "
                        f"which is not in the coordinated scheduling scope {workspace_ids}."
                    )

        # 2. Build KAIROS Rooms
        k_rooms: Dict[str, KRoom] = {}
        for r in rooms:
            if not r.active:
                continue
            r_type = "normal"
            if r.room_type in ["LAB", "PC_LAB"]:
                r_type = "lab" if r.room_type == "LAB" else "pc"
            elif r.room_type == "STUDIO":
                r_type = "studio"

            k_rooms[str(r.id)] = KRoom(
                room=str(r.id),
                cap=r.capacity,
                is_lab=(r_type != "normal"),
                is_physical=True,
                type=r_type
            )

        if not k_rooms:
            raise KairosAdapterError("No active timetable rooms available for solver.")

        # 3. Build KAIROS Instructors
        faculty_ids = set(ts.faculty_id for ts in sessions)
        k_instructors: Dict[str, Instructor] = {}

        for f_id in faculty_ids:
            fac = self.db.query(FacultyProfile).filter(FacultyProfile.id == f_id).first()
            if not fac:
                raise KairosAdapterError(f"Faculty ID {f_id} referenced by teaching session does not exist.")
            k_instructors[str(f_id)] = Instructor(
                staff_id=str(f_id),
                name=fac.name,
                is_staff=True,
                home_dept=str(fac.home_department_id)
            )

        # 4. Formulate KAIROS Config & Availability Constraints
        k_config = Config()
        k_config.horizon_start = 0
        k_config.horizon_end = 6  # 6 periods total (slots 0..5)
        k_config.undergrad_end = 6
        k_config.grad_start = 0
        k_config.grad_end = 6
        k_config.include_grad = True
        k_config.saturday_enabled = False
        k_config.max_daily_instr_periods = 5  # At least 1 free period per day (out of 6 daily periods)
        k_config.max_daily_theory_periods = 2  # University rule: at most 2 occurrences of same theory subject per section per day

        # Faculty unavailability from DB availability table
        faculty_avail = (
            self.db.query(TimetableFacultyAvailability)
            .filter(TimetableFacultyAvailability.faculty_id.in_(faculty_ids))
            .all()
        )
        instr_blackouts = set()
        for fa in faculty_avail:
            if fa.status == AvailabilityStatusEnum.UNAVAILABLE:
                day_str = KAIROS_DAY_MAP.get(fa.day_index, "Mo")
                slot = erp_period_to_slot(fa.period_number)
                instr_blackouts.add((str(fa.faculty_id), day_str, slot))

        # Room unavailability from DB availability table
        room_ids = set(r.id for r in rooms)
        room_avail = (
            self.db.query(TimetableRoomAvailability)
            .filter(TimetableRoomAvailability.room_id.in_(room_ids))
            .all()
        )
        room_blackouts = set()
        for ra in room_avail:
            if ra.status == AvailabilityStatusEnum.UNAVAILABLE:
                day_str = KAIROS_DAY_MAP.get(ra.day_index, "Mo")
                slot = erp_period_to_slot(ra.period_number)
                room_blackouts.add((str(ra.room_id), day_str, slot))

        # Check existing active timetable reservations in omitted workspaces
        if respect_existing_reservations:
            # Look for existing entries for these faculty members in versions from other workspaces
            # that are VALIDATED or PUBLISHED (or DRAFT if not being regenerated)
            existing_faculty_entries = (
                self.db.query(TimetableEntry)
                .join(TeachingSession, TimetableEntry.teaching_session_id == TeachingSession.id)
                .join(TimetableVersion, TimetableEntry.timetable_version_id == TimetableVersion.id)
                .filter(
                    TimetableEntry.faculty_id.in_(faculty_ids),
                    TeachingSession.workspace_id.notin_(ws_set),
                    TimetableVersion.status.in_([
                        TimetableVersionStatusEnum.PUBLISHED,
                        TimetableVersionStatusEnum.VALIDATED
                    ])
                )
                .all()
            )
            for ee in existing_faculty_entries:
                day_str = KAIROS_DAY_MAP.get(ee.day_index, "Mo")
                for p_offset in range(ee.duration_in_periods):
                    slot = erp_period_to_slot(ee.start_period + p_offset)
                    instr_blackouts.add((str(ee.faculty_id), day_str, slot))

            # Look for existing entries for these rooms in versions from other workspaces
            existing_room_entries = (
                self.db.query(TimetableEntry)
                .join(TeachingSession, TimetableEntry.teaching_session_id == TeachingSession.id)
                .join(TimetableVersion, TimetableEntry.timetable_version_id == TimetableVersion.id)
                .filter(
                    TimetableEntry.room_id.in_(room_ids),
                    TeachingSession.workspace_id.notin_(ws_set),
                    TimetableVersion.status.in_([
                        TimetableVersionStatusEnum.PUBLISHED,
                        TimetableVersionStatusEnum.VALIDATED
                    ])
                )
                .all()
            )
            for ree in existing_room_entries:
                day_str = KAIROS_DAY_MAP.get(ree.day_index, "Mo")
                for p_offset in range(ree.duration_in_periods):
                    slot = erp_period_to_slot(ree.start_period + p_offset)
                    room_blackouts.add((str(ree.room_id), day_str, slot))

        k_config.instr_unavailable = frozenset(instr_blackouts)
        k_config.room_unavailable = frozenset(room_blackouts)

        # Synchronized blocks
        sync_group_map = defaultdict(list)
        for ts in sessions:
            if ts.synchronization_group_id:
                sync_group_map[ts.synchronization_group_id].append(ts)

        valid_sync_blocks = []
        for sg_id, group_sessions in sync_group_map.items():
            durations = set(s.duration_in_periods for s in group_sessions)
            if len(durations) > 1:
                raise KairosAdapterError(
                    f"SynchronizedGroup {sg_id} has mismatched session durations: {durations}."
                )
            valid_sync_blocks.append(tuple(str(s.id) for s in group_sessions))
        k_config.synchronized_blocks = tuple(valid_sync_blocks)

        # 5. Build KAIROS Sections and Blocks
        valid_starts_by_length = self.calculate_valid_start_slots(periods)
        session_groups = defaultdict(list)
        for ts in sessions:
            # Group by workspace_id, section_id, allocation_id to guarantee unique KSection ID
            session_groups[(ts.workspace_id, ts.section_id, ts.allocation_id)].append(ts)

        k_sections: List[KSection] = []

        for (ws_id, sec_id, alloc_id), group_ts in session_groups.items():
            ws = self.db.query(AcademicWorkspace).filter(AcademicWorkspace.id == ws_id).first()
            sec = self.db.query(Section).filter(Section.id == sec_id).first()
            if not sec:
                raise KairosAdapterError(f"Section ID {sec_id} not found.")

            alloc = self.db.query(SubjectAllocation).filter(SubjectAllocation.id == alloc_id).first()
            if not alloc:
                raise KairosAdapterError(f"Allocation ID {alloc_id} not found.")

            subj = self.db.query(Subject).filter(Subject.id == alloc.subject_id).first()
            subj_name = subj.course_name if subj else "Unknown"
            course_code = subj.course_code if subj else "SUBJ"

            blocks: List[Block] = []
            instructor_ids = set()

            sec_identifier = f"{sec_id}_{alloc_id}" if len(workspace_ids) == 1 else f"{ws_id}_{sec_id}_{alloc_id}"

            for ts in group_ts:
                instructor_ids.add(str(ts.faculty_id))
                kind = "theory" if ts.teaching_type == "THEORY" else "lab"
                length = ts.duration_in_periods
                valid_starts = valid_starts_by_length.get(length, frozenset([0, 1, 3, 4]))

                blocks.append(Block(
                    block_id=str(ts.id),
                    section_id=sec_identifier,
                    kind=kind,
                    length=length,
                    needs_lab=(kind == "lab"),
                    valid_start_slots=valid_starts
                ))

            # Students count validation: student strength must be explicitly defined and positive in official mode
            if not sec.student_strength or sec.student_strength <= 0:
                if not skip_capacity_verification:
                    raise KairosAdapterError(
                        f"Section '{sec.name}' (ID {sec.id}) has missing or invalid student_strength: {sec.student_strength}. "
                        f"Room capacity suitability cannot be safely evaluated without verified student strength."
                    )
                effective_students = 0
            else:
                effective_students = sec.student_strength

            k_sections.append(KSection(
                section_id=sec_identifier,
                period="FLABS_SHIFT_1",
                code=course_code,
                name=subj_name,
                level=ws.programme_year or 1,
                dept_code=str(ws.department_id),
                department=ws.department.name if ws.department else "FLABS",
                cohort_key=f"SEC_{sec_id}",
                instructor_ids=list(instructor_ids),
                students=effective_students,
                T=sum(b.length for b in blocks if b.kind == "theory"),
                P=sum(b.length for b in blocks if b.kind == "lab"),
                L=0,
                Cr=3,
                category="REGULAR",
                blocks=blocks
            ))

        return (k_sections, k_rooms, k_instructors, k_config)

    def map_assignments_to_entries(
        self,
        assignments: List[Assignment],
        sessions: List[TeachingSession],
        timetable_version_id: int
    ) -> List[TimetableEntry]:
        """
        Translates KAIROS Assignment outputs into canonical TimetableEntry database records.
        """
        session_by_id = {str(ts.id): ts for ts in sessions}
        entries: List[TimetableEntry] = []

        for assign in assignments:
            ts = session_by_id.get(assign.block_id)
            if not ts:
                raise KairosAdapterError(f"Assignment references unknown session block ID {assign.block_id}.")

            day_idx = REVERSE_DAY_MAP.get(assign.day, 0)
            start_period = slot_to_erp_period(assign.start)

            entry = TimetableEntry(
                timetable_version_id=timetable_version_id,
                teaching_session_id=ts.id,
                faculty_id=ts.faculty_id,
                section_id=ts.section_id,
                subject_id=ts.subject_id,
                room_id=int(assign.room),
                day_index=day_idx,
                start_period=start_period,
                duration_in_periods=assign.end - assign.start,
                session_type=ts.teaching_type,
                synchronization_group_id=ts.synchronization_group_id
            )
            entries.append(entry)

        return entries
