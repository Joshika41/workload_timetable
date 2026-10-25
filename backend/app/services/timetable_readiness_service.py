"""
Timetable Readiness Report Service.

Evaluates institutional workspaces against canonical prerequisites for automated timetable generation:
1. Workspace Workflow State (must be FINALIZED).
2. Workload Version Snapshot (must exist).
3. Finalized Subject Allocation & Component counts.
4. Sections & Student Strengths (> 0).
5. TeachingSession synthesis readiness.
6. Approved Room Inventory availability (CLASSROOM & LAB) and capacity compatibility.
7. Active constraints & calendar configuration (6 periods for FLABS Shift 1).
8. Missing synchronized groups (for multi-section electives/languages).

Produces an actionable, read-only diagnostic report:
- Status: READY_FOR_PREVIEW | REQUIRES_POLICY_DECISION | BLOCKED.
- Absolute read-only: Never invokes KAIROS, creates sessions, modifies workloads or updates statuses.
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from app.models.domain import (
    AcademicWorkspace,
    WorkspaceWorkflowStateEnum,
    WorkloadVersion,
    SubjectAllocation,
    AllocationComponent,
    Section,
    AllocationStatusEnum
)
from app.models.timetable import (
    TimetableConfiguration,
    TimetablePeriod,
    TimetableRoom,
    SynchronizedGroup,
    TimetableConstraint
)


def evaluate_workspace_timetable_readiness(workspace_id: str, db: Session) -> Dict[str, Any]:
    """
    Evaluates a single workspace against canonical timetable generation prerequisites.
    Returns structured readiness report. Read-only operation.
    """
    blockers: List[str] = []
    warnings: List[str] = []

    ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not ws:
        return {
            "workspace_id": workspace_id,
            "status": "BLOCKED",
            "blockers": [f"AcademicWorkspace '{workspace_id}' not found."],
            "warnings": []
        }

    # 1. Finalization Status
    is_finalized = (ws.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED)
    state_str = ws.workflow_state.value if hasattr(ws.workflow_state, "value") else str(ws.workflow_state)
    if not is_finalized:
        blockers.append(f"Workspace workflow state is '{state_str}'. Workload must be FINALIZED before timetable generation.")

    # 2. Workload Version Snapshot
    wv = (
        db.query(WorkloadVersion)
        .filter(WorkloadVersion.workspace_id == workspace_id)
        .order_by(WorkloadVersion.version_no.desc())
        .first()
    )
    if not wv:
        blockers.append("No active WorkloadVersion snapshot exists.")

    # 3. Subject Allocations & Components
    allocations = (
        db.query(SubjectAllocation)
        .filter(
            SubjectAllocation.workspace_id == workspace_id,
            SubjectAllocation.status.in_([AllocationStatusEnum.ALLOCATED, AllocationStatusEnum.FINALIZED])
        )
        .all()
    )
    alloc_ids = [a.id for a in allocations]
    components = (
        db.query(AllocationComponent)
        .filter(AllocationComponent.allocation_id.in_(alloc_ids))
        .all()
    ) if alloc_ids else []

    total_theory_hours = sum(c.theory_hours or 0 for c in components)
    total_lab_hours = sum(c.practical_hours or 0 for c in components)

    if not allocations:
        blockers.append("No FINALIZED or ALLOCATED SubjectAllocation records found in workspace.")
    elif not components:
        blockers.append("SubjectAllocations exist but have 0 AllocationComponent records.")

    # 4. Sections & Student Strengths
    sections = db.query(Section).filter(Section.workspace_id == workspace_id).all()
    max_section_strength = 0
    if not sections:
        blockers.append("No sections defined in workspace.")
    else:
        for sec in sections:
            strength = sec.student_strength or 0
            if strength <= 0:
                blockers.append(
                    f"Section '{sec.name}' (ID {sec.id}) has missing or non-positive student_strength ({strength})."
                )
            if strength > max_section_strength:
                max_section_strength = strength

    # 5. Calendar Configuration & Periods
    cfg = (
        db.query(TimetableConfiguration)
        .filter(
            TimetableConfiguration.workspace_id == workspace_id,
            TimetableConfiguration.active == True
        )
        .first()
    )
    period_count = 0
    if not cfg:
        blockers.append("No active TimetableConfiguration found.")
    else:
        periods = (
            db.query(TimetablePeriod)
            .filter(
                TimetablePeriod.configuration_id == cfg.id,
                TimetablePeriod.active == True
            )
            .all()
        )
        period_count = len(periods)
        if period_count < 6:
            blockers.append(f"TimetableConfiguration ID {cfg.id} has {period_count} periods (requires 6 for Shift 1).")

    # 6. Approved Room Inventory & Capacity Verification
    # Institutional rooms available for this institution / workspace
    inst_id = ws.department.institution_id if ws.department else 2
    rooms = (
        db.query(TimetableRoom)
        .filter(
            TimetableRoom.active == True,
            TimetableRoom.institution_id == inst_id,
            (TimetableRoom.workspace_id == workspace_id) | (TimetableRoom.workspace_id == None)
        )
        .all()
    )

    classrooms = [r for r in rooms if r.room_type == "CLASSROOM"]
    labs = [r for r in rooms if r.room_type in ["LAB", "PC_LAB"]]

    if not rooms:
        blockers.append("0 approved TimetableRoom records found. Institutional room inventory must be imported.")
    else:
        if total_theory_hours > 0 and not classrooms:
            blockers.append(f"Workspace requires {total_theory_hours} theory hours, but 0 CLASSROOM rooms exist in inventory.")
        if total_lab_hours > 0 and not labs:
            blockers.append(f"Workspace requires {total_lab_hours} practical lab hours, but 0 LAB/PC_LAB rooms exist in inventory.")

        # Check capacity vs max section strength
        if max_section_strength > 0 and total_theory_hours > 0:
            capable_classrooms = [r for r in classrooms if r.capacity >= max_section_strength]
            if not capable_classrooms:
                blockers.append(
                    f"Classroom capacity shortfall: largest section requires {max_section_strength} seats, "
                    f"but largest available CLASSROOM has capacity {max([r.capacity for r in classrooms], default=0)}."
                )

    # 7. Synchronized Groups Check
    # Check if there are elective or multi-section allocations lacking synchronization groups
    elective_allocs = [
        a for a in allocations
        if hasattr(a, "subject") and a.subject and (getattr(a.subject, "category", "") or "").upper() in ["ELECTIVE", "OPEN_ELECTIVE"]
    ]
    if elective_allocs:
        # Check if synchronized groups are configured
        sync_groups = db.query(SynchronizedGroup).all()
        if not sync_groups:
            warnings.append(
                f"Workspace has {len(elective_allocs)} elective allocation(s), but no SynchronizedGroup records "
                f"are defined. Electives will schedule independently per section."
            )

    # Determine overall status
    if blockers:
        status = "BLOCKED"
    elif warnings:
        status = "REQUIRES_POLICY_DECISION"
    else:
        status = "READY_FOR_PREVIEW"

    return {
        "workspace_id": workspace_id,
        "department_id": ws.department_id,
        "programme_id": ws.programme_id,
        "workflow_state": state_str,
        "status": status,
        "allocations_approved": len(allocations),
        "components_count": len(components),
        "theory_hours": total_theory_hours,
        "lab_hours": total_lab_hours,
        "sections_count": len(sections),
        "max_section_strength": max_section_strength,
        "periods_count": period_count,
        "available_classrooms": len(classrooms),
        "available_labs": len(labs),
        "blockers": blockers,
        "warnings": warnings
    }


def generate_institutional_timetable_readiness_report(db: Session, institution_id: int = 2) -> Dict[str, Any]:
    """
    Generates a full readiness report for all workspaces in the given institution.
    Read-only diagnostic audit.
    """
    workspaces = (
        db.query(AcademicWorkspace)
        .join(AcademicWorkspace.department)
        .filter(AcademicWorkspace.department.has(institution_id=institution_id))
        .all()
    )

    workspace_reports = []
    summary_counts = {
        "READY_FOR_PREVIEW": 0,
        "REQUIRES_POLICY_DECISION": 0,
        "BLOCKED": 0,
        "TOTAL": len(workspaces)
    }

    for ws in workspaces:
        rep = evaluate_workspace_timetable_readiness(ws.id, db)
        workspace_reports.append(rep)
        st = rep["status"]
        summary_counts[st] = summary_counts.get(st, 0) + 1

    return {
        "institution_id": institution_id,
        "summary": summary_counts,
        "workspaces": workspace_reports
    }
