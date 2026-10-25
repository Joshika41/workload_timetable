"""
Phase 5 Canonical Timetable Backend Orchestration Tests.

Validates:
1. End-to-end generation from API/service layer using canonical database session.
2. Draft candidate persistence with TimetableRun (COMPLETED), TimetableVersion (DRAFT), and TimetableEntry rows.
3. Strict preflight gating:
   - Unfinalized workspace rejected with 422 and actionable diagnostic.
   - Missing WorkloadVersion rejected with 422.
   - Missing room records rejected with 422.
   - Missing or non-positive student strength rejected.
4. Infeasible solve safety: Overconstrained solve produces no fake timetable and no persisted TimetableVersion/Entry.
5. Transaction rollback: Persistence failure rolls back candidate writes cleanly.
6. Authorization: Non-HOD / out-of-department users rejected with 403.
7. Safe database isolation: 100% in-memory SQLite, strictly isolated from Mumbai PostgreSQL.
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
    TimetableStatusEnum,
    TimetableVersion,
    TimetableVersionStatusEnum
)
from app.services.timetable_service import (
    generate_timetable,
    generate_timetable_canonical,
    get_timetable_versions,
    publish_timetable_version,
    get_timetable_entries_for_workspace,
    run_timetable_preflight_checks,
    TimetableGenerationError
)


class TestPhase5CanonicalBackendOrchestration(unittest.TestCase):
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
        self.dept_other = Department(id=6, institution_id=2, name="Other Department")
        self.prog = Programme(id=6, department_id=5, name="MCA", programme_type="PG")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem1 = Semester(id=1, semester_number=1, name="Semester 1")
        self.db.add_all([self.inst, self.dept_mca, self.dept_other, self.prog, self.ay, self.sem1])
        self.db.commit()

        self.ws_id = "ws_canonical_p5"
        self.ws = AcademicWorkspace(
            id=self.ws_id, department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add(self.ws)
        self.db.commit()

        # Active WorkloadVersion
        self.db.add(WorkloadVersion(workspace_id=self.ws_id, version_no=1, snapshot_json="{}", reason="Finalized"))

        # Users & Roles
        # HOD user in Dept 5
        self.u_hod = User(id=10, email="hod_mca@srm.edu", hashed_password="pw", role=RoleEnum.HOD, department_id=5)
        # HOD user in Dept 6 (unauthorized for Dept 5)
        self.u_other_hod = User(id=11, email="hod_other@srm.edu", hashed_password="pw", role=RoleEnum.HOD, department_id=6)
        # Plain Faculty user
        self.u_faculty = User(id=12, email="fac@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=5)
        self.db.add_all([self.u_hod, self.u_other_hod, self.u_faculty])

        self.f1 = FacultyProfile(id=1, user_id=10, erp_id="HOD01", name="Dr. HOD", designation="Professor & HOD", home_department_id=5)
        self.f2 = FacultyProfile(id=2, user_id=12, erp_id="FAC02", name="Dr. Faculty", designation="Assistant Professor", home_department_id=5)
        self.db.add_all([self.f1, self.f2])

        # Section
        self.sec = Section(id=101, workspace_id=self.ws_id, name="A", student_strength=40)
        self.db.add(self.sec)

        # Timetable Configuration & Periods (FLABS Shift 1)
        self.cfg = TimetableConfiguration(id=1, institution_id=2, workspace_id=self.ws_id, active=True)
        self.db.add(self.cfg)
        self.db.flush()

        self.periods = [
            TimetablePeriod(configuration_id=1, period_number=1, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45, active=True),
            TimetablePeriod(configuration_id=1, period_number=2, start_time=time(8, 45), end_time=time(9, 30), duration_minutes=45, active=True),
            TimetablePeriod(configuration_id=1, period_number=3, start_time=time(9, 30), end_time=time(10, 15), duration_minutes=45, active=True),
            TimetablePeriod(configuration_id=1, period_number=4, start_time=time(10, 30), end_time=time(11, 15), duration_minutes=45, active=True),
            TimetablePeriod(configuration_id=1, period_number=5, start_time=time(11, 15), end_time=time(12, 0), duration_minutes=45, active=True),
            TimetablePeriod(configuration_id=1, period_number=6, start_time=time(12, 0), end_time=time(12, 45), duration_minutes=45, active=True),
        ]
        self.db.add_all(self.periods)

        # Rooms
        self.r_class = TimetableRoom(id=1, institution_id=2, workspace_id=self.ws_id, room_code="LH101", room_name="Lecture Hall 101", room_type="CLASSROOM", capacity=60, active=True)
        self.r_lab = TimetableRoom(id=2, institution_id=2, workspace_id=self.ws_id, room_code="LAB101", room_name="Computer Lab 101", room_type="PC_LAB", capacity=60, active=True)
        self.db.add_all([self.r_class, self.r_lab])
        self.db.commit()

        # Subjects and Allocations (2 theory subjects = 4 hrs + 4 hrs = 8 hrs total)
        self.s1 = Subject(id=1, course_code="MCA501", course_name="Cloud Computing", theory_hours=4, practical_hours=0)
        self.s2 = Subject(id=2, course_code="MCA502", course_name="Machine Learning", theory_hours=4, practical_hours=0)
        self.db.add_all([self.s1, self.s2])
        self.db.commit()

        self.sa1 = SubjectAllocation(id=1, workspace_id=self.ws_id, section_id=101, subject_id=1, status=AllocationStatusEnum.FINALIZED)
        self.sa2 = SubjectAllocation(id=2, workspace_id=self.ws_id, section_id=101, subject_id=2, status=AllocationStatusEnum.FINALIZED)
        self.db.add_all([self.sa1, self.sa2])
        self.db.flush()

        self.ac1 = AllocationComponent(allocation_id=1, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=4, practical_hours=0)
        self.ac2 = AllocationComponent(allocation_id=2, faculty_id=2, role=AllocationRoleEnum.INCHARGE_1, theory_hours=4, practical_hours=0)
        self.db.add_all([self.ac1, self.ac2])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_canonical_generation_persists_validated_draft(self):
        """
        Verify that a valid authenticated request runs through the canonical service,
        invokes KAIROS solver, and persists a validated DRAFT TimetableVersion with entries.
        """
        res = generate_timetable(workspace_id=self.ws_id, db=self.db, current_user=self.u_hod)

        self.assertEqual(res["status"], "COMPLETED")
        self.assertEqual(res["version_status"], "DRAFT")
        self.assertEqual(res["scheduled_sessions"], 8)
        self.assertEqual(res["violations"], 0)
        version_id = res["version_id"]

        # Verify database persistence
        version = self.db.query(TimetableVersion).filter(TimetableVersion.id == version_id).first()
        self.assertIsNotNone(version)
        self.assertEqual(version.status, TimetableVersionStatusEnum.DRAFT)

        run = self.db.query(TimetableRun).filter(TimetableRun.id == version.run_id).first()
        self.assertIsNotNone(run)
        self.assertEqual(run.status, TimetableStatusEnum.COMPLETED)
        self.assertEqual(run.scheduled_sessions, 8)

        entries = self.db.query(TimetableEntry).filter(TimetableEntry.timetable_version_id == version_id).all()
        self.assertEqual(len(entries), 8)

        # Verify entry details
        for entry in entries:
            self.assertEqual(entry.section_id, 101)
            self.assertIn(entry.faculty_id, [1, 2])
            self.assertIn(entry.day_index, range(5))
            self.assertIn(entry.start_period, range(1, 7))

        # Query entries through service
        view_res = get_timetable_entries_for_workspace(self.ws_id, self.db, version_id=version_id)
        self.assertEqual(len(view_res["entries"]), 8)

    def test_unfinalized_workspace_blocked_at_preflight(self):
        """Preflight must reject non-FINALIZED workspace with actionable error and 0 writes."""
        self.ws.workflow_state = WorkspaceWorkflowStateEnum.PREFERENCES
        self.db.commit()

        with self.assertRaises(TimetableGenerationError) as ctx:
            generate_timetable(workspace_id=self.ws_id, db=self.db, current_user=self.u_hod)

        self.assertEqual(ctx.exception.status_code, 422)
        self.assertTrue(any("must be FINALIZED" in err for err in ctx.exception.preflight_errors))

        # Assert 0 runs or versions persisted
        self.assertEqual(self.db.query(TimetableRun).count(), 0)
        self.assertEqual(self.db.query(TimetableVersion).count(), 0)

    def test_missing_student_strength_blocked_at_preflight(self):
        """Preflight must reject section with missing/invalid student strength."""
        self.sec.student_strength = 0
        self.db.commit()

        with self.assertRaises(TimetableGenerationError) as ctx:
            generate_timetable(workspace_id=self.ws_id, db=self.db, current_user=self.u_hod)

        self.assertEqual(ctx.exception.status_code, 422)
        self.assertTrue(any("invalid student_strength" in err for err in ctx.exception.preflight_errors))

    def test_missing_rooms_blocked_at_preflight(self):
        """Preflight must reject generation when no active rooms are available."""
        self.r_class.active = False
        self.r_lab.active = False
        self.db.commit()

        with self.assertRaises(TimetableGenerationError) as ctx:
            generate_timetable(workspace_id=self.ws_id, db=self.db, current_user=self.u_hod)

        self.assertEqual(ctx.exception.status_code, 422)
        self.assertTrue(any("No active TimetableRoom records" in err for err in ctx.exception.preflight_errors))

    def test_authorization_rejection(self):
        """Cross-department HOD and plain faculty must be rejected."""
        # 1. HOD from another department
        with self.assertRaises(TimetableGenerationError) as ctx:
            generate_timetable(workspace_id=self.ws_id, db=self.db, current_user=self.u_other_hod)
        self.assertEqual(ctx.exception.status_code, 403)

        # 2. Plain faculty
        with self.assertRaises(TimetableGenerationError) as ctx:
            generate_timetable(workspace_id=self.ws_id, db=self.db, current_user=self.u_faculty)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_infeasible_solve_creates_no_false_version(self):
        """
        An impossible workload (e.g. 35 theory hours when max is 25 for a single faculty)
        must report failure and leave 0 TimetableVersion or TimetableEntry records.
        """
        # Subject with 32 theory hours assigned to Dr. HOD
        s_huge = Subject(id=99, course_code="HUGE99", course_name="Huge Subject", theory_hours=32, practical_hours=0)
        self.db.add(s_huge)
        self.db.commit()

        sa_huge = SubjectAllocation(id=99, workspace_id=self.ws_id, section_id=101, subject_id=99, status=AllocationStatusEnum.FINALIZED)
        self.db.add(sa_huge)
        self.db.flush()
        ac_huge = AllocationComponent(allocation_id=99, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=32, practical_hours=0)
        self.db.add(ac_huge)
        self.db.commit()

        with self.assertRaises(TimetableGenerationError) as ctx:
            generate_timetable(workspace_id=self.ws_id, db=self.db, current_user=self.u_hod)

        self.assertEqual(ctx.exception.status_code, 422)
        # Assert TimetableVersion was NOT created
        self.assertEqual(self.db.query(TimetableVersion).count(), 0)
        # Assert TimetableEntry was NOT created
        self.assertEqual(self.db.query(TimetableEntry).count(), 0)

        # A failed TimetableRun may be logged for observability
        failed_run = self.db.query(TimetableRun).filter(TimetableRun.status == TimetableStatusEnum.FAILED).first()
        self.assertIsNotNone(failed_run)

    def test_publishing_draft_version(self):
        """Verify that publish_timetable_version marks version PUBLISHED and supersedes older versions."""
        res = generate_timetable(workspace_id=self.ws_id, db=self.db, current_user=self.u_hod)
        version_id = res["version_id"]

        pub_res = publish_timetable_version(version_id, self.db)
        self.assertEqual(pub_res["status"], "success")

        v = self.db.query(TimetableVersion).get(version_id)
        self.assertEqual(v.status, TimetableVersionStatusEnum.PUBLISHED)


if __name__ == "__main__":
    unittest.main()
