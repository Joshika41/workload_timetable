"""
Isolated Unit & Regression Tests for KairosTimetableAdapter.

Uses strictly an isolated in-memory SQLite database session.
GUARANTEED: Zero connection to or mutation of the real Mumbai PostgreSQL database.
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

from app.models.domain import (
    Base,
    Institution,
    Department,
    Programme,
    AcademicYear,
    Semester,
    AcademicWorkspace,
    WorkspaceWorkflowStateEnum,
    Subject,
    Section,
    FacultyProfile,
    SubjectAllocation,
    AllocationStatusEnum,
    User,
    RoleEnum
)
from app.models.timetable import (
    TeachingSession,
    TimetableRoom,
    TimetablePeriod,
    TimetableEntry,
    TimetableFacultyAvailability,
    AvailabilityStatusEnum
)
from app.services.kairos_adapter import KairosTimetableAdapter, KairosAdapterError, erp_period_to_slot, slot_to_erp_period
from src.timetabling.model import Assignment


class TestKairosAdapterIsolated(unittest.TestCase):
    def setUp(self):
        # In-memory SQLite
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
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

        # Workspace
        self.ws_id = "ws_test_mca"
        self.ws = AcademicWorkspace(
            id=self.ws_id, department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED
        )
        self.db.add(self.ws)

        # Faculty
        self.user = User(id=1, email="fac@srm.edu", hashed_password="pw", role=RoleEnum.FACULTY, department_id=5)
        self.db.add(self.user)
        self.db.commit()
        self.fac = FacultyProfile(id=1, user_id=1, erp_id="FAC001", name="Dr. Renuga", designation="Professor", home_department_id=5)
        self.db.add(self.fac)

        # Subject & Section
        self.subj = Subject(id=10, course_code="MCA101", course_name="Cloud Computing", theory_hours=3, practical_hours=0)
        self.sec = Section(id=100, workspace_id=self.ws_id, name="A", student_strength=45)
        self.db.add_all([self.subj, self.sec])
        self.db.commit()

        # Allocation
        self.alloc = SubjectAllocation(id=1, workspace_id=self.ws_id, section_id=100, subject_id=10, status=AllocationStatusEnum.FINALIZED)
        self.db.add(self.alloc)

        # Timetable Room
        self.room = TimetableRoom(id=1, institution_id=2, workspace_id=self.ws_id, room_code="CR101", room_name="Classroom 101", room_type="CLASSROOM", capacity=60, active=True)
        self.db.add(self.room)

        # FLABS Shift 1 Periods (with morning break between P3 and P4)
        self.periods = [
            TimetablePeriod(configuration_id=1, period_number=1, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=2, start_time=time(8, 45), end_time=time(9, 30), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=3, start_time=time(9, 30), end_time=time(10, 15), duration_minutes=45),
            # Break 10:15 - 10:30
            TimetablePeriod(configuration_id=1, period_number=4, start_time=time(10, 30), end_time=time(11, 15), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=5, start_time=time(11, 15), end_time=time(12, 0), duration_minutes=45),
            TimetablePeriod(configuration_id=1, period_number=6, start_time=time(12, 0), end_time=time(12, 45), duration_minutes=45),
        ]
        self.db.add_all(self.periods)
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_break_contiguity_and_consecutive_lab_slots(self):
        """
        Verify that 2-period lab blocks can start at P1 (slot 0), P2 (slot 1), P4 (slot 3), P5 (slot 4),
        but CANNOT start at P3 (slot 2) because P3 spans into the morning break.
        """
        adapter = KairosTimetableAdapter(self.db)
        valid_starts = adapter.calculate_valid_start_slots(self.periods)

        # Length 1 blocks can start at all slots (0..5)
        self.assertEqual(valid_starts[1], frozenset([0, 1, 2, 3, 4, 5]))

        # Length 2 blocks: Slot 0 (P1+P2), Slot 1 (P2+P3), Slot 3 (P4+P5), Slot 4 (P5+P6)
        # Slot 2 (P3) is strictly excluded because P3.end_time (10:15) != P4.start_time (10:30)
        self.assertIn(0, valid_starts[2])
        self.assertIn(1, valid_starts[2])
        self.assertNotIn(2, valid_starts[2])  # STRICT GUARD: Break contiguity enforced
        self.assertIn(3, valid_starts[2])
        self.assertIn(4, valid_starts[2])
        self.assertNotIn(5, valid_starts[2])  # P6 cannot host a 2-period session

    def test_build_solver_inputs_mapping(self):
        """Verify TeachingSession records map accurately into KAIROS Sections and Blocks."""
        adapter = KairosTimetableAdapter(self.db)

        # 3 Theory Sessions
        sessions = [
            TeachingSession(id=101, allocation_id=1, institution_id=2, workspace_id=self.ws_id, section_id=100, faculty_id=1, teaching_type="THEORY", duration_in_periods=1),
            TeachingSession(id=102, allocation_id=1, institution_id=2, workspace_id=self.ws_id, section_id=100, faculty_id=1, teaching_type="THEORY", duration_in_periods=1),
            TeachingSession(id=103, allocation_id=1, institution_id=2, workspace_id=self.ws_id, section_id=100, faculty_id=1, teaching_type="THEORY", duration_in_periods=1),
        ]
        self.db.add_all(sessions)
        self.db.commit()

        k_sections, k_rooms, k_instructors, k_config = adapter.build_solver_inputs(
            self.ws_id, sessions, [self.room], self.periods
        )

        self.assertEqual(len(k_sections), 1)
        k_sec = k_sections[0]
        self.assertEqual(k_sec.section_id, "100_1")
        self.assertEqual(len(k_sec.blocks), 3)
        self.assertEqual(k_sec.T, 3)
        self.assertEqual(k_sec.P, 0)
        self.assertEqual(len(k_rooms), 1)
        self.assertIn("1", k_instructors)
        self.assertEqual(k_instructors["1"].name, "Dr. Renuga")

    def test_map_assignments_to_canonical_entries(self):
        """Verify KAIROS Assignment objects translate cleanly into canonical TimetableEntry rows."""
        adapter = KairosTimetableAdapter(self.db)

        ts = TeachingSession(id=201, allocation_id=1, institution_id=2, workspace_id=self.ws_id, section_id=100, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts)
        self.db.commit()

        # Solver placed block 201 on Wednesday (We), Slot 0 (P1), Room 1
        assignments = [
            Assignment(block_id="201", section_id="100_1", kind="theory", room="1", day="We", start=0, end=1)
        ]

        entries = adapter.map_assignments_to_entries(assignments, [ts], timetable_version_id=10)
        self.assertEqual(len(entries), 1)
        e = entries[0]

        self.assertEqual(e.timetable_version_id, 10)
        self.assertEqual(e.teaching_session_id, 201)
        self.assertEqual(e.day_index, 2)  # Wednesday is day index 2
        self.assertEqual(e.start_period, 1)  # Slot 0 is Period 1
        self.assertEqual(e.duration_in_periods, 1)
        self.assertEqual(e.room_id, 1)
        self.assertEqual(e.faculty_id, 1)

    def test_cross_workspace_session_rejected(self):
        """Teaching sessions belonging to a different workspace must be rejected."""
        adapter = KairosTimetableAdapter(self.db)
        ts_alien = TeachingSession(id=301, allocation_id=1, institution_id=2, workspace_id="ws_different", section_id=100, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts_alien)
        self.db.commit()

        with self.assertRaises(KairosAdapterError) as ctx:
            adapter.build_solver_inputs(self.ws_id, [ts_alien], [self.room], self.periods)
        self.assertIn("belongs to workspace 'ws_different', not 'ws_test_mca'", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
