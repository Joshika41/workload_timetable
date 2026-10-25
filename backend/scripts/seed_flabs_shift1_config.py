"""
Idempotent FLABS Shift 1 Calendar Configuration Seed Script.

Objective:
Configures the official FLABS Shift 1 calendar schedule (08:00 - 12:45)
across all verified FLABS workspaces in Mumbai PostgreSQL.

Schema Target Models:
- TimetableShift
- TimetableConfiguration
- TimetableWorkingDay
- TimetablePeriod
- TimetableBreak

Modes:
--dry-run (default): Evaluates current database state, logs proposed records, and exits without mutating anything.
--apply: Executes the idempotent insertions/upserts inside a transactional session with a PostgreSQL transaction-level advisory lock.
"""

import sys
import os
import argparse
from datetime import time
from typing import List, Dict, Any, Tuple

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.connection import SessionLocal, engine
from app.models.domain import AcademicWorkspace, Institution, Department, Programme, AcademicYear, Semester, SubjectAllocation, AllocationComponent, FacultyProfile
from app.models.timetable import (
    TimetableShift,
    TimetableConfiguration,
    TimetableWorkingDay,
    TimetablePeriod,
    TimetableBreak
)
from sqlalchemy import text


# Official FLABS Shift 1 Timings & Structure
SHIFT_NAME = "Shift 1 (Morning)"
SHIFT_START = time(8, 0, 0)
SHIFT_END = time(12, 45, 0)

WORKING_DAYS = [
    ("Monday", 0),
    ("Tuesday", 1),
    ("Wednesday", 2),
    ("Thursday", 3),
    ("Friday", 4),
]

PERIODS = [
    (1, time(8, 0, 0), time(8, 45, 0), 45),
    (2, time(8, 45, 0), time(9, 30, 0), 45),
    (3, time(9, 30, 0), time(10, 15, 0), 45),
    (4, time(10, 30, 0), time(11, 15, 0), 45),
    (5, time(11, 15, 0), time(12, 0, 0), 45),
    (6, time(12, 0, 0), time(12, 45, 0), 45),
]

BREAKS = [
    ("Tea Break", time(10, 15, 0), time(10, 30, 0)),
]

# Advisory lock key for timetable configuration seed synchronization
ADVISORY_LOCK_ID = 884729104


def get_safe_engine_host(db_engine) -> str:
    """Return hostname only without credentials."""
    url = db_engine.url
    host = url.host or "localhost"
    port = f":{url.port}" if url.port else ""
    return f"{host}{port}"


def capture_workload_snapshot(session) -> Dict[str, Any]:
    """Capture snapshot of workload tables and workspace states to guarantee zero mutation."""
    workspaces = session.execute(text(
        "SELECT id, department_id, programme_id, semester_id, programme_year, workflow_state FROM academic_workspaces ORDER BY id"
    )).fetchall()
    
    allocations = session.execute(text(
        "SELECT id, workspace_id, subject_id, section_id, status FROM subject_allocations ORDER BY id"
    )).fetchall()
    
    components = session.execute(text(
        "SELECT id, allocation_id, role, theory_hours, practical_hours, faculty_id FROM allocation_components ORDER BY id"
    )).fetchall()
    
    faculty = session.execute(text(
        "SELECT id, erp_id, user_id, name, home_department_id, target_workload FROM faculty_profiles ORDER BY id"
    )).fetchall()
    
    return {
        "workspaces": [(w[0], w[1], w[2], w[3], w[4], w[5]) for w in workspaces],
        "allocations": [(a[0], a[1], a[2], a[3], a[4]) for a in allocations],
        "components": [(c[0], c[1], c[2], c[3], c[4], c[5]) for c in components],
        "faculty": [(f[0], f[1], f[2], f[3], f[4], f[5]) for f in faculty]
    }


def compare_workload_snapshots(before: Dict[str, Any], after: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Compare before and after snapshots."""
    differences = []
    if before["workspaces"] != after["workspaces"]:
        differences.append(f"Workspaces mismatch: {len(before['workspaces'])} vs {len(after['workspaces'])}")
    if before["allocations"] != after["allocations"]:
        differences.append(f"Allocations mismatch: {len(before['allocations'])} vs {len(after['allocations'])}")
    if before["components"] != after["components"]:
        differences.append(f"Components mismatch: {len(before['components'])} vs {len(after['components'])}")
    if before["faculty"] != after["faculty"]:
        differences.append(f"Faculty mismatch: {len(before['faculty'])} vs {len(after['faculty'])}")
        
    return (len(differences) == 0, differences)


def run_seed(dry_run: bool = True) -> bool:
    print("=" * 80)
    print("FLABS SHIFT 1 CALENDAR CONFIGURATION SEED")
    print(f"Mode: {'DRY RUN (Read-Only Preview)' if dry_run else 'APPLY (Mutating Transaction)'}")
    print("=" * 80)

    # 1. Connection & Target Safety Check
    safe_host = get_safe_engine_host(engine)
    print(f"[*] Verified Database Host: {safe_host}")
    if "aws-0-ap-south-1.pooler.supabase.com:5432" not in safe_host:
        print(f"[ERROR] Target host is not Mumbai pooler (aws-0-ap-south-1.pooler.supabase.com:5432). Aborting.")
        return False

    session = SessionLocal()

    try:
        # Pre-seed workload snapshot
        snapshot_before = capture_workload_snapshot(session)
        print(f"[*] Pre-execution workload snapshot captured:")
        print(f"    - Workspaces: {len(snapshot_before['workspaces'])}")
        print(f"    - Subject Allocations: {len(snapshot_before['allocations'])}")
        print(f"    - Allocation Components: {len(snapshot_before['components'])}")
        print(f"    - Faculty Profiles: {len(snapshot_before['faculty'])}")

        # 2. Verify Institution FLABS (ID 2)
        flabs_inst = session.query(Institution).filter(Institution.id == 2).first()
        if not flabs_inst or flabs_inst.code != "FLABS":
            print(f"[ERROR] Institution ID 2 is not FLABS. Found: {flabs_inst}")
            return False
        print(f"[*] Target Institution: {flabs_inst.name} ({flabs_inst.code}, ID: {flabs_inst.id})")

        # 3. Query all verified FLABS workspaces
        workspaces = (
            session.query(AcademicWorkspace)
            .join(Department, AcademicWorkspace.department_id == Department.id)
            .join(Programme, AcademicWorkspace.programme_id == Programme.id)
            .join(Semester, AcademicWorkspace.semester_id == Semester.id)
            .join(AcademicYear, AcademicWorkspace.academic_year_id == AcademicYear.id)
            .filter(Department.institution_id == 2)
            .order_by(Department.name, Programme.name, Semester.semester_number)
            .all()
        )

        print(f"[*] Total FLABS Workspaces Discovered in Database: {len(workspaces)}")
        if len(workspaces) != 46:
            print(f"[ERROR] Expected exactly 46 FLABS workspaces, found {len(workspaces)}. Aborting.")
            return False

        # 4. Existing Calendar Record Counts
        curr_shifts = session.query(TimetableShift).count()
        curr_configs = session.query(TimetableConfiguration).count()
        curr_days = session.query(TimetableWorkingDay).count()
        curr_periods = session.query(TimetablePeriod).count()
        curr_breaks = session.query(TimetableBreak).count()

        print("\n--- Current Timetable Database State ---")
        print(f"  - timetable_shifts:         {curr_shifts}")
        print(f"  - timetable_configurations: {curr_configs}")
        print(f"  - timetable_working_days:   {curr_days}")
        print(f"  - timetable_periods:        {curr_periods}")
        print(f"  - timetable_breaks:         {curr_breaks}")

        # 5. Determine Operations for Shift
        print("\n--- Shift 1 Definition Plan ---")
        existing_shift = session.query(TimetableShift).filter(TimetableShift.name == SHIFT_NAME).first()
        if existing_shift:
            # Check correctness of existing shift
            if existing_shift.start_time != SHIFT_START or existing_shift.end_time != SHIFT_END or not existing_shift.active:
                print(f"[ERROR] Existing shift ID {existing_shift.id} has incorrect values: {existing_shift.start_time} - {existing_shift.end_time}. Aborting.")
                return False
            print(f"  [REUSE] Existing Shift: '{existing_shift.name}' (ID: {existing_shift.id}, {existing_shift.start_time}-{existing_shift.end_time})")
            shift_id_to_use = existing_shift.id
            propose_create_shift = False
        else:
            print(f"  [CREATE] New Shift: '{SHIFT_NAME}' ({SHIFT_START.strftime('%H:%M')} - {SHIFT_END.strftime('%H:%M')})")
            propose_create_shift = True
            shift_id_to_use = None

        # 6. Evaluate Each Workspace Configuration
        print("\n--- Workspace Configurations Scope Audit ---")
        configs_to_create = []
        configs_to_reuse = []
        proposed_days = 0
        proposed_periods = 0
        proposed_breaks = 0

        for idx, ws in enumerate(workspaces, 1):
            sem_num = ws.semester.semester_number if ws.semester else "?"
            sem_type = "ODD" if (isinstance(sem_num, int) and sem_num % 2 == 1) else "EVEN"
            ay_name = ws.academic_year.name if ws.academic_year else "2026-2027"

            # Check if configuration already exists
            existing_config = (
                session.query(TimetableConfiguration)
                .filter(
                    TimetableConfiguration.institution_id == 2,
                    TimetableConfiguration.workspace_id == ws.id
                )
                .first()
            )

            ws_summary = f"[{idx:02d}/46] Dept: {ws.department.name} | Prog: {ws.programme.name} | Sem {sem_num} ({sem_type}) | AY: {ay_name}"

            if existing_config:
                configs_to_reuse.append((ws, existing_config))
                # Validate child records
                c_days = session.query(TimetableWorkingDay).filter_by(configuration_id=existing_config.id).count()
                c_periods = session.query(TimetablePeriod).filter_by(configuration_id=existing_config.id).count()
                c_breaks = session.query(TimetableBreak).filter_by(configuration_id=existing_config.id).count()
                print(f"  [REUSE]  {ws_summary} -> Config ID {existing_config.id} (Days: {c_days}, Periods: {c_periods}, Breaks: {c_breaks})")
            else:
                configs_to_create.append(ws)
                proposed_days += len(WORKING_DAYS)
                proposed_periods += len(PERIODS)
                proposed_breaks += len(BREAKS)
                print(f"  [CREATE] {ws_summary} -> Workspace ID: {ws.id}")

        # 7. Summary Projection
        print("\n" + "=" * 80)
        print("PROJECTION & SUMMARY")
        print("=" * 80)
        print(f"Target Institution:               FLABS (ID 2)")
        print(f"Total Workspaces In Scope:        {len(workspaces)}")
        print(f"Configurations to Create:         {len(configs_to_create)}")
        print(f"Configurations to Reuse:          {len(configs_to_reuse)}")
        print(f"New Shift Records:                {1 if propose_create_shift else 0}")
        print(f"New Working Day Records:          {proposed_days}")
        print(f"New Period Records (45-min):      {proposed_periods}")
        print(f"New Break Records:                {proposed_breaks}")

        expected_shifts = curr_shifts + (1 if propose_create_shift else 0)
        expected_configs = curr_configs + len(configs_to_create)
        expected_days = curr_days + proposed_days
        expected_periods = curr_periods + proposed_periods
        expected_breaks = curr_breaks + proposed_breaks

        print("\nExpected Final Row Counts after Apply:")
        print(f"  - timetable_shifts:         {curr_shifts} -> {expected_shifts}")
        print(f"  - timetable_configurations: {curr_configs} -> {expected_configs}")
        print(f"  - timetable_working_days:   {curr_days} -> {expected_days}")
        print(f"  - timetable_periods:        {curr_periods} -> {expected_periods}")
        print(f"  - timetable_breaks:         {curr_breaks} -> {expected_breaks}")

        if dry_run:
            print("\n[CONFIRMATION] DRY-RUN MODE: No database records were created, modified, or deleted.")
            return True

        # 8. Mutating Path (Only executed when dry_run=False)
        print("\n[*] Commencing transactional application with advisory lock...")
        # Acquire transaction-level PostgreSQL advisory lock
        session.execute(text(f"SELECT pg_advisory_xact_lock({ADVISORY_LOCK_ID});"))

        # Create Shift if needed
        if propose_create_shift:
            new_shift = TimetableShift(
                name=SHIFT_NAME,
                start_time=SHIFT_START,
                end_time=SHIFT_END,
                active=True
            )
            session.add(new_shift)
            session.flush()
            shift_id_to_use = new_shift.id
            print(f"  [+] Created TimetableShift ID: {shift_id_to_use}")

        # Create configurations and child records
        for ws in configs_to_create:
            ay_name = ws.academic_year.name if ws.academic_year else "2026-2027"
            new_config = TimetableConfiguration(
                institution_id=2,
                workspace_id=ws.id,
                shift_id=shift_id_to_use,
                academic_year=ay_name,
                active=True,
                configuration_version=1
            )
            session.add(new_config)
            session.flush()

            # Add working days
            for day_name, day_idx in WORKING_DAYS:
                session.add(TimetableWorkingDay(
                    configuration_id=new_config.id,
                    day_name=day_name,
                    day_index=day_idx,
                    active=True
                ))

            # Add periods
            for p_num, p_start, p_end, p_dur in PERIODS:
                session.add(TimetablePeriod(
                    configuration_id=new_config.id,
                    shift_id=shift_id_to_use,
                    period_number=p_num,
                    start_time=p_start,
                    end_time=p_end,
                    duration_minutes=p_dur,
                    active=True
                ))

            # Add breaks
            for b_name, b_start, b_end in BREAKS:
                session.add(TimetableBreak(
                    configuration_id=new_config.id,
                    name=b_name,
                    start_time=b_start,
                    end_time=b_end,
                    active=True
                ))

        session.commit()
        print("\n[SUCCESS] Transaction committed successfully. All records seeded.")

        # 9. Workload Invariant Verification Post-Apply
        snapshot_after = capture_workload_snapshot(session)
        intact, diffs = compare_workload_snapshots(snapshot_before, snapshot_after)
        if not intact:
            print(f"[FATAL ERROR] Workload tables were mutated! Differences: {diffs}")
            return False
        print("[*] Workload tables invariant verified: ZERO mutations to workload/workspace records.")
        return True

    except Exception as e:
        session.rollback()
        print(f"\n[ERROR] Transaction aborted due to error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed FLABS Shift 1 Master Calendar Configuration.")
    parser.add_argument("--apply", action="store_true", help="Apply changes to the database (defaults to dry-run).")
    args = parser.parse_args()

    is_dry_run = not args.apply
    success = run_seed(dry_run=is_dry_run)
    if not success:
        sys.exit(1)
