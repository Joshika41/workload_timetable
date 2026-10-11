from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.connection import get_db
from app.models.domain import (
    User, RoleEnum, AcademicWorkspace, WorkspaceWorkflowStateEnum,
    SubjectAllocation, AllocationComponent, AllocationStatusEnum, AllocationRoleEnum,
    Section, Subject
)
from app.auth.dependencies import require_role, get_current_user
from app.auth.workspace_auth import verify_workspace_access
from app.core.workspace import WorkspaceContext, decode_workspace_id
from app.schemas.allocation import SubjectAllocationRequest

router = APIRouter()

def _serialize_allocation(a: SubjectAllocation) -> dict:
    comps = [
        {
            "id": c.id,
            "faculty_id": c.faculty_id,
            "faculty_name": c.faculty.name,
            "role": c.role.value,
            "theory_hours": c.theory_hours,
            "practical_hours": c.practical_hours,
        }
        for c in a.components
    ]
    return {
        "id": a.id,
        "workspace_id": a.workspace_id,
        "section_id": a.section_id,
        "section_name": a.section.name,
        "subject_id": a.subject_id,
        "subject_code": a.subject.course_code,
        "subject_name": a.subject.course_name,
        "subject_category": a.subject.category,
        "theory_hours": a.subject.theory_hours,
        "practical_hours": a.subject.practical_hours,
        "status": a.status.value,
        "components": comps,
    }

@router.get("")
def get_allocations(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    workspace: WorkspaceContext = Depends(verify_workspace_access)
):
    allocations = db.query(SubjectAllocation).filter(
        SubjectAllocation.workspace_id == workspace_id
    ).all()
    return [_serialize_allocation(a) for a in allocations]

@router.post("")
def create_or_update_allocation(
    workspace_id: str,
    req: SubjectAllocationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Create or update a subject-section allocation."""
    try:
        context = decode_workspace_id(workspace_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace ID")

    if current_user.department_id != context.department_id:
        raise HTTPException(status_code=403, detail="Not authorized for this workspace")

    # Finalization lock
    workspace = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if workspace and workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
        raise HTTPException(status_code=http_status.HTTP_423_LOCKED, detail="Workspace is finalized")

    from app.services.allocation_service import AllocationService
    alloc_service = AllocationService()
    
    allocation = alloc_service.create_or_update_allocation(db, req, current_user, workspace_id)
    return _serialize_allocation(allocation)

@router.patch("/{allocation_id}")
def update_allocation(
    allocation_id: int,
    section_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    components: Optional[List[dict]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Edit an existing allocation."""
    allocation = db.query(SubjectAllocation).filter(SubjectAllocation.id == allocation_id).first()
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    # Finalization lock
    workspace = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == allocation.workspace_id).first()
    if workspace and workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
        raise HTTPException(status_code=http_status.HTTP_423_LOCKED, detail="Workspace is finalized")

    if section_id:
        allocation.section_id = section_id
    if subject_id:
        allocation.subject_id = subject_id

    if components is not None:
        db.query(AllocationComponent).filter(AllocationComponent.allocation_id == allocation_id).delete()
        db.flush()
        for c in components:
            role_enum = AllocationRoleEnum(c["role"])
            comp = AllocationComponent(
                allocation_id=allocation.id,
                faculty_id=c["faculty_id"],
                role=role_enum,
                theory_hours=c.get("theory_hours", 0),
                practical_hours=c.get("practical_hours", 0),
            )
            db.add(comp)

    db.commit()
    db.refresh(allocation)
    return _serialize_allocation(allocation)

@router.post("/finalize")
def finalize_allocations(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    try:
        context = decode_workspace_id(workspace_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace ID")

    if current_user.department_id != context.department_id:
        raise HTTPException(status_code=403, detail="Not authorized for this workspace")

    workspace = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
        raise HTTPException(status_code=400, detail="Workspace is already finalized")

    # Mark all allocations as FINALIZED
    allocations = db.query(SubjectAllocation).filter(
        SubjectAllocation.workspace_id == workspace_id
    ).all()

    for a in allocations:
        a.status = AllocationStatusEnum.FINALIZED

    # Update workspace workflow state
    workspace.workflow_state = WorkspaceWorkflowStateEnum.FINALIZED
    db.commit()

    return {"success": True, "message": "Allocations finalized. Workspace locked.", "finalized_count": len(allocations)}
