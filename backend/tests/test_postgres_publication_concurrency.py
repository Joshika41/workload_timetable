"""
Phase 5.3 PostgreSQL Concurrency Integration Test.

STRICT SAFEGUARD:
- Uses ONLY a disposable/test PostgreSQL instance specified explicitly via TEST_POSTGRES_URL.
- NEVER connects to or mutates Mumbai PostgreSQL, production database, or default DATABASE_URL.
- If TEST_POSTGRES_URL is not set or empty, skips PostgreSQL concurrency tests and reports that the
  environment variable was not configured.
"""

import os
import sys
import unittest
import threading
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

TEST_POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL")


@unittest.skipUnless(
    TEST_POSTGRES_URL and ("localhost" in TEST_POSTGRES_URL or "127.0.0.1" in TEST_POSTGRES_URL or "test" in TEST_POSTGRES_URL.lower()),
    "Requires TEST_POSTGRES_URL pointing to a dedicated test/disposable PostgreSQL database."
)
class TestPostgresPublicationConcurrency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Strict safeguard: forbid production database access
        assert "aws-0-ap-south-1.pooler.supabase.com" not in TEST_POSTGRES_URL, (
            "FATAL: TEST_POSTGRES_URL cannot point to production Mumbai PostgreSQL!"
        )
        cls.engine = create_engine(TEST_POSTGRES_URL, pool_size=5, max_overflow=5)
        Base.metadata.create_all(cls.engine)
        cls.SessionLocal = sessionmaker(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(cls.engine)
        cls.engine.dispose()

    def setUp(self):
        self.db = self.SessionLocal()
        # Seed test workspace, configs, faculty, and room
        inst = Institution(id=92, name="Flabs Test", code="FLABS_TEST")
        dept1 = Department(id=95, institution_id=92, name="Dept 1")
        dept2 = Department(id=96, institution_id=92, name="Dept 2")
        prog1 = Programme(id=96, department_id=95, name="P1", programme_type="PG")
        prog2 = Programme(id=97, department_id=96, name="P2", programme_type="UG")
        ay = AcademicYear(id=91, name="2026-2027")
        sem = Semester(id=91, semester_number=1, name="Sem 1")
        self.db.add_all([inst, dept1, dept2, prog1, prog2, ay, sem])
        self.db.commit()

        ws1 = AcademicWorkspace(id="ws_pg_1", department_id=95, programme_id=96, academic_year_id=91, semester_id=91, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1)
        ws2 = AcademicWorkspace(id="ws_pg_2", department_id=96, programme_id=97, academic_year_id=91, semester_id=91, programme_year=1, workflow_state=WorkspaceWorkflowStateEnum.FINALIZED, version=1)
        self.db.add_all([ws1, ws2])

        u1 = User(id=91, email="fac91@test.com", hashed_password="pw", role=RoleEnum.FACULTY)
        self.db.add(u1)
        self.db.commit()

        fac = FacultyProfile(id=91, user_id=91, erp_id="FAC_91", name="Dr. Concurrent", home_department_id=95, designation="Professor")
        room = TimetableRoom(id=91, institution_id=92, room_code="CR_CONC", room_name="Conc Room", room_type="CLASSROOM", capacity=50)
        self.db.add_all([fac, room])

        cfg1 = TimetableConfiguration(id=91, institution_id=92, workspace_id="ws_pg_1")
        cfg2 = TimetableConfiguration(id=92, institution_id=92, workspace_id="ws_pg_2")
        self.db.add_all([cfg1, cfg2])
        self.db.commit()

        self.db.add_all([
            TimetablePeriod(configuration_id=91, period_number=1, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45, active=True),
            TimetablePeriod(configuration_id=92, period_number=1, start_time=time(8, 0), end_time=time(8, 45), duration_minutes=45, active=True),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_concurrent_conflicting_publications_on_postgres(self):
        """
        Launches two truly concurrent publication transactions on PostgreSQL using separate database sessions.
        The advisory transaction lock ensures that one transaction acquires the gate first,
        reads published entries, transitions to PUBLISHED, and commits.
        The second transaction unblocks, re-reads published entries, detects the collision, and raises
        TimetablePublicationConflictError, remaining in DRAFT.
        """
        # Create Draft 1
        run1 = TimetableRun(id=901, run_id="run_pg_1", workspace_id="ws_pg_1", configuration_id=91, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run1)
        self.db.flush()
        ver1 = TimetableVersion(id=9010, run_id=901, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver1)
        self.db.flush()
        ts1 = TeachingSession(id=901, allocation_id=1, institution_id=92, workspace_id="ws_pg_1", section_id=101, faculty_id=91, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts1)
        self.db.flush()
        e1 = TimetableEntry(timetable_version_id=9010, teaching_session_id=901, faculty_id=91, section_id=101, room_id=91, day_index=0, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(e1)

        # Create Draft 2 (Conflicting on same day, period, faculty, room)
        run2 = TimetableRun(id=902, run_id="run_pg_2", workspace_id="ws_pg_2", configuration_id=92, status=TimetableStatusEnum.COMPLETED)
        self.db.add(run2)
        self.db.flush()
        ver2 = TimetableVersion(id=9020, run_id=902, status=TimetableVersionStatusEnum.DRAFT)
        self.db.add(ver2)
        self.db.flush()
        ts2 = TeachingSession(id=902, allocation_id=2, institution_id=92, workspace_id="ws_pg_2", section_id=102, faculty_id=91, teaching_type="THEORY", duration_in_periods=1)
        self.db.add(ts2)
        self.db.flush()
        e2 = TimetableEntry(timetable_version_id=9020, teaching_session_id=902, faculty_id=91, section_id=102, room_id=91, day_index=0, start_period=1, duration_in_periods=1, session_type="THEORY")
        self.db.add(e2)
        self.db.commit()

        results = {}
        exceptions = {}

        def attempt_publish(v_id: int, thread_name: str):
            session = self.SessionLocal()
            try:
                res = publish_timetable_version(v_id, session)
                results[thread_name] = res
            except Exception as e:
                exceptions[thread_name] = e
            finally:
                session.close()

        t1 = threading.Thread(target=attempt_publish, args=(9010, "thread_1"))
        t2 = threading.Thread(target=attempt_publish, args=(9020, "thread_2"))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Exactly one must succeed, and exactly one must fail with TimetablePublicationConflictError
        self.assertEqual(len(results), 1, f"Expected exactly one success, got {results}")
        self.assertEqual(len(exceptions), 1, f"Expected exactly one conflict error, got {exceptions}")

        failed_thread = list(exceptions.keys())[0]
        self.assertIsInstance(exceptions[failed_thread], TimetablePublicationConflictError)

        # Inspect database state with fresh session
        verify_db = self.SessionLocal()
        v1_status = verify_db.get(TimetableVersion, 9010).status
        v2_status = verify_db.get(TimetableVersion, 9020).status
        verify_db.close()

        statuses = {v1_status, v2_status}
        self.assertIn(TimetableVersionStatusEnum.PUBLISHED, statuses)
        self.assertIn(TimetableVersionStatusEnum.DRAFT, statuses)


if __name__ == "__main__":
    unittest.main()
