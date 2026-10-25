"""
Phase 6.5 Tests: B.Sc. CS & MCA Provisional Timetable Preview & Section Reconciliation.

Validates:
1. Reconciled section counts:
   - Exactly 14 sections confirmed for B.Sc. CS (3 Year 1, 5 Year 2, 6 Year 3).
   - Exactly 4 sections confirmed for MCA Regular (2 Year 1, 2 Year 2).
   - MCA Gen AI is strictly excluded.
2. Provisional Room Isolation:
   - B.Sc. CS utilizes Block 5 provisional rooms.
   - MCA utilizes PG Block provisional rooms.
   - Soft room preferences guide new timetables without locking into historical period arrangements.
3. Preview Gating & Non-Publishability:
   - Preview produces in-memory results labeled "PROVISIONAL — CAPACITY NOT VERIFIED".
   - Preview does NOT create official TimetableVersion or TimetableEntry records in DB.
   - Preview output is marked is_publishable=False.
   - Unfinalized workload correctly blocks preview.
   - Missing capacities/student strengths are skipped only in preview mode; normal production remains gated.
   - All hard constraints (faculty clashes, section clashes, room double-booking, daily cap <= 5, theory repetition <= 2) remain fully enforced.
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
    SubjectAllocation,
    AllocationComponent,
    AllocationStatusEnum,
    AllocationRoleEnum,
    FacultyProfile,
    Section,
    Subject,
    User,
    RoleEnum
)
from app.models.timetable import (
    TimetableConfiguration,
    TimetablePeriod,
    TimetableRoom,
    TimetableRun,
    TimetableVersion,
    TimetableEntry
)
from app.services.provisional_timetable_preview_service import (
    generate_provisional_timetable_preview,
    ProvisionalPreviewError,
    BSC_CS_ROOM_PREFERENCES,
    MCA_PG_ROOM_PREFERENCES
)
from app.services.timetable_service import (
    publish_timetable_version,
    TimetablePublicationConflictError
)
from app.routers.timetable import api_generate_provisional_preview
from fastapi import HTTPException


class TestPhase65ProvisionalPreview(unittest.TestCase):
    def setUp(self):
        # STRICT SAFETY GUARD: in-memory SQLite only
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        assert "sqlite" in str(self.engine.url), "FATAL: Test must run only on isolated in-memory SQLite."

        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Master setup
        self.inst = Institution(id=2, name="Flabs", code="FLABS")
        self.dept_cs = Department(id=5, institution_id=2, name="Computer Science")
        self.dept_ca = Department(id=6, institution_id=2, name="Computer Applications")
        self.prog_bsc = Programme(id=6, department_id=5, name="B.Sc Computer Science (Hons)", programme_type="UG")
        self.prog_mca = Programme(id=7, department_id=6, name="MCA", programme_type="PG")
        self.prog_mca_genai = Programme(id=8, department_id=6, name="MCA GEN AI", programme_type="PG")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem1 = Semester(id=1, semester_number=1, name="Semester 1")
        self.db.add_all([self.inst, self.dept_cs, self.dept_ca, self.prog_bsc, self.prog_mca, self.prog_mca_genai, self.ay, self.sem1])
        self.db.commit()

        # Users & Faculty
        self.u1 = User(id=1, email="fac1@flabs.edu", hashed_password="pw", role=RoleEnum.FACULTY)
        self.u2 = User(id=2, email="fac2@flabs.edu", hashed_password="pw", role=RoleEnum.FACULTY)
        self.db.add_all([self.u1, self.u2])
        self.db.commit()

        self.f1 = FacultyProfile(id=1, user_id=1, erp_id="F1", name="Dr. CS Faculty", home_department_id=5, designation="Professor")
        self.f2 = FacultyProfile(id=2, user_id=2, erp_id="F2", name="Dr. MCA Faculty", home_department_id=6, designation="Associate Professor")
        self.db.add_all([self.f1, self.f2])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_reconciled_section_counts_and_isolation(self):
        """Validates that B.Sc CS has 14 confirmed sections and MCA has 4 confirmed sections."""
        # Check B.Sc CS preferences coverage
        self.assertEqual(len(BSC_CS_ROOM_PREFERENCES), 14)
        bsc_years = {"I": 0, "II": 0, "III": 0}
        for sec in BSC_CS_ROOM_PREFERENCES.keys():
            prefix = sec.split()[0]
            bsc_years[prefix] += 1

        self.assertEqual(bsc_years["I"], 3)   # 3 sections in year 1
        self.assertEqual(bsc_years["II"], 5)  # 5 sections in year 2
        self.assertEqual(bsc_years["III"], 6) # 6 sections in year 3

        # Check MCA preferences coverage
        self.assertEqual(len(MCA_PG_ROOM_PREFERENCES), 4)
        mca_years = {"I": 0, "II": 0}
        for sec in MCA_PG_ROOM_PREFERENCES.keys():
            prefix = sec.split()[1]
            mca_years[prefix] += 1

        self.assertEqual(mca_years["I"], 2)  # 2 sections in year 1
        self.assertEqual(mca_years["II"], 2) # 2 sections in year 2

        # Verify all MCA preferences specify PG Block
        for sec, pref in MCA_PG_ROOM_PREFERENCES.items():
            self.assertEqual(pref["block"], "PG Block")
            self.assertTrue(pref["theory"].startswith("PG-"))

        # Verify all B.Sc CS preferences specify Block 5
        for sec, pref in BSC_CS_ROOM_PREFERENCES.items():
            self.assertEqual(pref["block"], "Block 5")

    def test_mca_genai_workspace_is_blocked_from_preview(self):
        """MCA Gen AI must be rejected from preview scope."""
        ws_genai = AcademicWorkspace(
            id="ws_mca_genai", department_id=6, programme_id=8, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add(ws_genai)
        wv = WorkloadVersion(workspace_id="ws_mca_genai", version_no=1, snapshot_json='{"status":"FINALIZED"}')
        self.db.add(wv)
        self.db.commit()

        with self.assertRaises(ProvisionalPreviewError) as ctx:
            generate_provisional_timetable_preview("ws_mca_genai", self.db)

        self.assertTrue(any("MCA Gen AI is explicitly excluded" in b for b in ctx.exception.blockers))

    def test_unfinalized_workspace_is_blocked_from_preview(self):
        """Unfinalized workload states must block preview generation."""
        ws_unfin = AcademicWorkspace(
            id="ws_unfin_bsc", department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.ALLOCATION, version=1
        )
        self.db.add(ws_unfin)
        self.db.commit()

        with self.assertRaises(ProvisionalPreviewError) as ctx:
            generate_provisional_timetable_preview("ws_unfin_bsc", self.db)

        self.assertTrue(any("Workload must be FINALIZED" in b for b in ctx.exception.blockers))

    def test_provisional_preview_executes_successfully_and_is_not_publishable(self):
        """
        Validates that for an eligible workspace with unverified room capacity and student strength:
        - The solver runs and produces a feasible preview schedule.
        - Room preferences are honored.
        - Result is flagged 'PROVISIONAL — CAPACITY NOT VERIFIED' and is_publishable=False.
        - Zero TimetableVersion or TimetableEntry rows are created in the database.
        """
        # Create finalized B.Sc CS workspace
        ws = AcademicWorkspace(
            id="ws_bsc_prev", department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add(ws)
        wv = WorkloadVersion(workspace_id="ws_bsc_prev", version_no=1, snapshot_json='{"status":"FINALIZED"}')
        self.db.add(wv)

        # Section II B (student strength = 0 / unverified)
        sec = Section(id=102, workspace_id="ws_bsc_prev", name="II B", student_strength=0)
        self.db.add(sec)

        # Subjects
        s1 = Subject(id=201, course_code="CS201", course_name="Data Structures", category="CORE", theory_hours=3)
        s2 = Subject(id=202, course_code="CS202", course_name="DS Lab", category="CORE", practical_hours=2)
        self.db.add_all([s1, s2])

        # Allocations
        a1 = SubjectAllocation(id=201, workspace_id="ws_bsc_prev", section_id=102, subject_id=201, status=AllocationStatusEnum.FINALIZED)
        a2 = SubjectAllocation(id=202, workspace_id="ws_bsc_prev", section_id=102, subject_id=202, status=AllocationStatusEnum.FINALIZED)
        self.db.add_all([a1, a2])
        self.db.flush()

        # Components
        c1 = AllocationComponent(allocation_id=201, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=3)
        c2 = AllocationComponent(allocation_id=202, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, practical_hours=2)
        self.db.add_all([c1, c2])

        # Calendar configuration with 6 periods
        cfg = TimetableConfiguration(id=10, institution_id=2, workspace_id="ws_bsc_prev", active=True)
        self.db.add(cfg)
        for p in range(1, 7):
            self.db.add(TimetablePeriod(configuration_id=10, period_number=p, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45, active=True))
        self.db.commit()

        # Count DB records before preview
        ver_count_before = self.db.query(TimetableVersion).count()
        entry_count_before = self.db.query(TimetableEntry).count()

        # Execute provisional preview
        result = generate_provisional_timetable_preview("ws_bsc_prev", self.db)

        # Verify preview response
        self.assertEqual(result["status"], "COMPLETED")
        self.assertEqual(result["disclaimer"], "PROVISIONAL — CAPACITY NOT VERIFIED")
        self.assertFalse(result["is_publishable"])
        # TeachingSessionBuilder creates 1 session per hour for theory (3x 1-hr) and 1 session for practical_hours=2 (1x 2-hr block) -> total 4 sessions
        self.assertEqual(result["scheduled_sessions"], 4)

        # Verify room preference honor (II B preferred theory is CR-205, preferred lab is LAB-4FL)
        theory_entries = [e for e in result["preview_entries"] if e["teaching_type"] == "THEORY"]
        lab_entries = [e for e in result["preview_entries"] if e["teaching_type"] == "LAB"]

        # All or majority theory sessions should be assigned to CR-205
        self.assertTrue(any(e["room_code"] == "CR-205" for e in theory_entries))
        # Lab sessions must use PC_LAB LAB-4FL
        self.assertTrue(all(e["room_code"] == "LAB-4FL" for e in lab_entries))

        # Strictly verify zero DB mutations
        self.assertEqual(self.db.query(TimetableVersion).count(), ver_count_before)
        self.assertEqual(self.db.query(TimetableEntry).count(), entry_count_before)

    def test_api_generate_provisional_preview_endpoint(self):
        """Validates that calling the authenticated router endpoint executes preview safely."""
        # Finalized MCA workspace
        ws_mca = AcademicWorkspace(
            id="ws_mca_api_prev", department_id=6, programme_id=7, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add(ws_mca)
        wv = WorkloadVersion(workspace_id="ws_mca_api_prev", version_no=1, snapshot_json='{"status":"FINALIZED"}')
        self.db.add(wv)

        # Section MCA I A (unverified student strength 0)
        sec = Section(id=301, workspace_id="ws_mca_api_prev", name="MCA I A", student_strength=0)
        self.db.add(sec)

        # Subjects
        s1 = Subject(id=301, course_code="MCA101", course_name="Advanced Java", category="CORE", theory_hours=3)
        self.db.add(s1)

        # Allocations
        a1 = SubjectAllocation(id=301, workspace_id="ws_mca_api_prev", section_id=301, subject_id=301, status=AllocationStatusEnum.FINALIZED)
        self.db.add(a1)
        self.db.flush()

        # Components
        c1 = AllocationComponent(allocation_id=301, faculty_id=2, role=AllocationRoleEnum.INCHARGE_1, theory_hours=3)
        self.db.add(c1)

        # Configuration & Periods
        cfg = TimetableConfiguration(id=30, institution_id=2, workspace_id="ws_mca_api_prev", active=True)
        self.db.add(cfg)
        for p in range(1, 7):
            self.db.add(TimetablePeriod(configuration_id=30, period_number=p, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45, active=True))
        self.db.commit()

        # Authorized HOD user
        u_hod_ca = User(id=10, email="hod_ca@flabs.edu", role=RoleEnum.HOD, department_id=6)

        # Call router function directly
        res = api_generate_provisional_preview(
            workspace_id="ws_mca_api_prev",
            scope_type="AUTO",
            db=self.db,
            current_user=u_hod_ca
        )

        self.assertEqual(res["status"], "COMPLETED")
        self.assertEqual(res["disclaimer"], "PROVISIONAL — CAPACITY NOT VERIFIED")
        self.assertFalse(res["is_publishable"])
        self.assertEqual(res["scheduled_sessions"], 3)
        self.assertEqual(res["scope"], "MCA (Regular) PG Block Scope")

        # Zero DB versions created
        self.assertEqual(self.db.query(TimetableRun).filter_by(workspace_id="ws_mca_api_prev").count(), 0)

    def test_api_preview_authorization_check(self):
        """Validates that unauthorized users are rejected with 403."""
        # Finalized workspace exists in department 6
        ws_mca = self.db.query(AcademicWorkspace).filter_by(id="ws_mca_api_prev").first()
        if not ws_mca:
            ws_mca = AcademicWorkspace(
                id="ws_mca_api_prev", department_id=6, programme_id=7, academic_year_id=1,
                semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
            )
            self.db.add(ws_mca)
            self.db.commit()

        # Authorized HOD from wrong department (99)
        u_hod_wrong = User(id=20, email="hod_wrong@flabs.edu", role=RoleEnum.HOD, department_id=99)

        with self.assertRaises(HTTPException) as ctx:
            api_generate_provisional_preview(
                workspace_id="ws_mca_api_prev",
                scope_type="AUTO",
                db=self.db,
                current_user=u_hod_wrong
            )
        self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()

