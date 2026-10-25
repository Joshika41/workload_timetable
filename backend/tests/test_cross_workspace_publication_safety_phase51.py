"""
Phase 5.1 Cross-Workspace Publication Safety & Coordinated Generation Tests.

Validates:
1. Publication Final Safety Gate:
   - A draft conflicting with an existing PUBLISHED version on shared faculty is rejected with 409 and not published.
   - A draft conflicting with an existing PUBLISHED version on shared physical room is rejected with 409 and not published.
   - Failed publication does not mutate or supersede older published versions.
   - A non-conflicting draft publishes successfully and supersedes older versions of the same workspace.
2. Coordinated Multi-Workspace Canonical Generation:
   - Coordinated generation across two workspaces produces non-overlapping assignments for shared faculty and rooms.
   - Both drafts can be published without conflicting with one another.
3. Transactional safety: All checks run on isolated in-memory SQLite with zero production mutations.
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
    generate_multi_workspace_timetable,
    publish_timetable_version,
    TimetablePublicationConflictError,
    TimetableGenerationError
)


class TestPhase51CrossWorkspacePublicationSafety(unittest.TestCase):
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
        self.dept_cs = Department(id=6, institution_id=2, name="CS Department")
        self.prog_mca = Programme(id=6, department_id=5, name="MCA", programme_type="PG")
        self.prog_cs = Programme(id=7, department_id=6, name="B.Sc CS", programme_type="UG")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem1 = Semester(id=1, semester_number=1, name="Semester 1")
        self.db.add_all([self.inst, self.dept_mca, self.dept_cs, self.prog_mca, self.prog_cs, self.ay, self.sem1])
        self.db.commit()

        # Two workspaces
        self.ws_mca_id = "ws_mca_p51"
        self.ws_cs_id = "ws_cs_p51"

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

        self.db.add_all([
            WorkloadVersion(workspace_id=self.ws_mca_id, version_no=1, snapshot_json="{}", reason="Finalized"),
            WorkloadVersion(workspace_id=self.ws_cs_id, version_no=1, snapshot_json="{}", reason="Finalized")
        ])

        # Users & Faculty
        self.u_hod = User(id=1, email="hod@srm.edu", hashed_password="pw", role=RoleEnum.HOD, department_id=5)
        self.u_other = User(id=2, email="other@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=6)
        self.db.add_all([self.u_hod, self.u_other])
        self.db.commit()

        self.f_shared = FacultyProfile(id=1, user_id=1, erp_id="FAC_SHARED", name="Dr. Shared", designation="Professor", home_department_id=5)
        self.f_other = FacultyProfile(id=2, user_id=2, erp_id="FAC_OTHER", name="Dr. Other", designation="Assistant Professor", home_department_id=6)
        self.db.add_all([self.f_shared, self.f_other])

        # Sections
        self.sec_mca = Section(id=101, workspace_id=self.ws_mca_id, name="MCA-A", student_strength=40)
        self.sec_cs = Section(id=102, workspace_id=self.ws_cs_id, name="CS-A", student_strength=40)
        self.db.add_all([self.sec_mca, self.sec_cs])

        # Configurations & Periods
        self.cfg_mca = TimetableConfiguration(id=1, institution_id=2, workspace_id=self.ws_mca_id, active=True)
        self.cfg_cs = TimetableConfiguration(id=2, institution_id=2, workspace_id=self.ws_cs_id, active=True)
        self.db.add_all([self.cfg_mca, self.cfg_cs])
        self.db.flush()

        for cfg_id in [1, 2]:
            for p_num in range(1, 7):
                self.db.add(TimetablePeriod(
                    configuration_id=cfg_id, period_number=p_num,
                    start_time=time(8 + (p_num - 1), 0), end_time=time(8 + p_num, 0),
                    duration_minutes=45, active=True
                ))

        # Rooms
        self.r_shared = TimetableRoom(id=1, institution_id=2, room_code="CR_SHARED", room_name="Shared Hall", room_type="CLASSROOM", capacity=60, active=True)
        self.r_exclusive = TimetableRoom(id=2, institution_id=2, room_code="CR_EXCL", room_name="Exclusive Hall", room_type="CLASSROOM", capacity=60, active=True)
        self.db.add_all([self.r_shared, self.r_exclusive])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_publication_gate_rejects_conflicting_faculty(self):
        """
        If Workspace 1 has a PUBLISHED version where Dr. Shared teaches on Monday Period 1,
        and Workspace 2 attempts to PUBLISH a draft where Dr. Shared also teaches on Monday Period 1,
        the publication must be rejected with TimetablePublicationConflictError, leaving draft unmutated.
        """
        # 1. Existing PUBLISHED version in MCA workspace
        run_mca = TimetableRun(run_id="run_mca_pub", workspace_id=self.ws_mca_id, configuration_id=1, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run_mca)
        self.db.flush()
        ver_mca = TimetableVersion(id=10, run_id=run_mca.id, status=TimetableVersionStatusEnum.PUBLISHED)
        self.db.add(ver_mca)
        self.db.flush()

        ts_mca = TeachingSession(id=101, allocation_id=1, institution_id=2, workspace_id=self.ws_mca_id, section_id=101, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts_mca)
        self.db.flush()

        # Dr. Shared in Room 2 on Monday (day 0), Period 1
        entry_mca = TimetableEntry(timetable_version_id=10, teaching_session_id=101, faculty_id=1, section_id=101, room_id=2, day_index=0, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(entry_mca)

        # 2. Candidate DRAFT version in CS workspace
        run_cs = TimetableRun(run_id="run_cs_draft", workspace_id=self.ws_cs_id, configuration_id=2, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run_cs)
        self.db.flush()
        ver_cs = TimetableVersion(id=20, run_id=run_cs.id, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver_cs)
        self.db.flush()

        ts_cs = TeachingSession(id=201, allocation_id=2, institution_id=2, workspace_id=self.ws_cs_id, section_id=102, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts_cs)
        self.db.flush()

        # Conflicting entry: Dr. Shared on Monday (day 0), Period 1 in Room 1
        entry_cs_conflict = TimetableEntry(timetable_version_id=20, teaching_session_id=201, faculty_id=1, section_id=102, room_id=1, day_index=0, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(entry_cs_conflict)
        self.db.commit()

        # Attempt to publish the CS draft -> MUST FAIL
        with self.assertRaises(TimetablePublicationConflictError) as ctx:
            publish_timetable_version(version_id=20, db=self.db)

        self.assertTrue(any("Faculty collision: Dr. Shared" in c for c in ctx.exception.conflicts))

        # Assert CS draft remains DRAFT
        self.assertEqual(self.db.query(TimetableVersion).get(20).status, TimetableVersionStatusEnum.DRAFT)
        # Assert MCA published version remains PUBLISHED
        self.assertEqual(self.db.query(TimetableVersion).get(10).status, TimetableVersionStatusEnum.PUBLISHED)

    def test_publication_gate_rejects_conflicting_room(self):
        """
        If Workspace 1 has a PUBLISHED version where Room CR_SHARED is booked on Tuesday Period 2,
        and Workspace 2 attempts to PUBLISH a draft where CR_SHARED is also booked on Tuesday Period 2,
        publication must be blocked.
        """
        # MCA Published: Room 1 booked on Tuesday (day 1), Period 2 by Dr. Shared
        run_mca = TimetableRun(run_id="run_mca_room", workspace_id=self.ws_mca_id, configuration_id=1, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run_mca)
        self.db.flush()
        ver_mca = TimetableVersion(id=30, run_id=run_mca.id, status=TimetableVersionStatusEnum.PUBLISHED)
        self.db.add(ver_mca)
        self.db.flush()

        ts_mca = TeachingSession(id=301, allocation_id=1, institution_id=2, workspace_id=self.ws_mca_id, section_id=101, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts_mca)
        self.db.flush()
        entry_mca = TimetableEntry(timetable_version_id=30, teaching_session_id=301, faculty_id=1, section_id=101, room_id=1, day_index=1, start_period=2, duration_in_periods=1, session_type="THEORY")
        self.db.add(entry_mca)

        # CS Draft: Room 1 booked on Tuesday (day 1), Period 2 by Dr. Other
        run_cs = TimetableRun(run_id="run_cs_room_draft", workspace_id=self.ws_cs_id, configuration_id=2, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run_cs)
        self.db.flush()
        ver_cs = TimetableVersion(id=40, run_id=run_cs.id, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver_cs)
        self.db.flush()

        ts_cs = TeachingSession(id=401, allocation_id=2, institution_id=2, workspace_id=self.ws_cs_id, section_id=102, faculty_id=2, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts_cs)
        self.db.flush()
        entry_cs = TimetableEntry(timetable_version_id=40, teaching_session_id=401, faculty_id=2, section_id=102, room_id=1, day_index=1, start_period=2, duration_in_periods=1, session_type="THEORY")
        self.db.add(entry_cs)
        self.db.commit()

        # Attempt to publish CS draft -> MUST FAIL due to room collision
        with self.assertRaises(TimetablePublicationConflictError) as ctx:
            publish_timetable_version(version_id=40, db=self.db)

        self.assertTrue(any("Room double-booking: CR_SHARED" in c for c in ctx.exception.conflicts))
        self.assertEqual(self.db.query(TimetableVersion).get(40).status, TimetableVersionStatusEnum.DRAFT)

    def test_non_conflicting_version_publishes_and_supersedes(self):
        """
        When a draft has NO cross-workspace conflicts, it publishes cleanly,
        and older published versions of the same configuration become SUPERSEDED.
        """
        # Older published version for MCA
        run1 = TimetableRun(run_id="run_old", workspace_id=self.ws_mca_id, configuration_id=1, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run1)
        self.db.flush()
        ver1 = TimetableVersion(id=50, run_id=run1.id, status=TimetableVersionStatusEnum.PUBLISHED)
        self.db.add(ver1)
        self.db.flush()

        # Newer draft for MCA
        run2 = TimetableRun(run_id="run_new", workspace_id=self.ws_mca_id, configuration_id=1, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run2)
        self.db.flush()
        ver2 = TimetableVersion(id=51, run_id=run2.id, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver2)
        self.db.flush()

        ts = TeachingSession(id=501, allocation_id=1, institution_id=2, workspace_id=self.ws_mca_id, section_id=101, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts)
        self.db.flush()
        entry = TimetableEntry(timetable_version_id=51, teaching_session_id=501, faculty_id=1, section_id=101, room_id=2, day_index=4, start_period=5, duration_in_periods=1, session_type="THEORY")
        self.db.add(entry)
        self.db.commit()

        pub_res = publish_timetable_version(version_id=51, db=self.db)
        self.assertEqual(pub_res["status"], "success")

        # Ver2 is now PUBLISHED; Ver1 is now SUPERSEDED
        self.assertEqual(self.db.query(TimetableVersion).get(51).status, TimetableVersionStatusEnum.PUBLISHED)
        self.assertEqual(self.db.query(TimetableVersion).get(50).status, TimetableVersionStatusEnum.SUPERSEDED)

    def test_coordinated_multi_workspace_generation_and_publication(self):
        """
        Prove that generate_multi_workspace_timetable produces coordinated, non-overlapping
        schedules across MCA and CS, and both can be published without cross-workspace conflicts.
        """
        # Admin or ERP Coordinator user who has institution-wide scheduling authority
        u_admin = User(id=99, email="admin@srm.edu", hashed_password="pw", role=RoleEnum.MASTER_ADMIN, department_id=5)
        self.db.add(u_admin)
        self.db.commit()

        # Set up workload allocations for MCA (Subj 1 = 2 hrs) and CS (Subj 2 = 2 hrs), both taught by Dr. Shared
        s1 = Subject(id=10, course_code="MCA_CO", course_name="MCA Subj", theory_hours=2, practical_hours=0)
        s2 = Subject(id=20, course_code="CS_CO", course_name="CS Subj", theory_hours=2, practical_hours=0)
        self.db.add_all([s1, s2])
        self.db.commit()

        sa_mca = SubjectAllocation(id=10, workspace_id=self.ws_mca_id, section_id=101, subject_id=10, status=AllocationStatusEnum.FINALIZED)
        sa_cs = SubjectAllocation(id=20, workspace_id=self.ws_cs_id, section_id=102, subject_id=20, status=AllocationStatusEnum.FINALIZED)
        self.db.add_all([sa_mca, sa_cs])
        self.db.flush()

        ac_mca = AllocationComponent(allocation_id=10, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=2, practical_hours=0)
        ac_cs = AllocationComponent(allocation_id=20, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=2, practical_hours=0)
        self.db.add_all([ac_mca, ac_cs])
        self.db.commit()

        res = generate_multi_workspace_timetable(
            workspace_ids=[self.ws_mca_id, self.ws_cs_id],
            db=self.db,
            current_user=u_admin
        )

        self.assertEqual(res["status"], "COMPLETED")
        self.assertEqual(res["total_scheduled_sessions"], 4)
        ver_mca_id = res["created_versions"][self.ws_mca_id]
        ver_cs_id = res["created_versions"][self.ws_cs_id]

        # Publish MCA version
        pub_mca = publish_timetable_version(ver_mca_id, self.db)
        self.assertEqual(pub_mca["status"], "success")

        # Publish CS version -> MUST SUCCEED because coordinated solve guaranteed zero overlaps!
        pub_cs = publish_timetable_version(ver_cs_id, self.db)
        self.assertEqual(pub_cs["status"], "success")


if __name__ == "__main__":
    unittest.main()
