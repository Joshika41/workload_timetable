import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.models.domain import Base, Institution, Department, Programme, AcademicWorkspace, User, FacultyProfile, Section, Subject, CurriculumOffering, SubjectAllocation, AllocationComponent, RoleEnum, AllocationRoleEnum, AcademicYear, Semester
from app.models.timetable import TimetableConfiguration, TimetableShift, TimetableWorkingDay, TimetablePeriod, TimetableBreak, TimetableRoom, TimetableFacultyAvailability, TimetableSectionAvailability, TimetableRoomAvailability, SynchronizedGroup, SynchronizedGroupMember, TeachingSession, TimetableConstraint, AvailabilityStatusEnum, ConstraintTypeEnum

def seed_simulation(db_url="sqlite:///:memory:"):
    if "supabase" in db_url.lower() and "production" in db_url.lower():
        print("ERROR: Refusing to seed production database.")
        sys.exit(1)
        
    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    if db.query(AcademicWorkspace).first() is not None:
        print("Database already seeded. Skipping.")
        db.close()
        engine.dispose()
        return
    
    print("--- STARTING TIMETABLE SIMULATION SEED ---")
    
    # 1. Institutions
    inst_et = Institution(code="ET", name="E&T")
    inst_flabs = Institution(code="FL", name="Flabs")
    db.add_all([inst_et, inst_flabs])
    db.commit()

    # 2. Departments
    dept_cs = Department(name="Computer Science", institution_id=inst_flabs.id)
    dept_english = Department(name="English", institution_id=inst_flabs.id)
    db.add_all([dept_cs, dept_english])
    db.commit()

    # 3. Programmes
    prog_mca = Programme(name="MCA", department_id=dept_cs.id, programme_type="PG")
    prog_mca_genai = Programme(name="MCA GEN AI", department_id=dept_cs.id, programme_type="PG")
    db.add_all([prog_mca, prog_mca_genai])
    db.commit()
    
    # Academic Year
    ay = AcademicYear(name="2026-27")
    db.add(ay)
    db.commit()

    # Semester
    sem = Semester(name="ODD", semester_number=1)
    db.add(sem)
    db.commit()

    # 4. Workspaces
    ws_mca = AcademicWorkspace(id="FLABS-MCA", department_id=dept_cs.id, programme_id=prog_mca.id, academic_year_id=ay.id, semester_id=sem.id, programme_year=1)
    db.add(ws_mca)
    db.commit()

    # 5. Faculty
    u1 = User(email="prof_cs@sim", role=RoleEnum.FACULTY, department_id=dept_cs.id, hashed_password="dummy")
    u2 = User(email="prof_eng@sim", role=RoleEnum.FACULTY, department_id=dept_english.id, hashed_password="dummy")
    u3 = User(email="prof_math@sim", role=RoleEnum.FACULTY, department_id=dept_cs.id, hashed_password="dummy")
    db.add_all([u1, u2, u3])
    db.commit()
    
    fac_cs = FacultyProfile(user_id=u1.id, name="Dr. CS", erp_id="SIM-CS01", home_department_id=dept_cs.id, designation="Professor", faculty_type="REGULAR")
    fac_eng = FacultyProfile(user_id=u2.id, name="Dr. English", erp_id="SIM-EN01", home_department_id=dept_english.id, designation="Professor", faculty_type="REGULAR")
    fac_math = FacultyProfile(user_id=u3.id, name="Dr. Math", erp_id="SIM-MA01", home_department_id=dept_cs.id, designation="Professor", faculty_type="REGULAR")
    db.add_all([fac_cs, fac_eng, fac_math])
    db.commit()

    # 6. Sections
    sec_a = Section(workspace_id=ws_mca.id, name="MCA-A", student_strength=60, is_active=True)
    sec_b = Section(workspace_id=ws_mca.id, name="MCA-B", student_strength=60, is_active=True)
    sec_c = Section(workspace_id=ws_mca.id, name="MCA-C", student_strength=60, is_active=True)
    db.add_all([sec_a, sec_b, sec_c])
    db.commit()

    # 7. Subjects & Curriculum
    sub_theory = Subject(course_code="CS101", course_name="Data Structures", theory_hours=3, practical_hours=0, total_hours=3)
    sub_lab = Subject(course_code="CS102", course_name="Python Lab", theory_hours=0, practical_hours=2, total_hours=2)
    sub_eng = Subject(course_code="EN101", course_name="English Comm", theory_hours=2, practical_hours=0, total_hours=2)
    sub_elec1 = Subject(course_code="EL101", course_name="Elective A", theory_hours=3, practical_hours=0, total_hours=3)
    sub_elec2 = Subject(course_code="EL102", course_name="Elective B", theory_hours=3, practical_hours=0, total_hours=3)
    db.add_all([sub_theory, sub_lab, sub_eng, sub_elec1, sub_elec2])
    db.commit()

    # 8. Allocations (Finalized Mock)
    alloc1 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_a.id, subject_id=sub_theory.id, status="FINALIZED")
    alloc2 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_a.id, subject_id=sub_lab.id, status="FINALIZED")
    alloc3 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_a.id, subject_id=sub_eng.id, status="FINALIZED")
    alloc4 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_a.id, subject_id=sub_elec1.id, status="FINALIZED")
    alloc5 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_b.id, subject_id=sub_elec2.id, status="FINALIZED")
    alloc6 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_c.id, subject_id=sub_elec1.id, status="FINALIZED")
    alloc7 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_a.id, subject_id=sub_theory.id, status="FINALIZED")
    alloc8 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_c.id, subject_id=sub_theory.id, status="FINALIZED")
    alloc9 = SubjectAllocation(workspace_id=ws_mca.id, section_id=sec_a.id, subject_id=sub_theory.id, status="FINALIZED")
    db.add_all([alloc1, alloc2, alloc3, alloc4, alloc5, alloc6, alloc7, alloc8, alloc9])
    db.commit()

    comp1 = AllocationComponent(allocation_id=alloc1.id, faculty_id=fac_cs.id, role=AllocationRoleEnum.INCHARGE_1, theory_hours=4)
    comp2 = AllocationComponent(allocation_id=alloc2.id, faculty_id=fac_cs.id, role=AllocationRoleEnum.INCHARGE_1, practical_hours=2)
    comp3 = AllocationComponent(allocation_id=alloc3.id, faculty_id=fac_eng.id, role=AllocationRoleEnum.INCHARGE_1, theory_hours=2)
    comp4 = AllocationComponent(allocation_id=alloc4.id, faculty_id=fac_cs.id, role=AllocationRoleEnum.INCHARGE_1, theory_hours=3)
    comp5 = AllocationComponent(allocation_id=alloc5.id, faculty_id=fac_eng.id, role=AllocationRoleEnum.INCHARGE_1, theory_hours=3)
    comp6 = AllocationComponent(allocation_id=alloc6.id, faculty_id=fac_math.id, role=AllocationRoleEnum.INCHARGE_1, theory_hours=1)
    comp7 = AllocationComponent(allocation_id=alloc7.id, faculty_id=fac_cs.id, role=AllocationRoleEnum.INCHARGE_1, theory_hours=1)
    comp8 = AllocationComponent(allocation_id=alloc8.id, faculty_id=fac_math.id, role=AllocationRoleEnum.INCHARGE_1, theory_hours=1)
    comp9 = AllocationComponent(allocation_id=alloc9.id, faculty_id=fac_cs.id, role=AllocationRoleEnum.INCHARGE_1, theory_hours=3)
    db.add_all([comp1, comp2, comp3, comp4, comp5, comp6, comp7, comp8, comp9])
    db.commit()

    # 9. Sync Groups
    sync_g1 = SynchronizedGroup(description="MCA Elective 1 (Meet 1)", group_type="ELECTIVE")
    sync_g2 = SynchronizedGroup(description="MCA Elective 1 (Meet 2)", group_type="ELECTIVE")
    sync_g3 = SynchronizedGroup(description="MCA Elective 1 (Meet 3)", group_type="ELECTIVE")
    sync_mixed = SynchronizedGroup(description="MCA Mixed Section Seminar", group_type="MIXED_SECTION")
    sync_invalid = SynchronizedGroup(description="Invalid Duration Mismatch", group_type="ELECTIVE")
    sync_fail = SynchronizedGroup(description="Availability Failure Group", group_type="ELECTIVE")
    db.add_all([sync_g1, sync_g2, sync_g3, sync_mixed, sync_invalid, sync_fail])
    db.commit()

    # 10. Teaching Sessions
    ts_theory1 = TeachingSession(allocation_id=alloc1.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1)
    ts_theory2 = TeachingSession(allocation_id=alloc1.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1)
    ts_theory3 = TeachingSession(allocation_id=alloc1.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1)
    
    ts_lab = TeachingSession(allocation_id=alloc2.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="LAB", duration_in_periods=2)
    
    ts_eng1 = TeachingSession(allocation_id=alloc3.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_eng.id, teaching_type="THEORY", duration_in_periods=1)
    ts_eng2 = TeachingSession(allocation_id=alloc3.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_eng.id, teaching_type="THEORY", duration_in_periods=1)
    
    ts_el1_1 = TeachingSession(allocation_id=alloc4.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_g1.id)
    ts_el1_2 = TeachingSession(allocation_id=alloc4.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_g2.id)
    ts_el1_3 = TeachingSession(allocation_id=alloc4.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_g3.id)
    
    ts_el2_1 = TeachingSession(allocation_id=alloc5.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_b.id, faculty_id=fac_eng.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_g1.id)
    ts_el2_2 = TeachingSession(allocation_id=alloc5.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_b.id, faculty_id=fac_eng.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_g2.id)
    ts_el2_3 = TeachingSession(allocation_id=alloc5.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_b.id, faculty_id=fac_eng.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_g3.id)
    
    ts_el3_1 = TeachingSession(allocation_id=alloc6.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_c.id, faculty_id=fac_math.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_g1.id)
    
    ts_mixed = TeachingSession(allocation_id=alloc1.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_mixed.id)

    # Invalid sync group: member 1 has 1 period, member 2 has 2 periods
    ts_inv1 = TeachingSession(allocation_id=alloc9.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_invalid.id)
    ts_inv2 = TeachingSession(allocation_id=alloc9.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=2, synchronization_group_id=sync_invalid.id)

    # Fail sync group: availability conflict
    ts_fail1 = TeachingSession(allocation_id=alloc7.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_a.id, faculty_id=fac_cs.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_fail.id)
    ts_fail2 = TeachingSession(allocation_id=alloc8.id, institution_id=inst_flabs.id, workspace_id=ws_mca.id, section_id=sec_c.id, faculty_id=fac_math.id, teaching_type="THEORY", duration_in_periods=1, synchronization_group_id=sync_fail.id)

    db.add_all([ts_theory1, ts_theory2, ts_theory3, ts_lab, ts_eng1, ts_eng2, ts_el1_1, ts_el1_2, ts_el1_3, ts_el2_1, ts_el2_2, ts_el2_3, ts_el3_1, ts_mixed, ts_inv1, ts_inv2, ts_fail1, ts_fail2])
    db.commit()
    
    sgm1 = SynchronizedGroupMember(synchronized_group_id=sync_g1.id, teaching_session_id=ts_el1_1.id, section_id=sec_a.id, faculty_id=fac_cs.id)
    sgm2 = SynchronizedGroupMember(synchronized_group_id=sync_g1.id, teaching_session_id=ts_el2_1.id, section_id=sec_b.id, faculty_id=fac_eng.id)
    sgm_el3_1 = SynchronizedGroupMember(synchronized_group_id=sync_g1.id, teaching_session_id=ts_el3_1.id, section_id=sec_c.id, faculty_id=fac_math.id)
    
    sgm3 = SynchronizedGroupMember(synchronized_group_id=sync_g2.id, teaching_session_id=ts_el1_2.id, section_id=sec_a.id, faculty_id=fac_cs.id)
    sgm4 = SynchronizedGroupMember(synchronized_group_id=sync_g2.id, teaching_session_id=ts_el2_2.id, section_id=sec_b.id, faculty_id=fac_eng.id)
    sgm5 = SynchronizedGroupMember(synchronized_group_id=sync_g3.id, teaching_session_id=ts_el1_3.id, section_id=sec_a.id, faculty_id=fac_cs.id)
    sgm6 = SynchronizedGroupMember(synchronized_group_id=sync_g3.id, teaching_session_id=ts_el2_3.id, section_id=sec_b.id, faculty_id=fac_eng.id)
    
    sgm_m1 = SynchronizedGroupMember(synchronized_group_id=sync_mixed.id, teaching_session_id=ts_mixed.id, section_id=sec_a.id, faculty_id=fac_cs.id)
    sgm_m2 = SynchronizedGroupMember(synchronized_group_id=sync_mixed.id, teaching_session_id=ts_mixed.id, section_id=sec_b.id, faculty_id=fac_cs.id)

    # sgm_inv1 = SynchronizedGroupMember(synchronized_group_id=sync_invalid.id, teaching_session_id=ts_inv1.id, section_id=sec_a.id, faculty_id=fac_cs.id)
    # sgm_inv2 = SynchronizedGroupMember(synchronized_group_id=sync_invalid.id, teaching_session_id=ts_inv2.id, section_id=sec_a.id, faculty_id=fac_cs.id)

    # sgm_fail1 = SynchronizedGroupMember(synchronized_group_id=sync_fail.id, teaching_session_id=ts_fail1.id, section_id=sec_a.id, faculty_id=fac_cs.id)
    # sgm_fail2 = SynchronizedGroupMember(synchronized_group_id=sync_fail.id, teaching_session_id=ts_fail2.id, section_id=sec_c.id, faculty_id=fac_math.id)

    db.add_all([sgm1, sgm2, sgm_el3_1, sgm3, sgm4, sgm5, sgm6, sgm_m1, sgm_m2])
    db.commit()

    # 11. Configuration
    config = TimetableConfiguration(institution_id=inst_flabs.id, workspace_id=ws_mca.id)
    db.add(config)
    db.commit()
    
    room1 = TimetableRoom(institution_id=inst_flabs.id, room_code="R101", room_name="Room 101", room_type="CLASSROOM", capacity=120, active=True)
    room2 = TimetableRoom(institution_id=inst_flabs.id, room_code="L101", room_name="PC Lab 1", room_type="PC_LAB", capacity=60, active=True)
    room3 = TimetableRoom(institution_id=inst_flabs.id, room_code="R102", room_name="Room 102", room_type="CLASSROOM", capacity=120, active=True)
    room4 = TimetableRoom(institution_id=inst_flabs.id, room_code="R103", room_name="Room 103", room_type="CLASSROOM", capacity=60, active=True)
    db.add_all([room1, room2, room3, room4])
    db.commit()

    from datetime import time
    # Periods: P1(08:00), P2(08:45), P3(09:30), Break(10:15-10:30), P4(10:30), P5(11:15), P6(12:00)
    periods = [
        TimetablePeriod(configuration_id=config.id, period_number=1, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45),
        TimetablePeriod(configuration_id=config.id, period_number=2, start_time=time(8, 45), end_time=time(9, 30), duration_minutes=45),
        TimetablePeriod(configuration_id=config.id, period_number=3, start_time=time(9, 30), end_time=time(10, 15), duration_minutes=45),
        TimetablePeriod(configuration_id=config.id, period_number=4, start_time=time(10, 30), end_time=time(11, 15), duration_minutes=45),
        TimetablePeriod(configuration_id=config.id, period_number=5, start_time=time(11, 15), end_time=time(12, 0), duration_minutes=45),
        TimetablePeriod(configuration_id=config.id, period_number=6, start_time=time(12, 0), end_time=time(12, 45), duration_minutes=45)
    ]
    db.add_all(periods)
    
    brk = TimetableBreak(configuration_id=config.id, name="Tea Break", start_time=time(10, 15), end_time=time(10, 30))
    db.add(brk)
    db.commit()
    
    # fac_unavail1 = TimetableFacultyAvailability(faculty_id=fac_cs.id, configuration_id=config.id, day_index=0, period_number=2, status=AvailabilityStatusEnum.UNAVAILABLE)
    # fac_unavail2 = TimetableFacultyAvailability(faculty_id=fac_math.id, configuration_id=config.id, day_index=0, period_number=1, status=AvailabilityStatusEnum.UNAVAILABLE)
    # fac_unavail3 = TimetableFacultyAvailability(faculty_id=fac_math.id, configuration_id=config.id, day_index=0, period_number=3, status=AvailabilityStatusEnum.UNAVAILABLE)
    # fac_unavail4 = TimetableFacultyAvailability(faculty_id=fac_math.id, configuration_id=config.id, day_index=0, period_number=4, status=AvailabilityStatusEnum.UNAVAILABLE)
    # fac_unavail5 = TimetableFacultyAvailability(faculty_id=fac_math.id, configuration_id=config.id, day_index=0, period_number=5, status=AvailabilityStatusEnum.UNAVAILABLE)
    # fac_unavail6 = TimetableFacultyAvailability(faculty_id=fac_math.id, configuration_id=config.id, day_index=0, period_number=6, status=AvailabilityStatusEnum.UNAVAILABLE)
    # db.add_all([fac_unavail1, fac_unavail2, fac_unavail3, fac_unavail4, fac_unavail5, fac_unavail6])
    # db.commit()

    print("--- SEEDING COMPLETE ---")
    
    print("\n--- INTEGRITY AUDIT ---")
    print(f"Institutions: {db.query(Institution).count()}")
    print(f"Workspaces: {db.query(AcademicWorkspace).count()}")
    print(f"Programmes: {db.query(Programme).count()}")
    print(f"Faculty: {db.query(FacultyProfile).count()}")
    print(f"Sections: {db.query(Section).count()}")
    print(f"Subjects: {db.query(Subject).count()}")
    print(f"Allocations: {db.query(SubjectAllocation).count()}")
    print(f"Teaching Sessions: {db.query(TeachingSession).count()}")
    print(f"Rooms: {db.query(TimetableRoom).count()}")
    print(f"Availability Records: {db.query(TimetableFacultyAvailability).count()}")
    print(f"Synchronized Groups: {db.query(SynchronizedGroup).count()}")
    
    db.close()
    engine.dispose()

if __name__ == "__main__":
    db_url = os.environ.get("SIMULATION_DATABASE_URL", "sqlite:///:memory:")
    seed_simulation(db_url)
