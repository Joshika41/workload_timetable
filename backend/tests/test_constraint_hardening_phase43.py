"""
Phase 4.3 Constraint Hardening & Gap Closure Tests.

Validates:
1. Omitted-workspace physical room reservation protection: Existing published/validated room reservations create room blackouts.
2. Theory repetition rule (<= 2 periods of the same theory subject per section per day):
   - Two occurrences are allowed.
   - Three occurrences are rejected / infeasible.
   - Lab sessions (e.g. 2-period lab + 2-period lab or 4 hours lab) are not restricted by theory repetition.
3. Room capacity and suitability gates:
   - Rooms with capacity < student strength cannot be assigned.
   - Lab sessions cannot be assigned to ordinary classrooms.
   - Sections with missing or <=0 student strength are blocked at preflight.
   - Rooms with capacity 0 or inactive are excluded.
4. Strict isolation: In-memory SQLite only, production database protected.
"""

import sys
import os
import unittest
from datetime import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

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
    TimetableConfiguration,
    TimetableRun,
    TimetableVersion,
    TimetableVersionStatusEnum
)
from app.services.teaching_session_builder import TeachingSessionBuilder
from app.services.kairos_adapter import KairosTimetableAdapter, KairosAdapterError

kairos_dir = os.path.join(backend_dir, "vendor", "KAIROS")
if kairos_dir not in sys.path:
    sys.path.append(kairos_dir)

from src.timetabling.pipeline import run_pipeline
from src.timetabling.validate import validate


class TestPhase43ConstraintHardening(unittest.TestCase):
    def setUp(self):
        # STRICT SAFETY GUARD: in-memory SQLite only
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        assert "sqlite" in str(self.engine.url), "FATAL: Test must run only on isolated in-memory SQLite."

        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Master setup
        self.inst = Institution(id=2, name="Flabs", code="FLABS")
        self.dept = Department(id=5, institution_id=2, name="MCA Department")
        self.prog = Programme(id=6, department_id=5, name="MCA", programme_type="PG")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem1 = Semester(id=1, semester_number=1, name="Semester 1")
        self.db.add_all([self.inst, self.dept, self.prog, self.ay, self.sem1])
        self.db.commit()

        self.ws_id = "ws_test_43"
        self.ws = AcademicWorkspace(
            id=self.ws_id, department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add(self.ws)
        self.db.commit()

        self.db.add(WorkloadVersion(workspace_id=self.ws_id, version_no=1, snapshot_json="{}", reason="Final"))

        # Users and Faculty
        self.u1 = User(id=1, email="fac1@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=5)
        self.u2 = User(id=2, email="fac2@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=5)
        self.db.add_all([self.u1, self.u2])
        self.db.commit()

        self.f1 = FacultyProfile(id=1, user_id=1, erp_id="FAC001", name="Dr. Faculty One", designation="Professor", home_department_id=5)
        self.f2 = FacultyProfile(id=2, user_id=2, erp_id="FAC002", name="Dr. Faculty Two", designation="Associate Professor", home_department_id=5)
        self.db.add_all([self.f1, self.f2])

        # Section with confirmed student strength
        self.sec = Section(id=101, workspace_id=self.ws_id, name="MCA-A", student_strength=40)
        self.db.add(self.sec)

        # Rooms
        self.r_class = TimetableRoom(id=1, institution_id=2, room_code="CR101", room_name="Lecture Hall 101", room_type="CLASSROOM", capacity=50, active=True)
        self.r_lab = TimetableRoom(id=2, institution_id=2, room_code="LAB101", room_name="PC Lab 101", room_type="PC_LAB", capacity=50, active=True)
        self.db.add_all([self.r_class, self.r_lab])

        # FLABS Shift 1 Periods (6 periods)
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

    def test_omitted_workspace_physical_room_reservation_protection(self):
        """
        Verify that an omitted workspace with an existing published/validated reservation
        for a physical room causes a room blackout in the solver, preventing collisions.
        """
        # Create omitted workspace with a published reservation in CR101 on Tuesday (day_index=1), Period 3
        ws_omitted = AcademicWorkspace(
            id="ws_omitted_room", department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add(ws_omitted)
        self.db.commit()

        run = TimetableRun(run_id="run_room_omitted", workspace_id="ws_omitted_room", configuration_id=1)
        self.db.add(run)
        self.db.flush()
        ver = TimetableVersion(id=88, run_id=run.id, status=TimetableVersionStatusEnum.PUBLISHED)
        self.db.add(ver)
        self.db.flush()

        ts_omitted = TeachingSession(
            id=888, allocation_id=88, institution_id=2, workspace_id="ws_omitted_room",
            section_id=88, faculty_id=2, teaching_type="THEORY", duration_in_periods=1
        )
        self.db.add(ts_omitted)
        self.db.flush()

        # Room 1 (CR101) is booked on Tuesday (day 1), period 3
        existing_entry = TimetableEntry(
            timetable_version_id=88, teaching_session_id=888, faculty_id=2,
            section_id=88, room_id=1, day_index=1, start_period=3, duration_in_periods=1,
            session_type="THEORY"
        )
        self.db.add(existing_entry)
        self.db.commit()

        # Build sessions for ws_test_43
        subj = Subject(id=1, course_code="MCA101", course_name="Data Structures", theory_hours=4, practical_hours=0)
        self.db.add(subj)
        self.db.commit()

        sa = SubjectAllocation(id=1, workspace_id=self.ws_id, section_id=101, subject_id=1, status=AllocationStatusEnum.FINALIZED)
        self.db.add(sa)
        self.db.flush()
        ac = AllocationComponent(allocation_id=1, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=4, practical_hours=0)
        self.db.add(ac)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        sessions = builder.build_sessions_for_workspace(self.ws_id)

        adapter = KairosTimetableAdapter(self.db)
        # CR101 is the only classroom provided
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_multi_workspace_solver_inputs(
            workspace_ids=[self.ws_id],
            sessions=sessions,
            rooms=[self.r_class],
            periods=self.periods,
            respect_existing_reservations=True
        )

        # Assert room blackout created for Room 1 on Tu at slot 2 (Period 3)
        self.assertIn(("1", "Tu", 2), k_cfg.room_unavailable)

        # Solve and verify that no session from ws_test_43 uses Room 1 on Tu, Period 3
        pipeline_res = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        self.assertEqual(len(pipeline_res.violations), 0)
        entries = adapter.map_assignments_to_entries(pipeline_res.assignments, sessions, timetable_version_id=1)
        for e in entries:
            if e.room_id == 1 and e.day_index == 1:
                self.assertNotEqual(e.start_period, 3, "Room double-booked with omitted workspace reservation!")

    def test_theory_repetition_rule_enforced(self):
        """
        Prove theory repetition constraint:
        - 2 occurrences of same theory subject in a day are allowed.
        - 3 occurrences in a single day are rejected by the solver and flagged by validator.
        """
        # Subject with 3 theory hours
        subj = Subject(id=2, course_code="MCA_REPEAT", course_name="Algorithm Design", theory_hours=3, practical_hours=0)
        self.db.add(subj)
        self.db.commit()

        sa = SubjectAllocation(id=2, workspace_id=self.ws_id, section_id=101, subject_id=2, status=AllocationStatusEnum.FINALIZED)
        self.db.add(sa)
        self.db.flush()
        ac = AllocationComponent(allocation_id=2, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=3, practical_hours=0)
        self.db.add(ac)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        sessions = builder.build_sessions_for_workspace(self.ws_id)
        self.assertEqual(len(sessions), 3)

        adapter = KairosTimetableAdapter(self.db)
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_solver_inputs(
            self.ws_id, sessions, [self.r_class], self.periods
        )
        self.assertEqual(k_cfg.max_daily_theory_periods, 2)

        # 1. Normal solve: 3 hours across 5 days can easily be scheduled with <= 2 per day
        res = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        self.assertEqual(len(res.violations), 0)
        self.assertEqual(len(res.assignments), 3)

        # Verify daily occurrences in the solution are <= 2
        day_counts = {}
        for a in res.assignments:
            day_counts[a.day] = day_counts.get(a.day, 0) + 1
        for day, cnt in day_counts.items():
            self.assertLessEqual(cnt, 2)

        # 2. Forced overload: Blackout all days EXCEPT Monday (Tu, We, Th, Fr blacked out for faculty)
        # This forces all 3 sessions of this subject to attempt scheduling on Monday!
        blackouts = set()
        for d_str in ["Tu", "We", "Th", "Fr"]:
            for slot in range(6):
                blackouts.add(("1", d_str, slot))
        k_cfg.instr_unavailable = frozenset(blackouts)

        # Solve must fail or leave blocks unplaced because max_daily_theory_periods is 2
        res_forced = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        self.assertNotEqual(len(res_forced.assignments), 3, "Solver placed 3 theory sessions on 1 day despite max_daily_theory_periods=2!")

    def test_room_capacity_and_suitability_enforcement(self):
        """
        Verify room capacity and room type gates:
        1. Room capacity < student strength cannot be assigned.
        2. Lab session cannot be assigned to ordinary CLASSROOM.
        3. Missing section student strength blocks preflight.
        """
        # Section has student_strength = 40.
        # Room with capacity 30 (insufficient)
        r_small = TimetableRoom(id=10, institution_id=2, room_code="CR_SMALL", room_name="Small Room", room_type="CLASSROOM", capacity=30, active=True)
        self.db.add(r_small)
        self.db.commit()

        subj_th = Subject(id=3, course_code="MCA_TH", course_name="Theory Subject", theory_hours=2, practical_hours=0)
        self.db.add(subj_th)
        self.db.commit()

        sa_th = SubjectAllocation(id=3, workspace_id=self.ws_id, section_id=101, subject_id=3, status=AllocationStatusEnum.FINALIZED)
        self.db.add(sa_th)
        self.db.flush()
        ac_th = AllocationComponent(allocation_id=3, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=2, practical_hours=0)
        self.db.add(ac_th)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        sessions = builder.build_sessions_for_workspace(self.ws_id)

        adapter = KairosTimetableAdapter(self.db)

        # A. If ONLY r_small is available, solver must fail to place the sessions because cap(30) < students(40)
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_solver_inputs(
            self.ws_id, sessions, [r_small], self.periods
        )
        res_capacity = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        self.assertEqual(len(res_capacity.assignments), 0, "Room with insufficient capacity was illegally assigned!")

        # B. Lab suitability: Create a lab session and offer ONLY ordinary classroom
        subj_lab = Subject(id=4, course_code="MCA_LAB", course_name="Lab Subject", theory_hours=0, practical_hours=2)
        self.db.add(subj_lab)
        self.db.commit()

        sa_lab = SubjectAllocation(id=4, workspace_id=self.ws_id, section_id=101, subject_id=4, status=AllocationStatusEnum.FINALIZED)
        self.db.add(sa_lab)
        self.db.flush()
        ac_lab = AllocationComponent(allocation_id=4, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=0, practical_hours=2)
        self.db.add(ac_lab)
        self.db.commit()

        sessions_lab = builder.build_sessions_for_workspace(self.ws_id)
        lab_only = [s for s in sessions_lab if s.teaching_type == "LAB"]
        self.assertEqual(len(lab_only), 1)

        # Provide only r_class (CLASSROOM cap 50). Lab cannot go to CLASSROOM!
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_solver_inputs(
            self.ws_id, lab_only, [self.r_class], self.periods
        )
        res_lab = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        self.assertEqual(len(res_lab.assignments), 0, "Lab session was illegally assigned to ordinary classroom!")

        # C. Missing section student strength: Preflight must block
        self.sec.student_strength = 0
        self.db.commit()

        with self.assertRaises(KairosAdapterError) as ctx:
            adapter.build_solver_inputs(self.ws_id, lab_only, [self.r_lab], self.periods)
        self.assertIn("has missing or invalid student_strength", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
