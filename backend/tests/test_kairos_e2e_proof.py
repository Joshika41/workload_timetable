"""
End-to-End Pipeline & Constraint Validation Tests.

Validates:
1. End-to-end integration: TeachingSessionBuilder -> KairosTimetableAdapter -> run_pipeline -> map_assignments_to_entries.
2. Full occupancy test: 30-period weekly workload fills all 30 slots (5 days x 6 periods).
3. Faculty free-period constraint: Faculty teaches at most 5 periods per day (at least 1 free period/day).
4. Break contiguity: Labs cannot span across the morning tea break (P3 to P4).
5. Infeasible detection: Overconstrained input (e.g. 6 periods required on a day when max is 5, or room shortages) produces failure or violation.
6. Guard check: Strictly in-memory SQLite; guaranteed zero writes to Mumbai PostgreSQL.
"""

import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import unittest
from datetime import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import backend app modules FIRST before touching vendor/KAIROS
from app.models.domain import (
    Base,
    Institution,
    Department,
    Programme,
    AcademicYear,
    Semester,
    AcademicWorkspace,
    WorkspaceWorkflowStateEnum,
    WorkloadVersion,
    Subject,
    Section,
    FacultyProfile,
    SubjectAllocation,
    AllocationComponent,
    AllocationStatusEnum,
    AllocationRoleEnum,
    User,
    RoleEnum
)
from app.models.timetable import (
    TeachingSession,
    TimetableRoom,
    TimetablePeriod,
    TimetableEntry,
    TimetableConfiguration
)
from app.services.teaching_session_builder import TeachingSessionBuilder
from app.services.kairos_adapter import KairosTimetableAdapter

# Now import KAIROS
kairos_dir = os.path.join(backend_dir, "vendor", "KAIROS")
if kairos_dir not in sys.path:
    sys.path.append(kairos_dir)

from src.timetabling.pipeline import run_pipeline
from src.timetabling.validate import validate


class TestKairosEndToEndProof(unittest.TestCase):
    def setUp(self):
        # STRICT SAFETY GUARD: in-memory SQLite only
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        assert "sqlite" in str(self.engine.url), "FATAL: Test must run only on isolated in-memory SQLite."
        
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Fixtures
        self.inst = Institution(id=2, name="Flabs", code="FLABS")
        self.dept = Department(id=5, institution_id=2, name="Postgraduate Department of Computer Applications")
        self.prog = Programme(id=6, department_id=5, name="MCA", programme_type="PG")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem = Semester(id=1, semester_number=1, name="Semester 1")
        self.db.add_all([self.inst, self.dept, self.prog, self.ay, self.sem])
        self.db.commit()

        self.ws_id = "ws_full_30_occupancy"
        self.ws = AcademicWorkspace(
            id=self.ws_id, department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED,
            version=1
        )
        self.db.add(self.ws)
        self.db.commit()

        # Add active WorkloadVersion
        wv = WorkloadVersion(workspace_id=self.ws_id, version_no=1, snapshot_json="{}", reason="HOD Final")
        self.db.add(wv)

        # Faculty Members (2 faculty to share 30 periods without violating max 5 periods/day)
        # Each faculty will teach 15 periods across 5 days (average 3 periods/day, well under max 5)
        self.u1 = User(id=1, email="fac1@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=5)
        self.u2 = User(id=2, email="fac2@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=5)
        self.db.add_all([self.u1, self.u2])
        self.db.commit()

        self.f1 = FacultyProfile(id=1, user_id=1, erp_id="FAC001", name="Dr. Renuga", designation="Professor", home_department_id=5)
        self.f2 = FacultyProfile(id=2, user_id=2, erp_id="FAC002", name="Dr. Sathish", designation="Associate Professor", home_department_id=5)
        self.db.add_all([self.f1, self.f2])

        # Section
        self.sec = Section(id=100, workspace_id=self.ws_id, name="A", student_strength=40)
        self.db.add(self.sec)

        # Rooms (1 theory classroom cap 60, 1 computer lab cap 60)
        self.r_class = TimetableRoom(id=1, institution_id=2, workspace_id=self.ws_id, room_code="CR101", room_name="Classroom 101", room_type="CLASSROOM", capacity=60, active=True)
        self.r_lab = TimetableRoom(id=2, institution_id=2, workspace_id=self.ws_id, room_code="LAB101", room_name="Computer Lab 1", room_type="PC_LAB", capacity=60, active=True)
        self.db.add_all([self.r_class, self.r_lab])

        # FLABS Shift 1 Periods (6 periods, tea break 10:15 - 10:30)
        self.periods = [
            TimetablePeriod(configuration_id=1, period_number=1, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=2, start_time=time(8, 45), end_time=time(9, 30), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=3, start_time=time(9, 30), end_time=time(10, 15), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=4, start_time=time(10, 30), end_time=time(11, 15), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=5, start_time=time(11, 15), end_time=time(12, 0), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=6, start_time=time(12, 0), end_time=time(12, 45), duration_minutes=45),
        ]
        self.db.add_all(self.periods)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_end_to_end_30_period_full_occupancy(self):
        """
        Synthesizes a 30-period workload (22 theory hours + 8 practical lab hours = 30 total periods).
        Runs the full pipeline:
        TeachingSessionBuilder -> KairosTimetableAdapter -> run_pipeline -> map_assignments_to_entries.
        Asserts:
        - Exactly 30 timetable entries generated.
        - Zero hard violations.
        - Every (day, period) slot in [0..4] x [1..6] is occupied exactly once.
        - Lab sessions (duration 2) occupy valid consecutive periods and do not cross the break.
        - Neither faculty teaches 6 periods on any day (at least 1 free period/day preserved).
        """
        # Subjects: 6 theory subjects (Subj 1-4 = 4 hrs each, Subj 5 = 3 hrs, Subj 6 = 3 hrs -> 22 hrs)
        # 2 lab subjects (Lab 1 = 4 hrs, Lab 2 = 4 hrs -> 8 hrs)
        # Total = 30 hours
        subjects = [
            Subject(id=1, course_code="MCA101", course_name="Advanced Java", theory_hours=4, practical_hours=0),
            Subject(id=2, course_code="MCA102", course_name="Database Systems", theory_hours=4, practical_hours=0),
            Subject(id=3, course_code="MCA103", course_name="Data Structures", theory_hours=4, practical_hours=0),
            Subject(id=4, course_code="MCA104", course_name="Operating Systems", theory_hours=4, practical_hours=0),
            Subject(id=5, course_code="MCA105", course_name="Discrete Math", theory_hours=3, practical_hours=0),
            Subject(id=6, course_code="MCA106", course_name="Software Engineering", theory_hours=3, practical_hours=0),
            Subject(id=7, course_code="MCA107L", course_name="Java Lab", theory_hours=0, practical_hours=4),
            Subject(id=8, course_code="MCA108L", course_name="DBMS Lab", theory_hours=0, practical_hours=4),
        ]
        self.db.add_all(subjects)
        self.db.commit()

        # Allocations: assign Subj 1, 2, 5, 7 to Fac 1 (4+4+3+4 = 15 hrs)
        # assign Subj 3, 4, 6, 8 to Fac 2 (4+4+3+4 = 15 hrs)
        f1_subjs = [(1, 4, 0), (2, 4, 0), (5, 3, 0), (7, 0, 4)]
        f2_subjs = [(3, 4, 0), (4, 4, 0), (6, 3, 0), (8, 0, 4)]

        alloc_id = 1
        for s_id, th, pr in f1_subjs:
            sa = SubjectAllocation(id=alloc_id, workspace_id=self.ws_id, section_id=100, subject_id=s_id, status=AllocationStatusEnum.FINALIZED)
            self.db.add(sa)
            self.db.flush()
            ac = AllocationComponent(allocation_id=alloc_id, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=th, practical_hours=pr)
            self.db.add(ac)
            alloc_id += 1

        for s_id, th, pr in f2_subjs:
            sa = SubjectAllocation(id=alloc_id, workspace_id=self.ws_id, section_id=100, subject_id=s_id, status=AllocationStatusEnum.FINALIZED)
            self.db.add(sa)
            self.db.flush()
            ac = AllocationComponent(allocation_id=alloc_id, faculty_id=2, role=AllocationRoleEnum.INCHARGE_1, theory_hours=th, practical_hours=pr)
            self.db.add(ac)
            alloc_id += 1

        self.db.commit()

        # Step 1: Synthesize canonical TeachingSession records
        builder = TeachingSessionBuilder(self.db)
        sessions = builder.build_sessions_for_workspace(self.ws_id)
        
        # 22 theory (1 period each) + 4 lab blocks (2 periods each) = 26 sessions, total 30 periods
        self.assertEqual(len(sessions), 26)
        total_periods = sum(s.duration_in_periods for s in sessions)
        self.assertEqual(total_periods, 30)

        # Step 2: Build KAIROS inputs via adapter
        adapter = KairosTimetableAdapter(self.db)
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_solver_inputs(
            self.ws_id, sessions, [self.r_class, self.r_lab], self.periods
        )
        self.assertEqual(k_cfg.max_daily_instr_periods, 5)

        # Step 3: Run solver pipeline
        pipeline_res = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        self.assertEqual(len(pipeline_res.violations), 0, f"Expected 0 violations, got: {pipeline_res.violations}")
        self.assertEqual(len(pipeline_res.assignments), 26)

        # Step 4: Map back to canonical TimetableEntry rows
        entries = adapter.map_assignments_to_entries(pipeline_res.assignments, sessions, timetable_version_id=1)
        self.assertEqual(len(entries), 26)

        # Step 5: Verify Full Section Occupancy (All 30 slots occupied)
        occupied_slots = set()
        for e in entries:
            for p_offset in range(e.duration_in_periods):
                slot = (e.day_index, e.start_period + p_offset)
                self.assertNotIn(slot, occupied_slots, f"Slot {slot} double-booked for section!")
                occupied_slots.add(slot)

        # All 5 days (0..4) and all 6 periods (1..6) must be occupied
        expected_slots = {(day, period) for day in range(5) for period in range(1, 7)}
        self.assertEqual(occupied_slots, expected_slots, "Section timetable is not 100% occupied!")

        # Step 6: Verify Break Protection (No 2-period session starts at P3)
        for e in entries:
            if e.duration_in_periods == 2:
                self.assertNotEqual(e.start_period, 3, "Lab session illegally started at P3 crossing the tea break!")

        # Step 7: Verify Faculty Free Period Constraint (Max 5 periods/day for each faculty)
        faculty_day_hours = {}
        for e in entries:
            key = (e.faculty_id, e.day_index)
            faculty_day_hours[key] = faculty_day_hours.get(key, 0) + e.duration_in_periods

        for (fac_id, day_idx), hours in faculty_day_hours.items():
            self.assertLessEqual(hours, 5, f"Faculty {fac_id} teaches {hours} periods on day {day_idx} (exceeds max 5, violates free period rule)!")

    def test_infeasible_schedule_fails_safely(self):
        """
        Verify that an impossible workload (e.g. 6 periods assigned to a single faculty on a day
        when max_daily_instr_periods=5, or 35 hours in a 30-hour week) causes the solver to fail
        or register violations rather than returning an invalid successful timetable.
        """
        # Subject with 32 theory hours assigned to a single faculty (exceeds 30 slots/week and max 5/day = 25 max)
        subj_huge = Subject(id=99, course_code="HUGE99", course_name="Huge Subject", theory_hours=32, practical_hours=0)
        self.db.add(subj_huge)
        self.db.commit()

        sa = SubjectAllocation(id=999, workspace_id=self.ws_id, section_id=100, subject_id=99, status=AllocationStatusEnum.FINALIZED)
        self.db.add(sa)
        self.db.flush()
        ac = AllocationComponent(allocation_id=999, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=32, practical_hours=0)
        self.db.add(ac)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        sessions = builder.build_sessions_for_workspace(self.ws_id)
        self.assertEqual(len(sessions), 32)

        adapter = KairosTimetableAdapter(self.db)
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_solver_inputs(
            self.ws_id, sessions, [self.r_class, self.r_lab], self.periods
        )

        pipeline_res = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        
        # Must report infeasible (unschedulable sections or fewer assignments than blocks)
        self.assertNotEqual(len(pipeline_res.assignments), 32, "Overconstrained problem must not report 100% placement!")


if __name__ == "__main__":
    unittest.main()
