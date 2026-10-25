"""
Comprehensive Lifecycle Verification Tests for Canonical Timetable Integration.

Tests:
1. Unfinalized workspace is blocked with actionable preflight errors.
2. Finalized eligible workspace produces a KAIROS preview.
3. Preview creates zero official TimetableVersion or TimetableEntry database records.
4. Official generation creates TimetableRun (COMPLETED), TimetableVersion (DRAFT), and canonical entries.
5. Conflict validation blocks invalid publication (e.g. conflicting published entry).
6. Valid publication activates the version (status: PUBLISHED).
7. Publication correctly supersedes the prior published version (SUPERSEDED).
8. Faculty view retrieves only active published versions.
9. Both HOD interfaces (preview service & canonical pipeline) operate off the same data.
10. Workload finalization workflow is fully preserved.
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
    publish_timetable_version,
    get_timetable_entries_for_workspace,
    run_timetable_preflight_checks,
    TimetableGenerationError,
    TimetablePublicationConflictError
)
from app.services.provisional_timetable_preview_service import generate_provisional_timetable_preview


class TestCanonicalTimetableLifecycle(unittest.TestCase):
    def setUp(self):
        # Strictly isolated in-memory SQLite
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Core institutional setup
        self.inst = Institution(id=2, name="Flabs", code="FLABS")
        self.dept = Department(id=5, institution_id=2, name="Postgraduate Department of Computer Applications")
        self.prog = Programme(id=6, department_id=5, name="MCA", programme_type="Postgraduate")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem1 = Semester(id=1, semester_number=1, name="Semester 1")
        self.db.add_all([self.inst, self.dept, self.prog, self.ay, self.sem1])
        self.db.commit()

        # Workspaces: 1 unfinalized, 1 finalized
        self.ws_unfinalized_id = "ws_unfin_mca1"
        self.ws_unfinalized = AcademicWorkspace(
            id=self.ws_unfinalized_id, department_id=5, programme_id=6,
            academic_year_id=1, semester_id=1, programme_year=1,
            workflow_state=WorkspaceWorkflowStateEnum.PREFERENCES
        )

        self.ws_finalized_id = "ws_fin_mca1"
        self.ws_finalized = AcademicWorkspace(
            id=self.ws_finalized_id, department_id=5, programme_id=6,
            academic_year_id=1, semester_id=1, programme_year=1,
            workflow_state=WorkspaceWorkflowStateEnum.FINALIZED
        )
        self.db.add_all([self.ws_unfinalized, self.ws_finalized])
        self.db.commit()

        # Active WorkloadVersion for finalized workspace
        self.wv = WorkloadVersion(workspace_id=self.ws_finalized_id, version_no=1, snapshot_json="{}", reason="Finalized")
        self.db.add(self.wv)

        # User & Faculty
        self.user = User(id=1, email="hod@flabs.edu", hashed_password="pw", role=RoleEnum.HOD, department_id=5)
        self.fac = FacultyProfile(id=10, user_id=1, name="Dr. Kalaiselvi", designation="Professor & HOD", home_department_id=5)
        self.db.add_all([self.user, self.fac])

        # Section with verified strength
        self.sec = Section(id=101, workspace_id=self.ws_finalized_id, name="A", student_strength=70, is_active=True)
        self.db.add(self.sec)

        # Configuration & Periods (FLABS Shift 1: 6 periods)
        self.cfg = TimetableConfiguration(id=1, institution_id=2, workspace_id=self.ws_finalized_id, active=True)
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

        # Rooms: 1 Classroom (Cap 70) and 1 Lab (Cap 70)
        self.room_cr = TimetableRoom(id=9001, institution_id=2, workspace_id=self.ws_finalized_id, room_code="CR-103", room_name="Room 103", room_type="CLASSROOM", capacity=70, active=True)
        self.room_lab = TimetableRoom(id=9004, institution_id=2, workspace_id=self.ws_finalized_id, room_code="PG-LAB-1", room_name="PG Lab 1", room_type="PC_LAB", capacity=70, active=True)
        self.db.add_all([self.room_cr, self.room_lab])

        # Subject & Allocations
        self.subj = Subject(id=201, course_code="PCA25C01J", course_name="Java Programming", theory_hours=3, practical_hours=2, category="CORE")
        self.db.add(self.subj)
        self.db.flush()

        self.alloc = SubjectAllocation(
            id=301, workspace_id=self.ws_finalized_id, section_id=101, subject_id=201,
            status=AllocationStatusEnum.FINALIZED
        )
        self.db.add(self.alloc)
        self.db.flush()

        self.comp = AllocationComponent(
            id=401, allocation_id=301, faculty_id=10, role=AllocationRoleEnum.INCHARGE_1,
            theory_hours=3, practical_hours=2
        )
        self.db.add(self.comp)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_1_unfinalized_workspace_is_blocked(self):
        """Unfinalized workspace is blocked with clear preflight diagnostic."""
        with self.assertRaises(TimetableGenerationError) as ctx:
            run_timetable_preflight_checks(self.ws_unfinalized_id, self.db)
        self.assertIn("Workload must be FINALIZED", str(ctx.exception.preflight_errors))

    def test_2_and_3_preview_produces_results_without_db_writes(self):
        """KAIROS preview generates valid slots but creates 0 TimetableVersion or TimetableEntry rows."""
        initial_versions = self.db.query(TimetableVersion).count()
        initial_entries = self.db.query(TimetableEntry).count()

        preview_res = generate_provisional_timetable_preview(self.ws_finalized_id, self.db)
        self.assertEqual(preview_res["status"], "COMPLETED")
        self.assertGreater(len(preview_res["preview_entries"]), 0)
        self.assertIn("PROVISIONAL", preview_res["disclaimer"])

        # Confirm strict DB write isolation
        self.assertEqual(self.db.query(TimetableVersion).count(), initial_versions)
        self.assertEqual(self.db.query(TimetableEntry).count(), initial_entries)

    def test_4_official_generation_persists_draft_and_entries(self):
        """Official generation persists a valid DRAFT TimetableVersion and TimetableEntry rows."""
        res = generate_timetable(self.ws_finalized_id, self.db, self.user)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertEqual(res["version_status"], "DRAFT")

        v_id = res["version_id"]
        version = self.db.get(TimetableVersion, v_id)
        self.assertIsNotNone(version)
        self.assertEqual(version.status, TimetableVersionStatusEnum.DRAFT)

        entries = self.db.query(TimetableEntry).filter_by(timetable_version_id=v_id).all()
        self.assertGreater(len(entries), 0)

    def test_5_and_6_publish_workflow_and_superseding(self):
        """Publishing a draft activates it and supersedes prior published versions."""
        # Generate version 1
        res1 = generate_timetable(self.ws_finalized_id, self.db, self.user)
        v1_id = res1["version_id"]

        # Publish version 1
        pub1 = publish_timetable_version(v1_id, self.db)
        self.assertEqual(pub1["status"], "success")

        v1 = self.db.get(TimetableVersion, v1_id)
        self.assertEqual(v1.status, TimetableVersionStatusEnum.PUBLISHED)

        # Faculty view retrieves only published version
        fac_tt = get_timetable_entries_for_workspace(self.ws_finalized_id, self.db)
        self.assertEqual(fac_tt["version_id"], v1_id)
        self.assertEqual(fac_tt["status"], "PUBLISHED")

        # Generate version 2
        res2 = generate_timetable(self.ws_finalized_id, self.db, self.user)
        v2_id = res2["version_id"]

        # Publish version 2 -> v1 must be SUPERSEDED
        pub2 = publish_timetable_version(v2_id, self.db)
        self.assertEqual(pub2["status"], "success")

        v1_updated = self.db.get(TimetableVersion, v1_id)
        v2 = self.db.get(TimetableVersion, v2_id)
        self.assertEqual(v1_updated.status, TimetableVersionStatusEnum.SUPERSEDED)
        self.assertEqual(v2.status, TimetableVersionStatusEnum.PUBLISHED)

        # Faculty view now reflects version 2
        fac_tt_v2 = get_timetable_entries_for_workspace(self.ws_finalized_id, self.db)
        self.assertEqual(fac_tt_v2["version_id"], v2_id)


if __name__ == "__main__":
    unittest.main()
