"""
Isolated Unit & Regression Tests for TeachingSessionBuilder.

Uses an isolated in-memory SQLite database session.
GUARANTEED: Zero connection to or mutation of the real Mumbai PostgreSQL database.
"""

import sys
import os
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import unittest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

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
    RoleEnum,
    SemesterTypeEnum
)
from app.models.timetable import TeachingSession
from app.services.teaching_session_builder import TeachingSessionBuilder, TeachingSessionBuildError


class TestTeachingSessionBuilderIsolated(unittest.TestCase):
    def setUp(self):
        # 1. Strictly in-memory SQLite database
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # 2. Seed basic fixtures
        self.inst = Institution(id=2, name="Flabs", code="FLABS")
        self.dept = Department(id=5, institution_id=2, name="Postgraduate Department of Computer Applications")
        self.prog = Programme(id=6, department_id=5, name="MCA", programme_type="PG")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem = Semester(id=1, semester_number=1, name="Semester 1")
        
        self.db.add_all([self.inst, self.dept, self.prog, self.ay, self.sem])
        self.db.commit()

        # User and Faculty
        self.user = User(id=1, email="testfac@srm.edu", hashed_password="fakehashedpassword", role=RoleEnum.FACULTY, department_id=5)
        self.db.add(self.user)
        self.db.commit()

        self.fac = FacultyProfile(id=1, user_id=1, erp_id="FAC001", name="Dr. Test Faculty", designation="Assistant Professor", home_department_id=5)
        self.db.add(self.fac)

        # Subjects
        self.subj_theory = Subject(id=10, course_code="MCA101T", course_name="Theory Subject", theory_hours=3, practical_hours=0)
        self.subj_lab = Subject(id=11, course_code="MCA102L", course_name="Lab Subject", theory_hours=0, practical_hours=4)
        self.subj_embedded = Subject(id=12, course_code="MCA103J", course_name="Embedded Subject", theory_hours=3, practical_hours=2)

        self.db.add_all([self.subj_theory, self.subj_lab, self.subj_embedded])
        self.db.commit()

        # Workspaces
        self.ws_id_valid = "ws_finalized_valid"
        self.ws_valid = AcademicWorkspace(
            id=self.ws_id_valid,
            department_id=5,
            programme_id=6,
            academic_year_id=1,
            semester_id=1,
            programme_year=1,
            workflow_state=WorkspaceWorkflowStateEnum.FINALIZED,
            version=1
        )

        self.ws_id_unfinalized = "ws_unfinalized_draft"
        self.ws_unfinalized = AcademicWorkspace(
            id=self.ws_id_unfinalized,
            department_id=5,
            programme_id=6,
            academic_year_id=1,
            semester_id=1,
            programme_year=1,
            workflow_state=WorkspaceWorkflowStateEnum.PREFERENCES,
            version=1
        )

        self.db.add_all([self.ws_valid, self.ws_unfinalized])
        self.db.commit()

        # Sections
        self.sec = Section(id=100, workspace_id=self.ws_id_valid, name="A", student_strength=60)
        self.db.add(self.sec)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_unfinalized_workspace_rejected(self):
        """Unfinalized workspace in PREFERENCES state must be rejected."""
        builder = TeachingSessionBuilder(self.db)
        with self.assertRaises(TeachingSessionBuildError) as ctx:
            builder.build_sessions_for_workspace(self.ws_id_unfinalized)
        self.assertIn("Only FINALIZED workspaces can be prepared", str(ctx.exception))

    def test_missing_workload_version_rejected(self):
        """Workspace marked FINALIZED but missing WorkloadVersion snapshot must be rejected."""
        builder = TeachingSessionBuilder(self.db)
        with self.assertRaises(TeachingSessionBuildError) as ctx:
            builder.build_sessions_for_workspace(self.ws_id_valid)
        self.assertIn("has no active WorkloadVersion snapshot", str(ctx.exception))

    def test_empty_allocations_rejected(self):
        """Finalized workspace with no approved allocations must be rejected."""
        # Add WorkloadVersion
        wv = WorkloadVersion(workspace_id=self.ws_id_valid, version_no=1, snapshot_json="{}", reason="HOD Final")
        self.db.add(wv)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        with self.assertRaises(TeachingSessionBuildError) as ctx:
            builder.build_sessions_for_workspace(self.ws_id_valid)
        self.assertIn("has no subject allocations to schedule", str(ctx.exception))

    def test_theory_and_lab_hours_exact_preservation(self):
        """
        Verify that 3 theory hours produce 3 1-period sessions,
        and 4 practical hours produce 2 2-period lab blocks (total 4 hours).
        """
        # WorkloadVersion
        wv = WorkloadVersion(workspace_id=self.ws_id_valid, version_no=1, snapshot_json="{}", reason="HOD Final")
        self.db.add(wv)

        # Allocation 1: Theory (3 hrs)
        alloc_theory = SubjectAllocation(
            id=1, workspace_id=self.ws_id_valid, section_id=100, subject_id=10,
            status=AllocationStatusEnum.FINALIZED
        )
        self.db.add(alloc_theory)
        self.db.flush()

        comp_theory = AllocationComponent(
            allocation_id=1, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1,
            theory_hours=3, practical_hours=0
        )
        self.db.add(comp_theory)

        # Allocation 2: Lab (4 hrs)
        alloc_lab = SubjectAllocation(
            id=2, workspace_id=self.ws_id_valid, section_id=100, subject_id=11,
            status=AllocationStatusEnum.FINALIZED
        )
        self.db.add(alloc_lab)
        self.db.flush()

        comp_lab = AllocationComponent(
            allocation_id=2, faculty_id=1, role=AllocationRoleEnum.INCHARGE_2,
            theory_hours=0, practical_hours=4
        )
        self.db.add(comp_lab)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        sessions = builder.build_sessions_for_workspace(self.ws_id_valid)

        # 3 theory sessions of 1 period + 2 lab sessions of 2 periods = 5 records total
        self.assertEqual(len(sessions), 5)

        theory_sessions = [s for s in sessions if s.teaching_type == "THEORY"]
        lab_sessions = [s for s in sessions if s.teaching_type == "LAB"]

        self.assertEqual(len(theory_sessions), 3)
        for ts in theory_sessions:
            self.assertEqual(ts.duration_in_periods, 1)

        self.assertEqual(len(lab_sessions), 2)
        for ls in lab_sessions:
            self.assertEqual(ls.duration_in_periods, 2)

        # Total scheduled hours check: 3*1 + 2*2 = 7 hours
        total_hours = sum(s.duration_in_periods for s in sessions)
        self.assertEqual(total_hours, 7)

    def test_idempotent_session_building(self):
        """Repeated generation must replace records cleanly without creating duplicates."""
        wv = WorkloadVersion(workspace_id=self.ws_id_valid, version_no=1, snapshot_json="{}", reason="HOD Final")
        self.db.add(wv)

        alloc = SubjectAllocation(
            id=1, workspace_id=self.ws_id_valid, section_id=100, subject_id=10,
            status=AllocationStatusEnum.FINALIZED
        )
        self.db.add(alloc)
        self.db.flush()

        comp = AllocationComponent(
            allocation_id=1, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1,
            theory_hours=3, practical_hours=0
        )
        self.db.add(comp)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        
        # Run 1
        s1 = builder.build_sessions_for_workspace(self.ws_id_valid)
        self.assertEqual(len(s1), 3)
        db_count_1 = self.db.query(TeachingSession).filter_by(workspace_id=self.ws_id_valid).count()
        self.assertEqual(db_count_1, 3)

        # Run 2 (repeated)
        s2 = builder.build_sessions_for_workspace(self.ws_id_valid)
        self.assertEqual(len(s2), 3)
        db_count_2 = self.db.query(TeachingSession).filter_by(workspace_id=self.ws_id_valid).count()
        self.assertEqual(db_count_2, 3)

    def test_cross_workspace_section_leakage_rejected(self):
        """An allocation pointing to a section belonging to another workspace must fail explicitly."""
        wv = WorkloadVersion(workspace_id=self.ws_id_valid, version_no=1, snapshot_json="{}", reason="HOD Final")
        self.db.add(wv)

        # Section belonging to another workspace
        sec_other = Section(id=200, workspace_id="ws_another", name="B")
        self.db.add(sec_other)

        alloc = SubjectAllocation(
            id=1, workspace_id=self.ws_id_valid, section_id=200, subject_id=10,
            status=AllocationStatusEnum.FINALIZED
        )
        self.db.add(alloc)
        self.db.flush()

        comp = AllocationComponent(
            allocation_id=1, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1,
            theory_hours=2, practical_hours=0
        )
        self.db.add(comp)
        self.db.commit()

        builder = TeachingSessionBuilder(self.db)
        with self.assertRaises(TeachingSessionBuildError) as ctx:
            builder.build_sessions_for_workspace(self.ws_id_valid)
        self.assertIn("Cross-workspace leakage detected", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
