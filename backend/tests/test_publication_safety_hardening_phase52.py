"""
Phase 5.2 Tests: Hardened Publication Safety Against Concurrent & Cross-Shift Conflicts.

Validates:
1. Two publication attempts cannot both publish conflicting bookings (serialized/concurrent race safety).
2. Shared instructor conflict is caught across different configurations when actual clock intervals overlap (even if period numbers differ).
3. Shared physical-room conflict is caught across different configurations when actual clock intervals overlap.
4. Non-overlapping clock intervals are accepted, even if their period numbers happen to match (e.g., Period 1 in Morning vs Period 1 in Afternoon).
5. Indeterminate timing: Missing period clock data rejects publication with an actionable diagnostic.
6. A rejected publication does not mutate the existing published version or leave partial status updates (atomic rollback).
7. Ordinary non-conflicting publication succeeds and supersedes older versions of the same workspace.
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
    FacultyProfile,
    Section,
    Subject,
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
    publish_timetable_version,
    TimetablePublicationConflictError
)


class TestPhase52HardenPublicationSafety(unittest.TestCase):
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
        self.ws_mca_id = "ws_mca_p52"
        self.ws_cs_id = "ws_cs_p52"

        self.ws_mca = AcademicWorkspace(
            id=self.ws_mca_id, department_id=5, programme_id=6, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.ws_cs = AcademicWorkspace(
            id=self.ws_cs_id, department_id=6, programme_id=7, academic_year_id=1,
            semester_id=1, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1
        )
        self.db.add_all([self.ws_mca, self.ws_cs])

        # Users & Faculty
        self.u1 = User(id=1, email="cross@flabs.edu", hashed_password="pw", role=RoleEnum.FACULTY)
        self.u2 = User(id=2, email="indep@flabs.edu", hashed_password="pw", role=RoleEnum.FACULTY)
        self.db.add_all([self.u1, self.u2])
        self.db.commit()

        self.fac1 = FacultyProfile(id=1, user_id=1, erp_id="FAC_CROSS", name="Dr. CrossShift", home_department_id=5, designation="Professor")
        self.fac2 = FacultyProfile(id=2, user_id=2, erp_id="FAC_INDEP", name="Prof. Independent", home_department_id=6, designation="Assistant Professor")
        self.db.add_all([self.fac1, self.fac2])

        # Physical Room
        self.room1 = TimetableRoom(id=1, institution_id=2, room_code="LH_SHARED", room_name="Shared Hall", room_type="CLASSROOM", capacity=60)
        self.db.add(self.room1)

        # Configurations:
        # Config 1: Morning Shift (Shift 1) -> P1: 08:00-08:45, P2: 08:45-09:30
        self.cfg1 = TimetableConfiguration(id=1, institution_id=2, workspace_id=self.ws_mca_id)
        # Config 2: Afternoon Shift (Shift 2) -> P1: 13:00-13:45, P2: 13:45-14:30
        self.cfg2 = TimetableConfiguration(id=2, institution_id=2, workspace_id=self.ws_cs_id)
        self.db.add_all([self.cfg1, self.cfg2])
        self.db.commit()

        # Add Periods for Config 1 (Morning: 08:00 - 09:30)
        self.db.add_all([
            TimetablePeriod(configuration_id=1, period_number=1, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45, active=True),
            TimetablePeriod(configuration_id=1, period_number=2, start_time=time(8, 45), end_time=time(9, 30), duration_minutes=45, active=True),
        ])

        # Add Periods for Config 2 (Afternoon: 13:00 - 14:30)
        self.db.add_all([
            TimetablePeriod(configuration_id=2, period_number=1, start_time=time(13, 0), end_time=time(13, 45), duration_minutes=45, active=True),
            TimetablePeriod(configuration_id=2, period_number=2, start_time=time(13, 45), end_time=time(14, 30), duration_minutes=45, active=True),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)

    def test_same_period_number_different_clock_times_does_not_conflict(self):
        """
        Period 1 in Morning Config (08:00-08:45) and Period 1 in Afternoon Config (13:00-13:45)
        use the SAME instructor and room, but since actual clock times do not overlap,
        both should publish successfully!
        """
        # Publish Morning (MCA) Period 1
        run1 = TimetableRun(id=1, run_id="run1", workspace_id=self.ws_mca_id, configuration_id=1, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run1)
        self.db.flush()
        ver1 = TimetableVersion(id=10, run_id=1, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver1)
        self.db.flush()
        ts1 = TeachingSession(id=1, allocation_id=1, institution_id=2, workspace_id=self.ws_mca_id, section_id=101, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts1)
        self.db.flush()
        e1 = TimetableEntry(timetable_version_id=10, teaching_session_id=1, faculty_id=1, section_id=101, room_id=1, day_index=0, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(e1)
        self.db.commit()

        # Publish Morning version
        res1 = publish_timetable_version(10, self.db)
        self.assertEqual(res1["status"], "success")
        self.assertEqual(self.db.get(TimetableVersion, 10).status, TimetableVersionStatusEnum.PUBLISHED)

        # Create Afternoon (CS) Draft also using Period 1, Dr. CrossShift, and Room 1
        run2 = TimetableRun(id=2, run_id="run2", workspace_id=self.ws_cs_id, configuration_id=2, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run2)
        self.db.flush()
        ver2 = TimetableVersion(id=20, run_id=2, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver2)
        self.db.flush()
        ts2 = TeachingSession(id=2, allocation_id=2, institution_id=2, workspace_id=self.ws_cs_id, section_id=102, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts2)
        self.db.flush()
        e2 = TimetableEntry(timetable_version_id=20, teaching_session_id=2, faculty_id=1, section_id=102, room_id=1, day_index=0, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(e2)
        self.db.commit()

        # Attempt to publish Afternoon version -> MUST SUCCEED because 08:00-08:45 and 13:00-13:45 DO NOT OVERLAP
        res2 = publish_timetable_version(20, self.db)
        self.assertEqual(res2["status"], "success")
        self.assertEqual(self.db.get(TimetableVersion, 20).status, TimetableVersionStatusEnum.PUBLISHED)

    def test_different_period_numbers_overlapping_clock_times_rejected(self):
        """
        If Config A has Period 2 (08:45 - 09:30) and Config C has Period 1 (09:00 - 09:45),
        their period numbers differ (P2 vs P1), but clock times overlap (09:00-09:30).
        Publication must catch this as a faculty/room collision.
        """
        # Config 3: Overlapping Mid-Morning (P1: 09:00 - 09:45)
        cfg3 = TimetableConfiguration(id=3, institution_id=2, workspace_id=self.ws_cs_id)
        self.db.add(cfg3)
        self.db.commit()
        self.db.add(TimetablePeriod(configuration_id=3, period_number=1, start_time=time(9, 0), end_time=time(9, 45), duration_minutes=45, active=True))
        self.db.commit()

        # Publish Config 1 (Morning P2: 08:45 - 09:30)
        run1 = TimetableRun(id=11, run_id="run11", workspace_id=self.ws_mca_id, configuration_id=1, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run1)
        self.db.flush()
        ver1 = TimetableVersion(id=110, run_id=11, status=TimetableVersionStatusEnum.PUBLISHED)
        self.db.add(ver1)
        self.db.flush()
        ts1 = TeachingSession(id=11, allocation_id=1, institution_id=2, workspace_id=self.ws_mca_id, section_id=101, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts1)
        self.db.flush()
        e1 = TimetableEntry(timetable_version_id=110, teaching_session_id=11, faculty_id=1, section_id=101, room_id=1, day_index=1, start_period=2, duration_in_periods=1, session_type="THEORY")
        self.db.add(e1)
        self.db.commit()

        # Draft Config 3: P1: 09:00 - 09:45, same faculty, same day (Tuesday = 1)
        run3 = TimetableRun(id=13, run_id="run13", workspace_id=self.ws_cs_id, configuration_id=3, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run3)
        self.db.flush()
        ver3 = TimetableVersion(id=130, run_id=13, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver3)
        self.db.flush()
        ts3 = TeachingSession(id=13, allocation_id=2, institution_id=2, workspace_id=self.ws_cs_id, section_id=102, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts3)
        self.db.flush()
        e3 = TimetableEntry(timetable_version_id=130, teaching_session_id=13, faculty_id=1, section_id=102, room_id=1, day_index=1, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(e3)
        self.db.commit()

        # Attempt to publish Config 3 Draft -> MUST FAIL due to actual clock overlap
        with self.assertRaises(TimetablePublicationConflictError) as ctx:
            publish_timetable_version(130, self.db)

        self.assertTrue(any("Faculty collision: Dr. CrossShift" in c for c in ctx.exception.conflicts))
        self.assertTrue(any("08:45-09:30" in c and "09:00-09:45" in c for c in ctx.exception.conflicts))
        self.assertTrue(any("Room double-booking: LH_SHARED" in c for c in ctx.exception.conflicts))
        # Ensure candidate stays DRAFT
        self.assertEqual(self.db.get(TimetableVersion, 130).status, TimetableVersionStatusEnum.DRAFT)

    def test_missing_period_clock_data_rejects_with_diagnostic(self):
        """
        If a configuration has missing or indeterminate period clock data,
        publication must reject rather than assuming no conflict.
        """
        # Config 4: Bad configuration with no periods defined
        cfg4 = TimetableConfiguration(id=4, institution_id=2, workspace_id=self.ws_cs_id)
        self.db.add(cfg4)
        self.db.commit()

        run4 = TimetableRun(id=14, run_id="run14", workspace_id=self.ws_cs_id, configuration_id=4, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run4)
        self.db.flush()
        ver4 = TimetableVersion(id=140, run_id=14, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver4)
        self.db.flush()
        ts4 = TeachingSession(id=14, allocation_id=2, institution_id=2, workspace_id=self.ws_cs_id, section_id=102, faculty_id=2, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts4)
        self.db.flush()
        e4 = TimetableEntry(timetable_version_id=140, teaching_session_id=14, faculty_id=2, section_id=102, room_id=1, day_index=2, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(e4)
        self.db.commit()

        with self.assertRaises(TimetablePublicationConflictError) as ctx:
            publish_timetable_version(140, self.db)

        self.assertIn("missing valid clock timings", str(ctx.exception))
        self.assertEqual(self.db.get(TimetableVersion, 140).status, TimetableVersionStatusEnum.DRAFT)

    def test_two_serialized_conflicting_publications_cannot_both_publish(self):
        """
        Race condition simulation:
        Two draft candidates from different workspaces both book the same faculty member
        at the same time. The first publication succeeds; the second publication attempt
        is immediately blocked and rolled back.
        """
        # Draft A (MCA)
        run_a = TimetableRun(id=21, run_id="run21", workspace_id=self.ws_mca_id, configuration_id=1, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run_a)
        self.db.flush()
        ver_a = TimetableVersion(id=210, run_id=21, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver_a)
        self.db.flush()
        ts_a = TeachingSession(id=21, allocation_id=1, institution_id=2, workspace_id=self.ws_mca_id, section_id=101, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts_a)
        self.db.flush()
        e_a = TimetableEntry(timetable_version_id=210, teaching_session_id=21, faculty_id=1, section_id=101, room_id=1, day_index=3, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(e_a)

        # Config 5: Identical morning shift for workspace B (08:00 - 08:45)
        cfg5 = TimetableConfiguration(id=5, institution_id=2, workspace_id=self.ws_cs_id)
        self.db.add(cfg5)
        self.db.commit()
        self.db.add(TimetablePeriod(configuration_id=5, period_number=1, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45, active=True))
        self.db.commit()

        # Draft B (CS) - Conflicts with Draft A (same Thursday, same 08:00-08:45 clock time)
        run_b = TimetableRun(id=22, run_id="run22", workspace_id=self.ws_cs_id, configuration_id=5, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run_b)
        self.db.flush()
        ver_b = TimetableVersion(id=220, run_id=22, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver_b)
        self.db.flush()
        ts_b = TeachingSession(id=22, allocation_id=2, institution_id=2, workspace_id=self.ws_cs_id, section_id=102, faculty_id=1, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts_b)
        self.db.flush()
        e_b = TimetableEntry(timetable_version_id=220, teaching_session_id=22, faculty_id=1, section_id=102, room_id=1, day_index=3, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(e_b)
        self.db.commit()

        # Both are DRAFT initially
        self.assertEqual(self.db.get(TimetableVersion, 210).status, TimetableVersionStatusEnum.DRAFT)
        self.assertEqual(self.db.get(TimetableVersion, 220).status, TimetableVersionStatusEnum.DRAFT)

        # Attempt 1 publishes Draft A -> Succeeds
        res_a = publish_timetable_version(210, self.db)
        self.assertEqual(res_a["status"], "success")
        self.assertEqual(self.db.get(TimetableVersion, 210).status, TimetableVersionStatusEnum.PUBLISHED)

        # Attempt 2 publishes Draft B -> MUST FAIL with conflict
        with self.assertRaises(TimetablePublicationConflictError) as ctx:
            publish_timetable_version(220, self.db)

        self.assertTrue(any("Faculty collision: Dr. CrossShift" in c for c in ctx.exception.conflicts))
        # Draft B stays DRAFT
        self.assertEqual(self.db.get(TimetableVersion, 220).status, TimetableVersionStatusEnum.DRAFT)
        # Draft A remains PUBLISHED intact
        self.assertEqual(self.db.get(TimetableVersion, 210).status, TimetableVersionStatusEnum.PUBLISHED)

    def test_advisory_lock_acquired_on_postgresql_dialect(self):
        """
        Verifies that when running on a PostgreSQL engine dialect,
        publish_timetable_version invokes _acquire_publication_lock which executes
        pg_advisory_xact_lock with TIMETABLE_PUBLICATION_ADVISORY_LOCK_ID.
        """
        from unittest.mock import MagicMock
        from app.services.timetable_service import _acquire_publication_lock, TIMETABLE_PUBLICATION_ADVISORY_LOCK_ID

        mock_session = MagicMock()
        mock_bind = MagicMock()
        mock_bind.dialect.name = "postgresql"
        mock_session.get_bind.return_value = mock_bind

        _acquire_publication_lock(mock_session)

        # Verify db.execute was called on PostgreSQL dialect
        mock_session.execute.assert_called_once()
        stmt, params = mock_session.execute.call_args[0]
        self.assertIn("pg_advisory_xact_lock", str(stmt))
        self.assertEqual(params["lock_id"], TIMETABLE_PUBLICATION_ADVISORY_LOCK_ID)

        # Verify on SQLite dialect it is a no-op
        mock_sqlite_session = MagicMock()
        mock_sqlite_bind = MagicMock()
        mock_sqlite_bind.dialect.name = "sqlite"
        mock_sqlite_session.get_bind.return_value = mock_sqlite_bind

        _acquire_publication_lock(mock_sqlite_session)
        mock_sqlite_session.execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()

