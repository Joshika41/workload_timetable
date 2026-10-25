"""
Provisional Timetable Preview Service.

Provides a restricted, preview-only generation workflow using the actual KAIROS
pipeline and canonical workload data for B.Sc. CS and MCA (excluding MCA Gen AI).

Guarantees:
- Enforces genuine section-to-room preferences derived from the B.Sc. CS workbook (Block 5)
  and user-provided MCA PG Block room list.
- Treats room preferences as soft solver preferences (objective weight), NOT rigid historical slots.
- Enforces all existing hard constraints (faculty clashes, section clashes, room double-booking,
  lab suitability, faculty daily teaching limits <= 5, theory repetition <= 2).
- Does NOT replace unverified capacities with synthetic values; skips only capacity comparison
  during preview.
- Emits results labeled "PROVISIONAL — CAPACITY NOT VERIFIED".
- STRICT SAFEGUARD: Never creates official TimetableVersion or TimetableEntry records in the database,
  and results can NEVER be published.
"""

import sys
import os
import time as time_lib
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict
from sqlalchemy.orm import Session

# Add vendor/KAIROS to sys.path safely if not present
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
kairos_dir = os.path.join(backend_dir, "vendor", "KAIROS")
if kairos_dir not in sys.path:
    sys.path.append(kairos_dir)

from src.timetabling.pipeline import run_pipeline
from src.timetabling.model import Block

from app.models.domain import (
    AcademicWorkspace,
    WorkspaceWorkflowStateEnum,
    WorkloadVersion,
    SubjectAllocation,
    AllocationComponent,
    Section,
    FacultyProfile,
    Subject
)
from app.models.timetable import (
    TimetableConfiguration,
    TimetablePeriod,
    TimetableRoom,
    TeachingSession
)
from app.services.teaching_session_builder import TeachingSessionBuilder, TeachingSessionBuildError
from app.services.kairos_adapter import KairosTimetableAdapter, KairosAdapterError


# Grounded Section-to-Room Preferences
# Derived from B.Sc. CS historical workbook (Block 5) & MCA PG Block user list
BSC_CS_ROOM_PREFERENCES: Dict[str, Dict[str, str]] = {
    "I A": {"theory": "CR-204", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "I B": {"theory": "CR-200", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "I C": {"theory": "CR-200", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook (Shift 2)"},
    "II A": {"theory": "CR-304", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "II B": {"theory": "CR-205", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "II C": {"theory": "CR-305", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "II D": {"theory": "CR-304", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "II E": {"theory": "CR-205", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook (Shift 2)"},
    "III A": {"theory": "CR-205", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "III B": {"theory": "CR-204", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "III C": {"theory": "CR-304", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "III D": {"theory": "CR-305", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook"},
    "III E": {"theory": "CR-204", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook (Shift 2)"},
    "III F": {"theory": "CR-305", "lab": "LAB-4FL", "block": "Block 5", "source": "B.Sc CS Historical Workbook (Shift 2)"},
}

MCA_PG_ROOM_PREFERENCES: Dict[str, Dict[str, str]] = {
    "MCA I A": {"theory": "PG-103", "lab": "PG-LAB-1", "block": "PG Block", "source": "User PG Block Room List"},
    "MCA I B": {"theory": "PG-104", "lab": "PG-LAB-1", "block": "PG Block", "source": "User PG Block Room List"},
    "MCA II A": {"theory": "PG-301", "lab": "PG-LAB-2", "block": "PG Block", "source": "User PG Block Room List"},
    "MCA II B": {"theory": "PG-103", "lab": "PG-LAB-2", "block": "PG Block", "source": "User PG Block Room List"},
}

PROVISIONAL_ROOM_DEFINITIONS = [
    # B.Sc CS (Block 5)
    {"id": 8001, "room_code": "CR-200", "room_name": "Classroom 200", "room_type": "CLASSROOM", "capacity": 0, "building": "Block 5"},
    {"id": 8002, "room_code": "CR-204", "room_name": "Classroom 204", "room_type": "CLASSROOM", "capacity": 0, "building": "Block 5"},
    {"id": 8003, "room_code": "CR-205", "room_name": "Classroom 205", "room_type": "CLASSROOM", "capacity": 0, "building": "Block 5"},
    {"id": 8004, "room_code": "CR-304", "room_name": "Classroom 304", "room_type": "CLASSROOM", "capacity": 0, "building": "Block 5"},
    {"id": 8005, "room_code": "CR-305", "room_name": "Classroom 305", "room_type": "CLASSROOM", "capacity": 0, "building": "Block 5"},
    {"id": 8006, "room_code": "LAB-4FL", "room_name": "4th Floor Lab", "room_type": "PC_LAB", "capacity": 0, "building": "Block 5"},
    # MCA (PG Block)
    {"id": 9001, "room_code": "PG-103", "room_name": "PG Classroom 103", "room_type": "CLASSROOM", "capacity": 0, "building": "PG Block"},
    {"id": 9002, "room_code": "PG-104", "room_name": "PG Classroom 104", "room_type": "CLASSROOM", "capacity": 0, "building": "PG Block"},
    {"id": 9003, "room_code": "PG-301", "room_name": "PG Classroom 301", "room_type": "CLASSROOM", "capacity": 0, "building": "PG Block"},
    {"id": 9004, "room_code": "PG-LAB-1", "room_name": "PG Lab 1", "room_type": "PC_LAB", "capacity": 0, "building": "PG Block"},
    {"id": 9005, "room_code": "PG-LAB-2", "room_name": "PG Lab 2", "room_type": "PC_LAB", "capacity": 0, "building": "PG Block"},
]


class ProvisionalPreviewError(Exception):
    def __init__(self, message: str, blockers: Optional[List[str]] = None):
        super().__init__(message)
        self.message = message
        self.blockers = blockers or []


def generate_provisional_timetable_preview(
    workspace_id: str,
    db: Session,
    scope_type: str = "AUTO"  # "BSC_CS" or "MCA" or "AUTO"
) -> Dict[str, Any]:
    """
    Executes a restricted provisional preview solve for a workspace using canonical data
    and provisional room preferences.
    Never persists official versions or entries.
    """
    # 1. Workspace validation
    ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not ws:
        raise ProvisionalPreviewError(f"AcademicWorkspace '{workspace_id}' not found.")

    blockers = []
    if ws.workflow_state != WorkspaceWorkflowStateEnum.FINALIZED:
        blockers.append(
            f"Workspace '{workspace_id}' is in '{ws.workflow_state.value if hasattr(ws.workflow_state, 'value') else ws.workflow_state}' state. "
            f"Workload must be FINALIZED before provisional preview."
        )

    # Active WorkloadVersion
    wv = (
        db.query(WorkloadVersion)
        .filter(WorkloadVersion.workspace_id == workspace_id)
        .order_by(WorkloadVersion.version_no.desc())
        .first()
    )
    if not wv:
        blockers.append(f"Workspace '{workspace_id}' has no active WorkloadVersion snapshot.")

    # Exclude MCA Gen AI
    if ws.programme and "GEN AI" in (ws.programme.name or "").upper():
        blockers.append("MCA Gen AI is explicitly excluded from this preview scope.")

    if blockers:
        raise ProvisionalPreviewError(
            f"Provisional preview blocked for workspace '{workspace_id}'.",
            blockers=blockers
        )

    # 2. Synthesize TeachingSessions
    builder = TeachingSessionBuilder(db)
    try:
        sessions = builder.build_sessions_for_workspace(workspace_id)
    except TeachingSessionBuildError as e:
        raise ProvisionalPreviewError(f"Teaching session generation failed: {e}", blockers=[str(e)])

    if not sessions:
        raise ProvisionalPreviewError("No teaching sessions generated for workspace.", blockers=["Zero teaching sessions."])

    # 3. Calendar Configuration & Periods
    cfg = db.query(TimetableConfiguration).filter(
        TimetableConfiguration.workspace_id == workspace_id,
        TimetableConfiguration.active == True
    ).first()
    if not cfg:
        raise ProvisionalPreviewError(f"No active TimetableConfiguration found for workspace '{workspace_id}'.")

    periods = (
        db.query(TimetablePeriod)
        .filter(TimetablePeriod.configuration_id == cfg.id, TimetablePeriod.active == True)
        .order_by(TimetablePeriod.period_number.asc())
        .all()
    )
    if len(periods) < 6:
        raise ProvisionalPreviewError(f"Configuration ID {cfg.id} has {len(periods)} periods; requires 6.")

    # 4. Determine scope and room preferences
    is_mca = ws.programme and "MCA" in (ws.programme.name or "").upper()
    is_bsc = ws.programme and ("BSC" in (ws.programme.name or "").upper() or "COMPUTER SCIENCE" in (ws.programme.name or "").upper())

    if is_mca:
        target_rooms = [r for r in PROVISIONAL_ROOM_DEFINITIONS if r["building"] == "PG Block"]
        room_prefs = MCA_PG_ROOM_PREFERENCES
        scope_name = "MCA (Regular) PG Block Scope"
    else:
        target_rooms = [r for r in PROVISIONAL_ROOM_DEFINITIONS if r["building"] == "Block 5"]
        room_prefs = BSC_CS_ROOM_PREFERENCES
        scope_name = "B.Sc. Computer Science Block 5 Scope"

    provisional_rooms = [
        TimetableRoom(
            id=r["id"],
            institution_id=ws.department.institution_id if ws.department else 2,
            room_code=r["room_code"],
            room_name=r["room_name"],
            room_type=r["room_type"],
            capacity=r["capacity"],
            building=r["building"],
            active=True
        )
        for r in target_rooms
    ]

    # 5. Build KAIROS inputs with skip_capacity_verification=True
    adapter = KairosTimetableAdapter(db)
    k_sections, k_rooms, k_instructors, k_config = adapter.build_multi_workspace_solver_inputs(
        workspace_ids=[workspace_id],
        sessions=sessions,
        rooms=provisional_rooms,
        periods=periods,
        respect_existing_reservations=True,
        skip_capacity_verification=True
    )

    # 6. Apply soft room preferences where section name matches
    sec_id_to_section = {sec.id: sec for sec in db.query(Section).filter(Section.workspace_id == workspace_id).all()}
    room_code_to_id = {r.room_code: str(r.id) for r in provisional_rooms}

    for ksec in k_sections:
        # Extract underlying Section
        try:
            raw_sec_id = int(ksec.section_id.split("_")[0])
            sec_obj = sec_id_to_section.get(raw_sec_id)
            sec_name = sec_obj.name.strip() if sec_obj else ""
        except Exception:
            sec_name = ""

        pref = room_prefs.get(sec_name)
        if not pref and sec_obj and ws.programme_year:
            # Try matching with roman numeral year prefix (e.g. 'I A', 'II B') or 'MCA I A'
            roman_years = {1: "I", 2: "II", 3: "III"}
            yr_roman = roman_years.get(ws.programme_year, "I")
            candidate_keys = [
                f"{yr_roman} {sec_name}",
                f"MCA {yr_roman} {sec_name}"
            ]
            for ck in candidate_keys:
                if ck in room_prefs:
                    pref = room_prefs[ck]
                    break

        # Fallback to first available classroom and lab if no preference matched
        if pref:
            pref_theory_code = pref.get("theory")
            pref_lab_code = pref.get("lab")
            theory_r_id = room_code_to_id.get(pref_theory_code)
            lab_r_id = room_code_to_id.get(pref_lab_code)

            if theory_r_id:
                ksec.plan_room = str(theory_r_id)
            if lab_r_id:
                ksec.lab_room = str(lab_r_id)
        else:
            # Default fallback to first suitable room
            cr_room = next((r for r in provisional_rooms if r.room_type == "CLASSROOM"), None)
            lab_room = next((r for r in provisional_rooms if r.room_type in ["PC_LAB", "LAB"]), None)
            if cr_room:
                ksec.plan_room = str(cr_room.id)
            if lab_room:
                ksec.lab_room = str(lab_room.id)

    # 7. Execute KAIROS solve via pipeline
    t_start = time_lib.time()
    pipeline_res = run_pipeline(
        "FLABS_SHIFT_1",
        k_sections,
        k_rooms,
        k_instructors,
        k_config,
        solver="cpsat"
    )
    t_end = time_lib.time()

    # 8. Check solver feasibility
    is_feasible = (len(pipeline_res.violations) == 0) and (len(pipeline_res.assignments) == len(sessions))
    if not is_feasible:
        return {
            "status": "INFEASIBLE",
            "workspace_id": workspace_id,
            "scope": scope_name,
            "disclaimer": "PROVISIONAL — CAPACITY NOT VERIFIED",
            "is_publishable": False,
            "violations": [f"{v.kind}: {v.detail}" for v in pipeline_res.violations]
        }

    # Format preview entries (in-memory only)
    day_indices = {"Mo": 0, "Tu": 1, "We": 2, "Th": 3, "Fr": 4, "Sa": 5}
    id_to_room_obj = {str(r.id): r for r in provisional_rooms}
    id_to_session_obj = {str(s.id): s for s in sessions}

    preview_schedule = []
    for asgn in pipeline_res.assignments:
        sess = id_to_session_obj.get(asgn.block_id)
        rm = id_to_room_obj.get(asgn.room)
        fac = db.query(FacultyProfile).filter(FacultyProfile.id == sess.faculty_id).first() if sess else None
        subj = db.query(Subject).filter(Subject.id == sess.subject_id).first() if sess else None
        sec = sec_id_to_section.get(sess.section_id) if sess else None

        day_idx = day_indices.get(asgn.day, 0)
        start_p = asgn.start + 1  # 1-indexed
        end_p = asgn.end  # end is already exclusive in KAIROS Assignment

        preview_schedule.append({
            "session_id": int(asgn.block_id),
            "section": sec.name if sec else "Unknown",
            "subject_code": subj.course_code if subj else "Unknown",
            "subject_name": subj.course_name if subj else "Unknown",
            "faculty_name": fac.name if fac else "Unknown",
            "room_code": rm.room_code if rm else asgn.room,
            "room_building": rm.building if rm else "Unknown",
            "day_index": day_idx,
            "day_name": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day_idx],
            "start_period": start_p,
            "end_period": end_p,
            "duration": asgn.end - asgn.start,
            "teaching_type": sess.teaching_type if sess else "THEORY"
        })

    # Sort schedule by day and period
    preview_schedule.sort(key=lambda x: (x["day_index"], x["start_period"]))

    return {
        "status": "COMPLETED",
        "workspace_id": workspace_id,
        "scope": scope_name,
        "disclaimer": "PROVISIONAL — CAPACITY NOT VERIFIED",
        "is_publishable": False,
        "duration_seconds": round(t_end - t_start, 2),
        "scheduled_sessions": len(preview_schedule),
        "total_sessions": len(sessions),
        "violations_count": len(pipeline_res.violations),
        "preview_entries": preview_schedule
    }
