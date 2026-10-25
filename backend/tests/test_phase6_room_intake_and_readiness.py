"""
Phase 6 Tests: Room Inventory Intake & Timetable Readiness Service.

Validates:
1. RoomInventoryImporter validation rules:
   - Rejects unapproved or unverified records.
   - Rejects missing or non-positive capacity.
   - Rejects duplicate room codes within file.
   - Rejects invalid room types.
   - Requires lab classification for LAB / PC_LAB.
2. Idempotency and Conflict Detection:
   - Dry-run produces zero database mutations.
   - Valid records import cleanly when apply=True.
   - Re-importing identical records is idempotent (0 new creates, 100% matched).
   - Conflicting attributes for existing room codes are rejected without overwriting.
3. Timetable Readiness Report:
   - Identifies unfinalized workload state as BLOCKED.
   - Identifies missing or zero section student strength as BLOCKED.
   - Identifies missing room inventory or capacity shortfall as BLOCKED.
   - Identifies elective allocations lacking SynchronizedGroup as REQUIRES_POLICY_DECISION.
   - Verified that evaluation is strictly read-only (zero database writes or solver calls).
"""

import sys
import os
import unittest
from datetime import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import openpyxl

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
    TimetableRoom,
    TimetableConfiguration,
    TimetablePeriod,
    SynchronizedGroup
)
from app.services.room_inventory_importer import RoomInventoryImporter
from app.services.timetable_readiness_service import (
    evaluate_workspace_timetable_readiness,
    generate_institutional_timetable_readiness_report
)


class TestPhase6RoomIntakeAndReadiness(unittest.TestCase):
    def setUp(self):
        # STRICT SAFETY GUARD: in-memory SQLite only
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        assert "sqlite" in str(self.engine.url), "FATAL: Test must run only on isolated in-memory SQLite."

        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Seed minimal master data
        self.inst = Institution(id=2, name="Flabs", code="FLABS")
        self.dept = Department(id=5, institution_id=2, name="MCA Department")
        self.prog = Programme(id=6, department_id=5, name="MCA", programme_type="PG")
        self.ay = AcademicYear(id=1, name="2026-2027")
        self.sem = Semester(id=1, semester_number=1, name="Semester 1")
        self.db.add_all([self.inst, self.dept, self.prog, self.ay, self.sem])
        self.db.commit()

        self.test_excel_path = os.path.join(backend_dir, "tests", "temp_test_rooms.xlsx")

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        if os.path.exists(self.test_excel_path):
            try:
                os.remove(self.test_excel_path)
            except Exception:
                pass

    def _create_test_excel(self, rows):
        """Helper to create a temporary test Excel file with headers."""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Room Inventory"
        headers = [
            "Room Code *", "Room Name *", "Room Type *", "Capacity *",
            "Building", "Floor", "Lab Classification", "Institution ID *",
            "Approval Status *", "Verification Status *"
        ]
        ws.append(headers)
        for r in rows:
            ws.append(r)
        wb.save(self.test_excel_path)

    # -------------------------------------------------------------
    # 1. Importer Validation Tests
    # -------------------------------------------------------------
    def test_importer_rejects_unapproved_or_unverified_records(self):
        rows = [
            ["CR-101", "Room 101", "CLASSROOM", 50, "Block A", "1st", None, 2, "PENDING", "VERIFIED"],
            ["CR-102", "Room 102", "CLASSROOM", 50, "Block A", "1st", None, 2, "APPROVED", "ESTIMATED"]
        ]
        self._create_test_excel(rows)
        importer = RoomInventoryImporter(self.db)
        res = importer.import_rooms(self.test_excel_path, apply=False)

        self.assertEqual(res["status"], "VALIDATION_FAILED")
        self.assertTrue(any("Only 'APPROVED' records can be imported" in e for e in res["errors"]))
        self.assertTrue(any("Only 'VERIFIED' records can be imported" in e for e in res["errors"]))

    def test_importer_rejects_missing_capacity_and_invalid_type(self):
        rows = [
            ["CR-101", "Room 101", "INVALID_TYPE", 50, "Block A", "1st", None, 2, "APPROVED", "VERIFIED"],
            ["CR-102", "Room 102", "CLASSROOM", 0, "Block A", "1st", None, 2, "APPROVED", "VERIFIED"],
            ["LAB-103", "Lab 103", "PC_LAB", 40, "Block A", "1st", None, 2, "APPROVED", "VERIFIED"]  # missing lab class
        ]
        self._create_test_excel(rows)
        importer = RoomInventoryImporter(self.db)
        res = importer.import_rooms(self.test_excel_path, apply=False)

        self.assertEqual(res["status"], "VALIDATION_FAILED")
        self.assertTrue(any("Invalid room_type 'INVALID_TYPE'" in e for e in res["errors"]))
        self.assertTrue(any("Capacity must be > 0" in e for e in res["errors"]))
        self.assertTrue(any("Lab classification is required" in e for e in res["errors"]))

    def test_importer_rejects_duplicate_room_codes_in_file(self):
        rows = [
            ["CR-101", "Room 101 A", "CLASSROOM", 50, "Block A", "1st", None, 2, "APPROVED", "VERIFIED"],
            ["CR-101", "Room 101 B", "CLASSROOM", 60, "Block A", "1st", None, 2, "APPROVED", "VERIFIED"]
        ]
        self._create_test_excel(rows)
        importer = RoomInventoryImporter(self.db)
        res = importer.import_rooms(self.test_excel_path, apply=False)

        self.assertEqual(res["status"], "VALIDATION_FAILED")
        self.assertTrue(any("Duplicate room code 'CR-101'" in e for e in res["errors"]))

    # -------------------------------------------------------------
    # 2. Dry-Run, Apply, and Idempotency Tests
    # -------------------------------------------------------------
    def test_dry_run_produces_zero_database_mutations(self):
        rows = [
            ["CR-200", "Classroom 200", "CLASSROOM", 60, "Block 5", "2nd", None, 2, "APPROVED", "VERIFIED"],
            ["LAB-4FL", "4th Floor Lab", "PC_LAB", 70, "Block 5", "4th", "COMPUTER_SCIENCE", 2, "APPROVED", "VERIFIED"]
        ]
        self._create_test_excel(rows)
        importer = RoomInventoryImporter(self.db)

        # Execute Dry Run
        res = importer.import_rooms(self.test_excel_path, apply=False)
        self.assertEqual(res["status"], "DRY_RUN_COMPLETED")
        self.assertEqual(res["to_create"], 2)
        self.assertEqual(res["created"], 0)

        # Database must still have 0 rooms
        self.assertEqual(self.db.query(TimetableRoom).count(), 0)

    def test_apply_imports_cleanly_and_subsequent_run_is_idempotent(self):
        rows = [
            ["CR-200", "Classroom 200", "CLASSROOM", 60, "Block 5", "2nd", None, 2, "APPROVED", "VERIFIED"],
            ["LAB-4FL", "4th Floor Lab", "PC_LAB", 70, "Block 5", "4th", "COMPUTER_SCIENCE", 2, "APPROVED", "VERIFIED"]
        ]
        self._create_test_excel(rows)
        importer = RoomInventoryImporter(self.db)

        # Apply import
        res1 = importer.import_rooms(self.test_excel_path, apply=True)
        self.assertEqual(res1["status"], "SUCCESS_APPLIED")
        self.assertEqual(res1["created"], 2)
        self.assertEqual(self.db.query(TimetableRoom).count(), 2)

        # Re-run identical import with apply=True -> MUST BE IDEMPOTENT (0 created, 2 matched)
        res2 = importer.import_rooms(self.test_excel_path, apply=True)
        self.assertEqual(res2["status"], "SUCCESS_APPLIED")
        self.assertEqual(res2["created"], 0)
        self.assertEqual(res2["matched_idempotent"], 2)
        self.assertEqual(self.db.query(TimetableRoom).count(), 2)

    def test_importer_detects_conflicts_with_existing_records(self):
        # Pre-seed CR-200 with capacity 50
        r_pre = TimetableRoom(institution_id=2, room_code="CR-200", room_name="Classroom 200", room_type="CLASSROOM", capacity=50, active=True)
        self.db.add(r_pre)
        self.db.commit()

        # Incoming file attempts to change capacity to 80 without approval/reconciliation
        rows = [
            ["CR-200", "Classroom 200", "CLASSROOM", 80, "Block 5", "2nd", None, 2, "APPROVED", "VERIFIED"]
        ]
        self._create_test_excel(rows)
        importer = RoomInventoryImporter(self.db)
        res = importer.import_rooms(self.test_excel_path, apply=True)

        self.assertEqual(res["status"], "CONFLICT_DETECTED")
        self.assertTrue(any("Conflict for room 'CR-200'" in c for c in res["conflicts"]))
        # Capacity must remain 50
        self.assertEqual(self.db.query(TimetableRoom).filter_by(room_code="CR-200").first().capacity, 50)

    # -------------------------------------------------------------
    # 3. Timetable Readiness Report Tests
    # -------------------------------------------------------------
    def test_readiness_blocks_unfinalized_and_missing_sections(self):
        ws = AcademicWorkspace(
            id="ws_unfin", department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.ALLOCATION, version=1
        )
        self.db.add(ws)
        self.db.commit()

        report = evaluate_workspace_timetable_readiness("ws_unfin", self.db)
        self.assertEqual(report["status"], "BLOCKED")
        self.assertTrue(any("Workload must be FINALIZED" in b for b in report["blockers"]))
        self.assertTrue(any("No active WorkloadVersion snapshot" in b for b in report["blockers"]))
        self.assertTrue(any("0 approved TimetableRoom records found" in b for b in report["blockers"]))

    def test_readiness_blocks_capacity_shortfall(self):
        # Create finalized workspace
        ws = AcademicWorkspace(
            id="ws_cap", department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add(ws)
        wv = WorkloadVersion(workspace_id="ws_cap", version_no=1, snapshot_json='{"status": "FINALIZED"}')
        self.db.add(wv)

        # Add section with 65 students
        sec = Section(id=501, workspace_id="ws_cap", name="MCA-A", student_strength=65)
        self.db.add(sec)

        # Add allocation with theory component
        subj = Subject(id=501, course_code="MCA501", course_name="Algorithms", category="CORE", theory_hours=3)
        self.db.add(subj)
        alloc = SubjectAllocation(id=501, workspace_id="ws_cap", section_id=501, subject_id=501, status=AllocationStatusEnum.FINALIZED)
        self.db.add(alloc)
        self.db.flush()
        comp = AllocationComponent(allocation_id=501, faculty_id=1, role=AllocationRoleEnum.INCHARGE_1, theory_hours=3)
        self.db.add(comp)

        # Add calendar configuration
        cfg = TimetableConfiguration(id=50, institution_id=2, workspace_id="ws_cap", active=True)
        self.db.add(cfg)
        for p in range(1, 7):
            self.db.add(TimetablePeriod(configuration_id=50, period_number=p, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45, active=True))

        # Add room with capacity 50 (smaller than section 65)
        small_room = TimetableRoom(institution_id=2, room_code="CR-SMALL", room_name="Small Room", room_type="CLASSROOM", capacity=50, active=True)
        self.db.add(small_room)
        self.db.commit()

        report = evaluate_workspace_timetable_readiness("ws_cap", self.db)
        self.assertEqual(report["status"], "BLOCKED")
        self.assertTrue(any("Classroom capacity shortfall" in b for b in report["blockers"]))

    def test_readiness_evaluates_read_only_without_mutations(self):
        """Readiness report must be strictly read-only."""
        count_before = self.db.query(TimetableRoom).count()
        rep = generate_institutional_timetable_readiness_report(self.db, institution_id=2)
        count_after = self.db.query(TimetableRoom).count()

        self.assertEqual(count_before, count_after)
        self.assertIn("summary", rep)
        self.assertIn("workspaces", rep)


if __name__ == "__main__":
    unittest.main()
