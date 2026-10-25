import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.domain import (
    AcademicWorkspace,
    WorkspaceWorkflowStateEnum,
    WorkloadVersion,
    SubjectAllocation,
    AllocationComponent,
    Section,
    FacultyProfile,
    Subject,
    User,
    RoleEnum
)
from app.models.timetable import (
    TimetableConfiguration,
    TimetablePeriod,
    TimetableRoom,
    TeachingSession,
    TimetableRun,
    TimetableStatusEnum,
    TimetableVersion,
    TimetableVersionStatusEnum,
    TimetableEntry,
    SynchronizedGroupMember
)
from app.services.teaching_session_builder import TeachingSessionBuilder, TeachingSessionBuildError
from app.services.kairos_adapter import KairosTimetableAdapter, KairosAdapterError


class TimetableGenerationError(Exception):
    """Raised when canonical timetable generation preflight or solve fails."""
    def __init__(self, message: str, preflight_errors: Optional[List[str]] = None, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.preflight_errors = preflight_errors or []
        self.status_code = status_code


def validate_user_workspace_authorization(current_user: User, workspace: AcademicWorkspace) -> None:
    """
    Enforces server-side authorization: user can only generate timetables
    for workspaces within their authorized department/institution.
    """
    if current_user.role == RoleEnum.MASTER_ADMIN:
        return

    is_hod = False
    if current_user.role in [RoleEnum.HOD, RoleEnum.ERP_COORDINATOR]:
        is_hod = True
    elif current_user.role == RoleEnum.FACULTY and current_user.faculty_profile:
        desig = (current_user.faculty_profile.designation or "").upper()
        if "HOD" in desig or "HEAD" in desig:
            is_hod = True

    if is_hod:
        if current_user.department_id != workspace.department_id:
            raise TimetableGenerationError(
                f"User is not authorized for department ID {workspace.department_id} of workspace '{workspace.id}'.",
                status_code=403
            )
    else:
        raise TimetableGenerationError(
            "Only HOD, ERP Coordinator, or Administrators can initiate timetable generation.",
            status_code=403
        )


def run_timetable_preflight_checks(workspace_id: str, db: Session) -> Dict[str, Any]:
    """
    Comprehensive preflight check ensuring all prerequisite academic data
    is finalized, positive, and complete before invoking the KAIROS solver.
    Returns dictionary with config, periods, rooms, and sections if valid;
    raises TimetableGenerationError with actionable diagnostics if invalid.
    """
    errors: List[str] = []

    # 1. Workspace existence & finalization
    ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not ws:
        raise TimetableGenerationError(f"Academic workspace '{workspace_id}' not found.", status_code=404)

    if ws.workflow_state != WorkspaceWorkflowStateEnum.FINALIZED:
        errors.append(
            f"Workspace '{workspace_id}' is in '{ws.workflow_state.value if hasattr(ws.workflow_state, 'value') else ws.workflow_state}' state. "
            f"Workload must be FINALIZED before timetable generation."
        )

    # 2. Active WorkloadVersion snapshot
    wv = (
        db.query(WorkloadVersion)
        .filter(WorkloadVersion.workspace_id == workspace_id)
        .order_by(WorkloadVersion.version_no.desc())
        .first()
    )
    if not wv:
        errors.append(f"Workspace '{workspace_id}' has no active WorkloadVersion snapshot.")

    # 3. Calendar Configuration & Periods
    cfg = db.query(TimetableConfiguration).filter(
        TimetableConfiguration.workspace_id == workspace_id,
        TimetableConfiguration.active == True
    ).first()
    if not cfg:
        errors.append(f"No active TimetableConfiguration found for workspace '{workspace_id}'.")
        periods = []
    else:
        periods = (
            db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.configuration_id == cfg.id,
                TimetablePeriod.active == True
            )
            .order_by(TimetablePeriod.period_number.asc())
            .all()
        )
        if not periods or len(periods) < 6:
            errors.append(
                f"TimetableConfiguration ID {cfg.id} has {len(periods)} periods. "
                f"FLABS Shift 1 requires exactly 6 periods."
            )

    # 4. Sections & Student Strengths
    sections = db.query(Section).filter(Section.workspace_id == workspace_id).all()
    if not sections:
        errors.append(f"Workspace '{workspace_id}' has no sections defined.")
    else:
        for sec in sections:
            if not sec.student_strength or sec.student_strength <= 0:
                errors.append(
                    f"Section '{sec.name}' (ID {sec.id}) has invalid student_strength: {sec.student_strength}. "
                    f"Positive student strength is required for room capacity verification."
                )

    # 5. Rooms & Capacities
    # Query rooms available for this workspace, filtered by department/building scope
    rooms_query = db.query(TimetableRoom).filter(
        TimetableRoom.active == True,
        (TimetableRoom.workspace_id == workspace_id) | (TimetableRoom.workspace_id == None)
    )
    if ws.department_id == 5:
        # Match PG Block, or rooms explicitly assigned to this workspace
        rooms_query = rooms_query.filter(
            (TimetableRoom.building == "PG Block") | (TimetableRoom.workspace_id == workspace_id)
        )
    elif ws.department_id == 1:
        rooms_query = rooms_query.filter(
            TimetableRoom.building.in_(["Block 5", "BMS Block"]) | (TimetableRoom.workspace_id == workspace_id)
        )

    rooms = rooms_query.all()
    if not rooms:
        errors.append(
            f"No active TimetableRoom records found for workspace '{workspace_id}' (Department {ws.department_id}). "
            f"Authoritative room records with verified capacities must be provided."
        )

    if errors:
        raise TimetableGenerationError(
            f"Preflight checks failed for workspace '{workspace_id}'.",
            preflight_errors=errors,
            status_code=422
        )

    return {
        "workspace": ws,
        "configuration": cfg,
        "periods": periods,
        "sections": sections,
        "rooms": rooms
    }


def generate_timetable_canonical(workspace_id: str, db: Session, current_user: Optional[User] = None) -> Dict[str, Any]:
    """
    Canonical Timetable Generation Orchestrator.
    Executes:
    1. Authorization verification.
    2. Rigorous academic preflight checks.
    3. Session preparation via TeachingSessionBuilder.
    4. Input transformation via KairosTimetableAdapter.
    5. Real KAIROS CP-SAT solve.
    6. Post-solve independent validation.
    7. Atomic persistence of TimetableRun, TimetableVersion (DRAFT), and TimetableEntry rows.
    Rolls back automatically on failure without mutating existing published schedules.
    """
    try:
        from vendor.KAIROS.src.timetabling.pipeline import run_pipeline
    except ImportError:
        # Fallback to direct import if vendor path in sys.path
        from src.timetabling.pipeline import run_pipeline

    # 1. Preflight
    preflight = run_timetable_preflight_checks(workspace_id, db)
    ws = preflight["workspace"]
    cfg = preflight["configuration"]
    periods = preflight["periods"]
    rooms = preflight["rooms"]

    # Authorization
    if current_user:
        validate_user_workspace_authorization(current_user, ws)

    # 2. Synthesize TeachingSession records
    builder = TeachingSessionBuilder(db)
    try:
        sessions = builder.build_sessions_for_workspace(workspace_id)
    except TeachingSessionBuildError as e:
        raise TimetableGenerationError(str(e), status_code=422)

    if not sessions:
        raise TimetableGenerationError(f"No teaching sessions could be synthesized for workspace '{workspace_id}'.", status_code=422)

    # 3. Build KAIROS inputs
    adapter = KairosTimetableAdapter(db)
    try:
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_solver_inputs(
            workspace_id=workspace_id,
            sessions=sessions,
            rooms=rooms,
            periods=periods
        )
    except KairosAdapterError as e:
        raise TimetableGenerationError(f"Adapter preparation failed: {e}", status_code=422)

    # 4. Execute Real KAIROS Pipeline
    start_time = datetime.now(timezone.utc)
    pipeline_res = run_pipeline(
        "FLABS_SHIFT_1",
        k_sections,
        k_rooms,
        k_instructors,
        k_cfg,
        solver="cpsat"
    )
    end_time = datetime.now(timezone.utc)
    duration_sec = int((end_time - start_time).total_seconds())

    # 5. Check Solver Status & Hard Violations
    is_feasible = (len(pipeline_res.violations) == 0) and (len(pipeline_res.assignments) == len(sessions))
    if not is_feasible:
        # Construct diagnostic
        viol_msgs = [f"{v.kind}: {v.detail}" for v in pipeline_res.violations]
        missing_count = len(sessions) - len(pipeline_res.assignments)
        diag = {
            "feasible": False,
            "violations": viol_msgs,
            "expected_sessions": len(sessions),
            "placed_assignments": len(pipeline_res.assignments),
            "unplaced_sessions": missing_count
        }
        # Safely log run failure without creating a false successful version
        try:
            failed_run = TimetableRun(
                run_id=f"run_{uuid.uuid4().hex[:12]}",
                workspace_id=workspace_id,
                configuration_id=cfg.id,
                status=TimetableStatusEnum.FAILED,
                solver_name="KAIROS_CPSAT",
                solver_version="2.0",
                started_at=start_time,
                completed_at=end_time,
                duration_seconds=duration_sec,
                expected_sessions=len(sessions),
                scheduled_sessions=len(pipeline_res.assignments),
                hard_violation_count=len(pipeline_res.violations),
                diagnostics_json=diag,
                error_message="KAIROS solver returned infeasible candidate."
            )
            db.add(failed_run)
            db.commit()
        except Exception:
            db.rollback()

        raise TimetableGenerationError(
            f"KAIROS solver failed to find a feasible timetable: {len(pipeline_res.violations)} hard violations, "
            f"{missing_count} sessions unplaced.",
            preflight_errors=viol_msgs,
            status_code=422
        )

    # 6. Map Assignments & Atomically Persist Draft Candidate
    try:
        soft_cost = int(pipeline_res.stats.get("cost", 0)) if pipeline_res.stats else 0
        run_record = TimetableRun(
            run_id=f"run_{uuid.uuid4().hex[:12]}",
            workspace_id=workspace_id,
            configuration_id=cfg.id,
            status=TimetableStatusEnum.COMPLETED,
            solver_name="KAIROS_CPSAT",
            solver_version="2.0",
            started_at=start_time,
            completed_at=end_time,
            duration_seconds=duration_sec,
            expected_sessions=len(sessions),
            scheduled_sessions=len(pipeline_res.assignments),
            hard_violation_count=0,
            soft_score=soft_cost,
            diagnostics_json={"feasible": True, "violations": []}
        )
        db.add(run_record)
        db.flush()

        version_record = TimetableVersion(
            run_id=run_record.id,
            status=TimetableVersionStatusEnum.DRAFT
        )
        db.add(version_record)
        db.flush()

        entries = adapter.map_assignments_to_entries(
            assignments=pipeline_res.assignments,
            sessions=sessions,
            timetable_version_id=version_record.id
        )
        db.add_all(entries)
        db.commit()

        return {
            "status": "COMPLETED",
            "version_status": "DRAFT",
            "version_id": version_record.id,
            "run_id": run_record.id,
            "workspace_id": workspace_id,
            "scheduled_sessions": len(entries),
            "duration_seconds": duration_sec,
            "violations": 0
        }

    except Exception as e:
        db.rollback()
        raise TimetableGenerationError(f"Atomic persistence of timetable candidate failed: {e}", status_code=500)


def generate_timetable(workspace_id: str, db: Session, current_user: Optional[User] = None):
    """
    Main entry point invoked by the router. Calls canonical generation.
    """
    return generate_timetable_canonical(workspace_id=workspace_id, db=db, current_user=current_user)


def get_timetable_versions(workspace_id: str, db: Session):
    config = db.query(TimetableConfiguration).filter_by(workspace_id=workspace_id).first()
    if not config:
        return []

    versions = db.query(TimetableVersion).join(TimetableRun).filter(
        TimetableRun.configuration_id == config.id
    ).order_by(TimetableVersion.id.desc()).all()

    results = []
    for v in versions:
        run = db.query(TimetableRun).get(v.run_id)
        results.append({
            "id": v.id,
            "status": v.status.name,
            "created_at": v.created_at,
            "run_id": run.id if run else None,
            "solver_status": run.status.name if run else "UNKNOWN",
            "violations": run.hard_violation_count if run else 0
        })
    return results


class TimetablePublicationConflictError(Exception):
    """Raised when publishing a draft timetable conflicts with already published timetables."""
    def __init__(self, message: str, conflicts: Optional[List[str]] = None):
        super().__init__(message)
        self.message = message
        self.conflicts = conflicts or []


def _get_entry_time_intervals(
    entry: TimetableEntry,
    config_id: int,
    periods_by_config: Dict[int, Dict[int, TimetablePeriod]],
    db: Session
) -> List[Tuple[time, time, int]]:
    """
    Returns a list of (start_time, end_time, period_number) for all periods spanned by entry.
    Raises TimetablePublicationConflictError if periods cannot be found or lack valid clock times.
    """
    if config_id not in periods_by_config:
        periods = db.query(TimetablePeriod).filter(
            TimetablePeriod.configuration_id == config_id,
            TimetablePeriod.active == True
        ).all()
        periods_by_config[config_id] = {p.period_number: p for p in periods}

    cfg_periods = periods_by_config[config_id]
    intervals = []
    for p_offset in range(entry.duration_in_periods):
        p_num = entry.start_period + p_offset
        p_obj = cfg_periods.get(p_num)
        if not p_obj or not p_obj.start_time or not p_obj.end_time:
            raise TimetablePublicationConflictError(
                f"Configuration {config_id} is missing valid clock timings for period {p_num}. "
                f"Publication rejected due to indeterminate scheduling boundaries."
            )
        intervals.append((p_obj.start_time, p_obj.end_time, p_num))
    return intervals


def _times_overlap(s1: time, e1: time, s2: time, e2: time) -> bool:
    """True if interval [s1, e1) overlaps with [s2, e2)."""
    return max(s1, s2) < min(e1, e2)


def validate_draft_against_published_entries(version_to_publish: TimetableVersion, db: Session) -> None:
    """
    Final Cross-Workspace Publication Safety Gate.
    Verifies that no entry in the version being published conflicts with any other
    currently PUBLISHED timetable entry in the system.
    Evaluates actual clock-time intervals [start_time, end_time) across configurations and shifts.
    Checks:
    - Same faculty member assigned on the same weekday with overlapping clock times.
    - Same physical room assigned on the same weekday with overlapping clock times.
    """
    candidate_entries = db.query(TimetableEntry).filter(
        TimetableEntry.timetable_version_id == version_to_publish.id
    ).all()

    if not candidate_entries:
        raise TimetablePublicationConflictError("Candidate version has no timetable entries to publish.")

    # Identify candidate's configuration
    candidate_run = db.get(TimetableRun, version_to_publish.run_id) if hasattr(db, "get") else db.query(TimetableRun).get(version_to_publish.run_id)
    if not candidate_run:
        raise TimetablePublicationConflictError(f"Run {version_to_publish.run_id} not found for version {version_to_publish.id}.")

    # Identify existing PUBLISHED entries excluding those belonging to this run's configuration
    # (since older versions under the same configuration will be superseded upon publish)
    published_entries = (
        db.query(TimetableEntry)
        .join(TimetableVersion, TimetableEntry.timetable_version_id == TimetableVersion.id)
        .join(TimetableRun, TimetableVersion.run_id == TimetableRun.id)
        .filter(
            TimetableVersion.status == TimetableVersionStatusEnum.PUBLISHED,
            TimetableRun.configuration_id != candidate_run.configuration_id
        )
        .all()
    )

    conflicts: List[str] = []
    periods_by_config: Dict[int, Dict[int, TimetablePeriod]] = {}
    config_by_version: Dict[int, int] = {version_to_publish.id: candidate_run.configuration_id}

    # Helper to look up configuration_id for an entry's version
    def get_entry_config_id(entry: TimetableEntry) -> int:
        vid = entry.timetable_version_id
        if vid not in config_by_version:
            v_run = (
                db.query(TimetableRun.configuration_id)
                .join(TimetableVersion, TimetableVersion.run_id == TimetableRun.id)
                .filter(TimetableVersion.id == vid)
                .first()
            )
            config_by_version[vid] = v_run[0] if v_run else candidate_run.configuration_id
        return config_by_version[vid]

    # Index published entries with their resolved clock intervals
    # Structure: pe_info = (pe, start_time, end_time, period_num)
    published_fac_map: Dict[Tuple[int, int], List[Tuple[TimetableEntry, time, time, int]]] = {}
    published_room_map: Dict[Tuple[int, int], List[Tuple[TimetableEntry, time, time, int]]] = {}

    for pe in published_entries:
        pe_cfg_id = get_entry_config_id(pe)
        pe_intervals = _get_entry_time_intervals(pe, pe_cfg_id, periods_by_config, db)
        for (st, et, p_num) in pe_intervals:
            fac_key = (pe.faculty_id, pe.day_index)
            if fac_key not in published_fac_map:
                published_fac_map[fac_key] = []
            published_fac_map[fac_key].append((pe, st, et, p_num))

            if pe.room_id:
                room_key = (pe.room_id, pe.day_index)
                if room_key not in published_room_map:
                    published_room_map[room_key] = []
                published_room_map[room_key].append((pe, st, et, p_num))

    DAY_NAMES = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"}

    for ce in candidate_entries:
        ce_intervals = _get_entry_time_intervals(ce, candidate_run.configuration_id, periods_by_config, db)
        day_name = DAY_NAMES.get(ce.day_index, f"Day {ce.day_index}")

        for (c_st, c_et, c_pnum) in ce_intervals:
            # Check faculty collisions
            fac_key = (ce.faculty_id, ce.day_index)
            if fac_key in published_fac_map:
                for (pe, p_st, p_et, p_pnum) in published_fac_map[fac_key]:
                    if _times_overlap(c_st, c_et, p_st, p_et):
                        fac = db.query(FacultyProfile).filter(FacultyProfile.id == ce.faculty_id).first()
                        fac_name = fac.name if fac else f"ID {ce.faculty_id}"
                        conflicts.append(
                            f"Faculty collision: {fac_name} is already scheduled on {day_name} "
                            f"{p_st.strftime('%H:%M')}-{p_et.strftime('%H:%M')} (Period {p_pnum}) "
                            f"in published timetable version #{pe.timetable_version_id}. "
                            f"Overlaps with candidate {c_st.strftime('%H:%M')}-{c_et.strftime('%H:%M')} (Period {c_pnum})."
                        )

            # Check room collisions
            if ce.room_id:
                room_key = (ce.room_id, ce.day_index)
                if room_key in published_room_map:
                    for (pe, p_st, p_et, p_pnum) in published_room_map[room_key]:
                        if _times_overlap(c_st, c_et, p_st, p_et):
                            rm = db.query(TimetableRoom).filter(TimetableRoom.id == ce.room_id).first()
                            rm_name = rm.room_code if rm else f"ID {ce.room_id}"
                            conflicts.append(
                                f"Room double-booking: {rm_name} is already reserved on {day_name} "
                                f"{p_st.strftime('%H:%M')}-{p_et.strftime('%H:%M')} (Period {p_pnum}) "
                                f"in published timetable version #{pe.timetable_version_id}. "
                                f"Overlaps with candidate {c_st.strftime('%H:%M')}-{c_et.strftime('%H:%M')} (Period {c_pnum})."
                            )

    if conflicts:
        raise TimetablePublicationConflictError(
            f"Publication rejected: {len(conflicts)} cross-workspace conflict(s) detected.",
            conflicts=conflicts
        )


def generate_multi_workspace_timetable(
    workspace_ids: List[str],
    db: Session,
    current_user: Optional[User] = None
) -> Dict[str, Any]:
    """
    Coordinated multi-workspace timetable generation.
    Solves all included workspaces simultaneously under unified faculty non-overlap,
    room non-overlap, and combined daily free-period constraints.
    Persists coordinated DRAFT candidate runs/versions for each included workspace atomically.
    """
    if not workspace_ids:
        raise TimetableGenerationError("No workspace IDs provided for multi-workspace generation.", status_code=400)

    # 1. Preflight checks for each workspace
    preflights = {}
    all_rooms_map: Dict[int, TimetableRoom] = {}
    all_periods = None

    for ws_id in workspace_ids:
        pf = run_timetable_preflight_checks(ws_id, db)
        preflights[ws_id] = pf
        if current_user:
            validate_user_workspace_authorization(current_user, pf["workspace"])
        for r in pf["rooms"]:
            all_rooms_map[r.id] = r
        if all_periods is None:
            all_periods = pf["periods"]

    # 2. Synthesize TeachingSessions for each workspace
    builder = TeachingSessionBuilder(db)
    combined_sessions: List[TeachingSession] = []
    sessions_by_ws: Dict[str, List[TeachingSession]] = {}

    for ws_id in workspace_ids:
        try:
            ws_sessions = builder.build_sessions_for_workspace(ws_id)
            sessions_by_ws[ws_id] = ws_sessions
            combined_sessions.extend(ws_sessions)
        except TeachingSessionBuildError as e:
            raise TimetableGenerationError(f"Workspace '{ws_id}' session build failed: {e}", status_code=422)

    # 3. Build Multi-Workspace KAIROS Inputs
    adapter = KairosTimetableAdapter(db)
    try:
        k_sections, k_rooms, k_instructors, k_cfg = adapter.build_multi_workspace_solver_inputs(
            workspace_ids=workspace_ids,
            sessions=combined_sessions,
            rooms=list(all_rooms_map.values()),
            periods=all_periods,
            respect_existing_reservations=True
        )
    except KairosAdapterError as e:
        raise TimetableGenerationError(f"Multi-workspace adapter preparation failed: {e}", status_code=422)

    # 4. Execute Real KAIROS Solver
    start_time = datetime.now(timezone.utc)
    try:
        from vendor.KAIROS.src.timetabling.pipeline import run_pipeline
    except ImportError:
        from src.timetabling.pipeline import run_pipeline

    pipeline_res = run_pipeline(
        "FLABS_SHIFT_1",
        k_sections,
        k_rooms,
        k_instructors,
        k_cfg,
        solver="cpsat"
    )
    end_time = datetime.now(timezone.utc)
    duration_sec = int((end_time - start_time).total_seconds())

    # 5. Check Solver Status
    is_feasible = (len(pipeline_res.violations) == 0) and (len(pipeline_res.assignments) == len(combined_sessions))
    if not is_feasible:
        viol_msgs = [f"{v.kind}: {v.detail}" for v in pipeline_res.violations]
        missing_count = len(combined_sessions) - len(pipeline_res.assignments)
        raise TimetableGenerationError(
            f"KAIROS multi-workspace solver failed: {len(pipeline_res.violations)} violations, "
            f"{missing_count} sessions unplaced.",
            preflight_errors=viol_msgs,
            status_code=422
        )

    # 6. Atomically persist runs, versions, and entries for each workspace
    try:
        soft_cost = int(pipeline_res.stats.get("cost", 0)) if pipeline_res.stats else 0
        assign_by_block = {a.block_id: a for a in pipeline_res.assignments}
        created_versions = {}

        for ws_id in workspace_ids:
            cfg = preflights[ws_id]["configuration"]
            ws_sessions = sessions_by_ws[ws_id]
            ws_assigns = [assign_by_block[str(s.id)] for s in ws_sessions if str(s.id) in assign_by_block]

            run_record = TimetableRun(
                run_id=f"run_multi_{uuid.uuid4().hex[:10]}",
                workspace_id=ws_id,
                configuration_id=cfg.id,
                status=TimetableStatusEnum.COMPLETED,
                solver_name="KAIROS_CPSAT_MULTI",
                solver_version="2.0",
                started_at=start_time,
                completed_at=end_time,
                duration_seconds=duration_sec,
                expected_sessions=len(ws_sessions),
                scheduled_sessions=len(ws_assigns),
                hard_violation_count=0,
                soft_score=soft_cost,
                diagnostics_json={"feasible": True, "scope": workspace_ids}
            )
            db.add(run_record)
            db.flush()

            version_record = TimetableVersion(
                run_id=run_record.id,
                status=TimetableVersionStatusEnum.DRAFT
            )
            db.add(version_record)
            db.flush()

            entries = adapter.map_assignments_to_entries(
                assignments=ws_assigns,
                sessions=ws_sessions,
                timetable_version_id=version_record.id
            )
            db.add_all(entries)
            created_versions[ws_id] = version_record.id

        db.commit()

        return {
            "status": "COMPLETED",
            "version_status": "DRAFT",
            "workspaces": workspace_ids,
            "created_versions": created_versions,
            "total_scheduled_sessions": len(combined_sessions),
            "duration_seconds": duration_sec,
            "violations": 0
        }

    except Exception as e:
        db.rollback()
        raise TimetableGenerationError(f"Atomic persistence of multi-workspace timetable failed: {e}", status_code=500)


TIMETABLE_PUBLICATION_ADVISORY_LOCK_ID = 88421001  # Unique 64-bit integer lock ID for cross-workspace publication coordination


def _acquire_publication_lock(db: Session) -> None:
    """
    Acquires an exclusive transaction-level advisory lock when running on PostgreSQL.
    This guarantees that concurrent publication requests across different candidate versions
    or workspaces are serialized at the database engine level before reading published entries.
    The lock is automatically released when the transaction ends (commit or rollback).
    On SQLite or other dialects, this is a no-op as the dialect handles serialization.
    """
    bind = db.get_bind()
    if bind and bind.dialect.name == "postgresql":
        from sqlalchemy import text
        db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_id)"),
            {"lock_id": TIMETABLE_PUBLICATION_ADVISORY_LOCK_ID}
        )


def publish_timetable_version(version_id: int, db: Session):
    """
    Publishes a draft timetable version after strict cross-workspace conflict validation.
    Guarantees:
    - PostgreSQL transaction-level advisory lock (pg_advisory_xact_lock) acquired BEFORE reading published entries.
    - Independent cross-workspace faculty and room clock-time conflict check while lock is held.
    - Atomic status transition: older versions SUPERSEDED, target version PUBLISHED.
    - Transaction rollback if conflict is detected or database write fails.
    """
    try:
        # 1. Acquire transaction-scoped advisory lock if running on PostgreSQL
        _acquire_publication_lock(db)

        # 2. Acquire row lock on the version being published if backend supports SELECT FOR UPDATE
        try:
            locked_version = db.query(TimetableVersion).filter(
                TimetableVersion.id == version_id
            ).with_for_update().first()
        except Exception:
            locked_version = db.get(TimetableVersion, version_id) if hasattr(db, "get") else db.query(TimetableVersion).get(version_id)

        if not locked_version:
            raise Exception("Version not found")

        if locked_version.status == TimetableVersionStatusEnum.PUBLISHED:
            return {"status": "success", "published_version_id": version_id, "message": "Version is already published."}

        # 3. Cross-Workspace Final Conflict Gate (evaluated inside the advisory & row locked transaction)
        validate_draft_against_published_entries(locked_version, db)

        run = db.get(TimetableRun, locked_version.run_id) if hasattr(db, "get") else db.query(TimetableRun).get(locked_version.run_id)

        # 4. Lock and supersede older published versions for the same configuration
        try:
            older_versions = db.query(TimetableVersion).join(TimetableRun).filter(
                TimetableRun.configuration_id == run.configuration_id,
                TimetableVersion.status == TimetableVersionStatusEnum.PUBLISHED
            ).with_for_update().all()
        except Exception:
            older_versions = db.query(TimetableVersion).join(TimetableRun).filter(
                TimetableRun.configuration_id == run.configuration_id,
                TimetableVersion.status == TimetableVersionStatusEnum.PUBLISHED
            ).all()

        for v in older_versions:
            v.status = TimetableVersionStatusEnum.SUPERSEDED

        locked_version.status = TimetableVersionStatusEnum.PUBLISHED
        db.commit()
        return {"status": "success", "published_version_id": version_id}
    except Exception as e:
        db.rollback()
        raise e


def get_timetable_entries_for_workspace(workspace_id: str, db: Session, version_id: int = None):
    config = db.query(TimetableConfiguration).filter_by(workspace_id=workspace_id).first()
    if not config:
        return []

    if version_id:
        version = db.query(TimetableVersion).get(version_id)
    else:
        version = db.query(TimetableVersion).join(TimetableRun).filter(
            TimetableRun.configuration_id == config.id,
            TimetableVersion.status == TimetableVersionStatusEnum.PUBLISHED
        ).order_by(TimetableVersion.id.desc()).first()

    if not version:
        return []

    entries = db.query(TimetableEntry).filter_by(timetable_version_id=version.id).all()

    results = []
    for e in entries:
        ts = db.query(TeachingSession).get(e.teaching_session_id)
        room = db.query(TimetableRoom).get(e.room_id) if e.room_id else None
        fac = db.query(FacultyProfile).filter_by(id=ts.faculty_id).first() if ts else None

        section_names = []
        if ts and ts.synchronization_group_id:
            sgms = db.query(SynchronizedGroupMember).filter_by(teaching_session_id=ts.id).all()
            for sgm in sgms:
                sec = db.query(Section).get(sgm.section_id)
                if sec and sec.name not in section_names:
                    section_names.append(sec.name)

        if not section_names and ts and ts.section_id:
            sec = db.query(Section).get(ts.section_id)
            if sec:
                section_names.append(sec.name)

        alloc = db.query(SubjectAllocation).get(ts.allocation_id) if ts else None
        subject = db.query(Subject).get(alloc.subject_id) if alloc else None

        results.append({
            "id": e.id,
            "day_index": e.day_index,
            "period_number": e.start_period,
            "duration": ts.duration_in_periods if ts else e.duration_in_periods,
            "teaching_type": ts.teaching_type if ts else e.session_type,
            "room": room.room_code if room else "TBA",
            "faculty": fac.name if fac else "Unknown",
            "faculty_id": fac.id if fac else None,
            "user_id": fac.user_id if fac else None,
            "subject": subject.course_name if subject else "Unknown",
            "subject_code": subject.course_code if subject else "Unknown",
            "sections": section_names
        })

    return {
        "version_id": version.id,
        "status": version.status.name,
        "created_at": version.created_at,
        "entries": results
    }


def get_faculty_timetable_entries(user_id: int, db: Session, semester_type: Optional[str] = None):
    """
    Retrieves all timetable entries for a specific faculty user strictly from
    PUBLISHED timetable versions across all institutional workspaces.
    Draft, provisional, and mock fixtures are never returned.
    """
    fac = db.query(FacultyProfile).filter(FacultyProfile.user_id == user_id).first()
    faculty_id = fac.id if fac else user_id

    # Filter published entries
    query = (
        db.query(TimetableEntry)
        .join(TimetableVersion, TimetableEntry.timetable_version_id == TimetableVersion.id)
        .join(TimetableRun, TimetableVersion.run_id == TimetableRun.id)
        .filter(
            TimetableEntry.faculty_id == faculty_id,
            TimetableVersion.status == TimetableVersionStatusEnum.PUBLISHED
        )
    )

    if semester_type:
        query = query.join(
            AcademicWorkspace,
            TimetableRun.workspace_id == AcademicWorkspace.id
        )
        if semester_type == "ODD":
            query = query.filter(AcademicWorkspace.semester_id.in_([1, 3, 5]))
        elif semester_type == "EVEN":
            query = query.filter(AcademicWorkspace.semester_id.in_([2, 4, 6]))

    entries = query.order_by(TimetableEntry.day_index.asc(), TimetableEntry.start_period.asc()).all()

    results = []
    for e in entries:
        ts = db.query(TeachingSession).get(e.teaching_session_id)
        room = db.query(TimetableRoom).get(e.room_id) if e.room_id else None
        alloc = db.query(SubjectAllocation).get(ts.allocation_id) if ts else None
        subject = db.query(Subject).get(alloc.subject_id) if alloc else None

        section_names = []
        if ts and ts.synchronization_group_id:
            sgms = db.query(SynchronizedGroupMember).filter_by(teaching_session_id=ts.id).all()
            for sgm in sgms:
                sec = db.query(Section).get(sgm.section_id)
                if sec and sec.name not in section_names:
                    section_names.append(sec.name)

        if not section_names and ts and ts.section_id:
            sec = db.query(Section).get(ts.section_id)
            if sec:
                section_names.append(sec.name)

        results.append({
            "id": e.id,
            "day_index": e.day_index,
            "period_number": e.start_period,
            "duration": ts.duration_in_periods if ts else e.duration_in_periods,
            "teaching_type": ts.teaching_type if ts else e.session_type,
            "room": room.room_code if room else "TBA",
            "faculty": fac.name if fac else "Faculty",
            "faculty_id": faculty_id,
            "user_id": user_id,
            "subject": subject.course_name if subject else "Unknown",
            "subject_code": subject.course_code if subject else "Unknown",
            "sections": section_names,
            "timetable_version_id": e.timetable_version_id
        })

    return {
        "user_id": user_id,
        "faculty_name": fac.name if fac else "Faculty",
        "entries": results
    }

