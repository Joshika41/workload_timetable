from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database.connection import get_db
from app.models.domain import User, RoleEnum, FacultyProfile, PolicyConfig
from app.auth.dependencies import require_role, get_current_user
from app.services.workload_service import WorkloadService
from app.services.pdf_service import PDFService
from app.auth.workspace_auth import verify_workspace_access
from app.core.workspace import WorkspaceContext
import json

router = APIRouter()
workload_service = WorkloadService()
pdf_service = PDFService()

@router.get("/faculty")
def get_faculty_workload(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value])),
    workspace: WorkspaceContext = Depends(verify_workspace_access)
):
    """Faculty-centric workload from FINALIZED allocations."""
    return workload_service.get_faculty_workload(db, current_user.department_id, workspace_id)

@router.get("/class-matrix")
def get_class_matrix(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value])),
    workspace: WorkspaceContext = Depends(verify_workspace_access)
):
    """Section-centric class matrix from FINALIZED allocations."""
    return workload_service.get_class_matrix(db, workspace_id)

@router.get("/my-subjects")
def get_my_subjects(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value])),
    workspace: WorkspaceContext = Depends(verify_workspace_access)
):
    """Faculty member's finalized subject assignments."""
    if not current_user.faculty_profile:
        return []
    return workload_service.get_faculty_subjects(db, current_user.faculty_profile.id, workspace_id)

@router.get("/export.pdf")
def export_workload_pdf(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Export finalized workload to PDF."""
    pdf_bytes = pdf_service.generate_workload_pdf(db, current_user.department_id)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=workload_dept_{current_user.department_id}.pdf"})

@router.get("/settings/caps")
def get_workload_caps(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Get hour caps from PolicyConfig."""
    caps = db.query(PolicyConfig).filter(PolicyConfig.scope == "WORKLOAD_CAPS").all()
    result = {}
    for cap in caps:
        result[cap.key] = float(cap.value)
    if not result: # Defaults
        result = {"max_professor": 12, "max_associate": 14, "max_assistant": 16, "incharge_reduction": 2}
    return result

@router.post("/settings/caps")
def update_workload_caps(
    caps_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Update hour caps in PolicyConfig."""
    for key, value in caps_data.items():
        cap = db.query(PolicyConfig).filter(PolicyConfig.scope == "WORKLOAD_CAPS", PolicyConfig.key == key).first()
        if cap:
            cap.value = str(value)
        else:
            new_cap = PolicyConfig(key=key, scope="WORKLOAD_CAPS", value=str(value))
            db.add(new_cap)
    return {"message": "Caps updated successfully"}

@router.post("/finalize/department")
def finalize_department_workload(
    workspace_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Snapshot current workload and move all relevant workspaces to FINALIZED with strict validation."""
    from app.models.domain import AcademicWorkspace, WorkspaceWorkflowStateEnum, WorkloadVersion, SubjectAllocation, AllocationComponent, FacultyProfile, PolicyConfig, Section, AllocationStatusEnum
    from app.services.workload_service import WorkloadService
    
    # 1. Fetch unfinalized workspaces in the department that have allocations
    query = db.query(AcademicWorkspace).join(SubjectAllocation).filter(
        AcademicWorkspace.department_id == current_user.department_id,
        AcademicWorkspace.workflow_state != WorkspaceWorkflowStateEnum.FINALIZED
    )
    
    if workspace_id:
        query = query.filter(AcademicWorkspace.id == workspace_id)
        
    workspaces = query.all()
    
    if not workspaces:
        raise HTTPException(status_code=400, detail="No unfinalized workspaces with allocations found.")
        
    workspace_ids = [ws.id for ws in workspaces]
    
    # 2. Fetch all allocations for these workspaces
    allocations = db.query(SubjectAllocation).filter(
        SubjectAllocation.workspace_id.in_(workspace_ids)
    ).all()
    
    # Validation structures
    faculty_hours = {}
    conflict_map = set() # (workspace_id, subject_id, section_id)
    
    for sa in allocations:
        # Validate Section validity
        if not sa.section_id:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Allocation missing section for subject {sa.subject_id}.")
            
        sec = db.query(Section).filter(Section.id == sa.section_id).first()
        if not sec or sec.workspace_id != sa.workspace_id:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Invalid section identity for subject {sa.subject_id}.")
            
        # Validate Conflict Scoping
        conflict_key = (sa.workspace_id, sa.subject_id, sa.section_id)
        if conflict_key in conflict_map:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Conflicting allocation detected for subject {sa.subject_id} in section {sec.name}.")
        conflict_map.add(conflict_key)
        
        # Accumulate Faculty Hours & Validate bounds
        for comp in sa.components:
            fac_id = comp.faculty_id
            if fac_id not in faculty_hours:
                faculty_hours[fac_id] = 0
                
            if comp.theory_hours < 0 or comp.practical_hours < 0:
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Negative hours found for faculty {fac_id} on subject {sa.subject_id}.")
            if comp.theory_hours + comp.practical_hours == 0:
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Zero total hours allocated for faculty {fac_id} on subject {sa.subject_id}.")
                
            faculty_hours[fac_id] += (comp.theory_hours + comp.practical_hours)
            
    # 3. Fetch Faculty Profiles and Policy Configs to enforce Hour Caps
    policy_prof = db.query(PolicyConfig).filter(PolicyConfig.key == "max_professor").first()
    policy_assoc = db.query(PolicyConfig).filter(PolicyConfig.key == "max_associate").first()
    policy_asst = db.query(PolicyConfig).filter(PolicyConfig.key == "max_assistant").first()
    
    cap_prof = int(policy_prof.value) if policy_prof else 12
    cap_assoc = int(policy_assoc.value) if policy_assoc else 14
    cap_asst = int(policy_asst.value) if policy_asst else 16
    
    for fac_id, total_hours in faculty_hours.items():
        fp = db.query(FacultyProfile).filter(FacultyProfile.id == fac_id).first()
        if not fp:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Invalid faculty profile referenced: {fac_id}")
            
        desig = fp.designation.lower()
        if "professor" in desig and "associate" not in desig and "assistant" not in desig:
            fac_cap = cap_prof
        elif "associate" in desig:
            fac_cap = cap_assoc
        else:
            fac_cap = cap_asst
            
        if total_hours > fac_cap:
            db.rollback()
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot finalize: Faculty {fp.name} ({fp.erp_id}) workload cap exceeded. Allocated: {total_hours} hrs, Cap: {fac_cap} hrs."
            )
            
    # 4. If all validations pass, snapshot and transition states securely
    for ws in workspaces:
        # Mark allocations as FINALIZED
        ws_allocations = [a for a in allocations if a.workspace_id == ws.id]
        for a in ws_allocations:
            a.status = AllocationStatusEnum.FINALIZED

        # Create Workload Version Snapshot
        snapshot_data = workload_service.get_faculty_workload(db, current_user.department_id, ws.id)
        version = ws.version + 1 if ws.version else 1
        snapshot = WorkloadVersion(
            workspace_id=ws.id,
            version_no=version,
            snapshot_json=json.dumps(snapshot_data),
            reason="HOD Department Finalization"
        )
        db.add(snapshot)
        ws.workflow_state = WorkspaceWorkflowStateEnum.FINALIZED
        ws.version = version
        
    db.commit()
    return {"message": f"Successfully finalized {len(workspaces)} workspaces."}

@router.post("/reopen/department")
def reopen_department_workload(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Reopen finalized workloads for the department."""
    from app.models.domain import AcademicWorkspace, WorkspaceWorkflowStateEnum
    
    workspaces = db.query(AcademicWorkspace).filter(
        AcademicWorkspace.department_id == current_user.department_id,
        AcademicWorkspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED
    ).all()
    
    if not workspaces:
        return {"message": "No finalized workspaces found."}
        
    for ws in workspaces:
        ws.workflow_state = WorkspaceWorkflowStateEnum.ALLOCATION
        
    db.commit()
    return {"message": f"Successfully reopened {len(workspaces)} workspaces."}

