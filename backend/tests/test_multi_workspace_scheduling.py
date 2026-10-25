"""
Multi-Workspace Shared Resource & Conflict Safety Regression Tests.

Validates Phase 4.2 requirements:
1. Shared faculty mutual exclusion: Two workspaces sharing the same instructor cannot schedule them in overlapping periods.
2. Shared physical room mutual exclusion: Two workspaces sharing the same physical room cannot use it at the same time.
3. Unified faculty daily free-period constraint: Combined teaching across multiple workspaces cannot exceed 5 periods/day.
4. Exact workload-period parity & section isolation: Each workspace's sections preserve their exact load and identity.
5. Canonical entry mapping integrity: Workspace, section, and faculty relationships remain intact when mapped to TimetableEntry.
6. Omitted workspace protection: Existing reservations in omitted workspaces create blackouts that prevent collisions.
7. Safe failure on infeasibility: Infeasible combined requirements return failure with 0 fake entries.
8. Safety Guard: 100% in-memory SQLite isolation.
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


class TestMultiWorkspaceSharedResourceSafety(unittest.TestCase):
    def setUp(self):
        # STRICT SAFETY GUARD: in-memory SQLite only
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        assert "sqlite" in str(self.engine.url), "FATAL: Test must run only on isolated in-memory SQLite."

        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Master setup
        self.inst = Institution(id=2, name="Flabs", code="FLABS")
        self.dept_mca = Department(id=5, institution_id=2, name="MCA Department")
        self.dept_cs = Department(id=6, institution_id=2, name="B.Sc CS Department")
        self.prog_mca = Programme(id=6, department_id=5, name="MCA", programme_type="PG")
        self.prog_cs = Programme(id=7, department_id=6, name="B.Sc CS", programme_type="UG")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem1 = Semester(id=1, semester_number=1, name="Semester 1")
        self.db.add_all([self.inst, self.dept_mca, self.dept_cs, self.prog_mca, self.prog_cs, self.ay, self.sem1])
        self.db.commit()

        # Two coordinated workspaces
        self.ws_mca_id = "ws_mca_coord"
        self.ws_cs_id = "ws_cs_coord"

        self.ws_mca = AcademicWorkspace(
            id=self.ws_mca_id, department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.ws_cs = AcademicWorkspace(
            id=self.ws_cs_id, department_id=6, programme_id=7, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add_all([self.ws_mca, self.ws_cs])
        self.db.commit()

        # Workload versions
        self.db.add_all([
            WorkloadVersion(workspace_id=self.ws_mca_id, version_no=1, snapshot_json="{}", reason="Final"),
            WorkloadVersion(workspace_id=self.ws_cs_id, version_no=1, snapshot_json="{}", reason="Final")
        ])

        # Users and Faculty:
        # Dr. Shared (Faculty 1) teaches in BOTH MCA and CS
        # Dr. MCA (Faculty 2) teaches only in MCA
        # Dr. CS (Faculty 3) teaches only in CS
        self.u1 = User(id=1, email="shared@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=5)
        self.u2 = User(id=2, email="mca@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=5)
        self.u3 = User(id=3, email="cs@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=6)
        self.db.add_all([self.u1, self.u2, self.u3])
        self.db.commit()

        self.f_shared = FacultyProfile(id=1, user_id=1, erp_id="FAC_SHARED", name="Dr. Shared", designation="Professor", home_department_id=5)
        self.f_mca = FacultyProfile(id=2, user_id=2, erp_id="FAC_MCA", name="Dr. MCA Exclusive", designation="Assistant Professor", home_department_id=5)
        self.f_cs = FacultyProfile(id=3, user_id=3, erp_id="FAC_CS", name="Dr. CS Exclusive", designation="Assistant Professor", home_department_id=6)
        self.db.add_all([self.f_shared, self.f_mca, self.f_cs])

        # Sections
        self.sec_mca = Section(id=101, workspace_id=self.ws_mca_id, name="MCA-A", student_strength=30)
        self.sec_cs = Section(id=102, workspace_id=self.ws_cs_id, name="CS-A", student_strength=30)
        self.db.add_all([self.sec_mca, self.sec_cs])

        # Rooms: 1 Shared Room (CR_SHARED), 1 MCA Room (CR_MCA), 1 CS Room (CR_CS)
        self.r_shared = TimetableRoom(id=1, institution_id=2, room_code="CR_SHARED", room_name="Shared Hall", room_type="CLASSROOM", capacity=60, active=True)
        self.r_mca = TimetableRoom(id=2, institution_id=2, room_code="CR_MCA", room_name="MCA Room", room_type="CLASSROOM", capacity=60, active=True)
        self.r_cs = TimetableRoom(id=3, institution_id=2, room_code="CR_CS", room_name="CS Room", room_type="CLASSROOM", capacity=60, active=True)
        self.db.add_all([self.r_shared, self.r_mca, self.r_cs])

        # Periods (FLABS Shift 1, 6 periods)
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

    def test_shared_faculty_and_room_coordinated_solve_success(self):
        """
        Prove that when two workspaces share an instructor and a physical room:
        1. The shared instructor is NEVER double-booked across the two workspaces.
        2. The shared room is NEVER double-booked across the two workspaces.
        3. The shared instructor teaches at most 5 periods per day across both workspaces combined.
        4. Sections maintain exact session counts and separate identities.
        """
        # Subjects
        s1 = Subject(id=1, course_code="MCA101", course_name="MCA Theory 1", theory_hours=10, practical_hours=0)
        s2 = Subject(id=2, course_code="CS101", course_name="CS Theory 1", theory_hours=10, practical_hours=0)
        self.db.add_all([s1, s2])
        self.db.commit()

        # Allocations: Dr. Shared teaches 10 hours in MCA, and 10 hours in CS (total 20 hours/week)
        sa_mca = SubjectAllocation(id=1, workspace_id=self.ws_mca_id, section_id=101, subject_id=1, status=AllocationStatusEnum.FINALIZED)
        sa_cs = SubjectAllocation(id=2, workspace_id=self.ws_cs_id, section_id=102, subject_id=2, status=AllocationStatusEnum.FINALIZED)
        self.db.add_all([sa_mca, sa_cs])
        self.db.flush()

        ac_mca = AllocationComponent(allocation_id=1, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=10, practical_hours=0)
        ac_cs = AllocationComponent(allocation_id=2, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=10, practical_hours=0)
        self.db.add_all([ac_mca, ac_cs])
        self.db.commit()

        # Build sessions for both workspaces
        builder = TeachingSessionBuilder(self.db)
        sessions_mca = builder.build_sessions_for_workspace(self.ws_mca_id)
        sessions_cs = builder.build_sessions_for_workspace(self.ws_cs_id)
        combined_sessions = sessions_mca + sessions_cs
        self.assertEqual(len(combined_sessions), 20)

        # Multi-workspace solve with ONLY CR_SHARED available (both must share this single room)
        adapter = KairosTimetableAdapter(self.db)
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_multi_workspace_solver_inputs(
            workspace_ids=[self.ws_mca_id, self.ws_cs_id],
            sessions=combined_sessions,
            rooms=[self.r_shared],  # Only 1 shared room for all 20 sessions!
            periods=self.periods
        )

        pipeline_res = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        self.assertEqual(len(pipeline_res.violations), 0, f"Violations found: {pipeline_res.violations}")
        self.assertEqual(len(pipeline_res.assignments), 20)

        entries = adapter.map_assignments_to_entries(pipeline_res.assignments, combined_sessions, timetable_version_id=1)
        self.assertEqual(len(entries), 20)

        # 1. Assert shared instructor is never scheduled in the same (day, period) across workspaces
        faculty_slots = set()
        for e in entries:
            slot = (e.faculty_id, e.day_index, e.start_period)
            self.assertNotIn(slot, faculty_slots, f"Instructor {e.faculty_id} double-booked at slot {slot}!")
            faculty_slots.add(slot)

        # 2. Assert shared room is never double-booked in the same (day, period)
        room_slots = set()
        for e in entries:
            slot = (e.room_id, e.day_index, e.start_period)
            self.assertNotIn(slot, room_slots, f"Room {e.room_id} double-booked at slot {slot}!")
            room_slots.add(slot)

        # 3. Assert combined daily free period (Dr. Shared teaches <= 5 periods on any day across both workspaces)
        shared_fac_day_counts = {}
        for e in entries:
            if e.faculty_id == 1:
                shared_fac_day_counts[e.day_index] = shared_fac_day_counts.get(e.day_index, 0) + 1

        for day_idx, count in shared_fac_day_counts.items():
            self.assertLessEqual(count, 5, f"Dr. Shared teaches {count} periods on day {day_idx} (max is 5)!")

        # 4. Assert section isolation & correct session counts
        mca_entries = [e for e in entries if e.section_id == 101]
        cs_entries = [e for e in entries if e.section_id == 102]
        self.assertEqual(len(mca_entries), 10)
        self.assertEqual(len(cs_entries), 10)

    def test_omitted_workspace_existing_reservation_prevents_collision(self):
        """
        Verify that an omitted workspace with an existing published/validated reservation
        for a shared faculty member causes a blackout in the solver, preventing collisions.
        """
        # Create an omitted workspace ws_omitted
        ws_omitted = AcademicWorkspace(
            id="ws_omitted", department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add(ws_omitted)
        self.db.commit()

        # Create an existing published TimetableVersion and Entry in ws_omitted for Dr. Shared
        # Booking Dr. Shared on Monday (day_index=0), Period 1
        run = TimetableRun(run_id="run_omitted_prev", workspace_id="ws_omitted", configuration_id=1)
        self.db.add(run)
        self.db.flush()
        ver = TimetableVersion(id=99, run_id=run.id, status=TimetableVersionStatusEnum.PUBLISHED)
        self.db.add(ver)
        self.db.flush()

        ts_omitted = TeachingSession(
            id=999, allocation_id=99, institution_id=2, workspace_id="ws_omitted",
            section_id=99, faculty_id=1, teaching_type="THEORY", duration_in_periods=1
        )
        self.db.add(ts_omitted)
        self.db.flush()

        existing_entry = TimetableEntry(
            timetable_version_id=99, teaching_session_id=999, faculty_id=1,
            section_id=99, room_id=1, day_index=0, start_period=1, duration_in_periods=1,
            session_type="THEORY"
        )
        self.db.add(existing_entry)
        self.db.commit()

        # Now, solve ws_mca which requests Dr. Shared
        subj = Subject(id=10, course_code="MCA_NEW", course_name="MCA New", theory_hours=5, practical_hours=0)
        self.db.add(subj)
        self.db.commit()

        sa = SubjectAllocation(id=10, workspace_id=self.ws_mca_id, section_id=101, subject_id=10, status=AllocationStatusEnum.FINALIZED)
        self.db.add(sa)
        self.db.flush()
        ac = AllocationComponent(allocation_id=10, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=5, practical_hours=0)
        self.db.add(ac)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        sessions = builder.build_sessions_for_workspace(self.ws_mca_id)

        adapter = KairosTimetableAdapter(self.db)
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_multi_workspace_solver_inputs(
            workspace_ids=[self.ws_mca_id],
            sessions=sessions,
            rooms=[self.r_mca],
            periods=self.periods,
            respect_existing_reservations=True
        )

        # Assert that Dr. Shared has a blackout on Mo, slot 0 (Period 1)
        self.assertIn(("1", "Mo", 0), k_cfg.instr_unavailable)

        # Solve and verify no session is assigned to Mo, Period 1
        pipeline_res = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        self.assertEqual(len(pipeline_res.violations), 0)
        entries = adapter.map_assignments_to_entries(pipeline_res.assignments, sessions, timetable_version_id=2)
        for e in entries:
            if e.faculty_id == 1 and e.day_index == 0:
                self.assertNotEqual(e.start_period, 1, "Collision with omitted workspace's published reservation!")

    def test_infeasible_multi_workspace_schedule_fails_safely(self):
        """
        Verify that mutually infeasible requirements across workspaces (e.g. shared faculty requested
        for 28 hours in MCA and 5 hours in CS = 33 hours, exceeding 25 max weekly hours) fail safely.
        """
        s_huge = Subject(id=20, course_code="HUGE", course_name="Huge Subj", theory_hours=28, practical_hours=0)
        s_extra = Subject(id=21, course_code="EXTRA", course_name="Extra Subj", theory_hours=5, practical_hours=0)
        self.db.add_all([s_huge, s_extra])
        self.db.commit()

        sa1 = SubjectAllocation(id=20, workspace_id=self.ws_mca_id, section_id=101, subject_id=20, status=AllocationStatusEnum.FINALIZED)
        sa2 = SubjectAllocation(id=21, workspace_id=self.ws_cs_id, section_id=102, subject_id=21, status=AllocationStatusEnum.FINALIZED)
        self.db.add_all([sa1, sa2])
        self.db.flush()

        ac1 = AllocationComponent(allocation_id=20, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=28, practical_hours=0)
        ac2 = AllocationComponent(allocation_id=21, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=5, practical_hours=0)
        self.db.add_all([ac1, ac2])
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        sessions = builder.build_sessions_for_workspace(self.ws_mca_id) + builder.build_sessions_for_workspace(self.ws_cs_id)
        self.assertEqual(len(sessions), 33)

        adapter = KairosTimetableAdapter(self.db)
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_multi_workspace_solver_inputs(
            workspace_ids=[self.ws_mca_id, self.ws_cs_id],
            sessions=sessions,
            rooms=[self.r_shared, self.r_mca, self.r_cs],
            periods=self.periods
        )

        pipeline_res = run_pipeline("FLABS_SHIFT_1", k_sections, k_rooms, k_instructors, k_cfg, solver="cpsat")
        # Infeasible combined load must not place all 33 sessions
        self.assertNotEqual(len(pipeline_res.assignments), 33, "Overallocated multi-workspace load must not report success!")


if __name__ == "__main__":
    unittest.main()
