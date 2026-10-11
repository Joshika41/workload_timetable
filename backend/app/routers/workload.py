from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Response, Query
from sqlalchemy.orm import Session
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

@router.get("/dashboard")
def get_hod_dashboard_stats(
    workspace_id: Optional[str] = Query(None),
    semester_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """HOD dashboard statistics."""
    from app.models.domain import AcademicWorkspace, WorkspaceWorkflowStateEnum, PreferenceSubmission, Semester, PreferenceStatusEnum, Programme, SubjectAllocation, AllocationComponent
    
    # 1. Total Faculty in Dept
    faculties = db.query(FacultyProfile).join(User).filter(User.department_id == current_user.department_id).all()
    total_faculty = len(faculties)
    
    # 2. Department Programmes
    progs = db.query(Programme).filter(Programme.department_id == current_user.department_id).all()
    programmes_list = [p.name for p in progs]
    
    # 3. ODD/EVEN Submission Progress
    from app.models.domain import FacultyProgrammeScope, CurriculumOffering, SemesterTypeEnum
    all_fac_ids = [f.id for f in faculties]
    all_scopes = db.query(FacultyProgrammeScope).filter(FacultyProgrammeScope.faculty_id.in_(all_fac_ids)).all()
    scopes_by_fac = defaultdict(list)
    for sc in all_scopes:
        scopes_by_fac[sc.faculty_id].append(sc.programme_id)

    dept_prog_ids = [p.id for p in progs]

    def get_submission_counts(sem_type):
        submitted = 0
        target_st = sem_type.upper()
        sem_type_enum = SemesterTypeEnum(target_st)
        for f in faculties:
            subs = db.query(PreferenceSubmission).filter(
                PreferenceSubmission.faculty_id == f.id,
                PreferenceSubmission.status.in_([PreferenceStatusEnum.SUBMITTED, PreferenceStatusEnum.APPROVED])
            ).join(AcademicWorkspace, PreferenceSubmission.workspace_id == AcademicWorkspace.id)\
             .join(Semester, AcademicWorkspace.semester_id == Semester.id)

            if target_st == "ODD":
                subs = subs.filter(Semester.semester_number % 2 != 0)
            else:
                subs = subs.filter(Semester.semester_number % 2 == 0)

            sub_contexts = set((s.workspace.semester.semester_number, s.workspace.programme_id) for s in subs.all() if s.workspace and s.workspace.semester)
            fac_prog_ids = scopes_by_fac.get(f.id) or dept_prog_ids

            app_contexts = set()
            if fac_prog_ids:
                offs = db.query(CurriculumOffering).filter(
                    CurriculumOffering.programme_id.in_(fac_prog_ids),
                    CurriculumOffering.semester_type == sem_type_enum,
                    CurriculumOffering.requires_preference == True
                ).all()
                for o in offs:
                    app_contexts.add((o.semester, o.programme_id))

            if app_contexts:
                if app_contexts.issubset(sub_contexts):
                    submitted += 1
            elif sub_contexts:
                submitted += 1

        return {"submitted": submitted, "not_submitted": total_faculty - submitted}
        
    odd_stats = get_submission_counts("ODD")
    even_stats = get_submission_counts("EVEN")
    
    # 4. Finalization status
    if workspace_id:
        ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
        finalization_status = ws.workflow_state.value if ws else "UNKNOWN"
    else:
        ws_all = db.query(AcademicWorkspace).filter(AcademicWorkspace.department_id == current_user.department_id).all()
        if not ws_all:
            finalization_status = "UNKNOWN"
        elif all(w.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED for w in ws_all):
            finalization_status = "FINALIZED"
        else:
            finalization_status = "IN_PROGRESS"
            
    # 5. ALLOCATION Progress (Actual Workload Metric)
    active_st = semester_type.upper() if semester_type else "ODD"
    
    # Count distinct faculty who have at least one allocation in the current semester context
    allocated_query = db.query(AllocationComponent.faculty_id).join(
        SubjectAllocation, AllocationComponent.allocation_id == SubjectAllocation.id
    ).join(
        AcademicWorkspace, SubjectAllocation.workspace_id == AcademicWorkspace.id
    ).join(
        Semester, AcademicWorkspace.semester_id == Semester.id
    ).join(
        FacultyProfile, AllocationComponent.faculty_id == FacultyProfile.id
    ).join(
        User, FacultyProfile.user_id == User.id
    ).filter(
        User.department_id == current_user.department_id
    )
    
    if active_st == "ODD":
        allocated_query = allocated_query.filter(Semester.semester_number % 2 != 0)
    else:
        allocated_query = allocated_query.filter(Semester.semester_number % 2 == 0)
        
    allocated_faculty = allocated_query.distinct().count()
    
    faculty_with_teaching = allocated_faculty
    faculty_no_teaching = total_faculty - faculty_with_teaching
    allocation_progress = f"{faculty_with_teaching}/{total_faculty}"
    reconciliation_status = "IN_PROGRESS"
    
    return {
        "faculty_count": total_faculty,
        "programmes": programmes_list,
        "odd_stats": odd_stats,
        "even_stats": even_stats,
        "faculty_with_teaching": faculty_with_teaching,
        "faculty_no_teaching": faculty_no_teaching,
        "allocation_progress": allocation_progress,
        "reconciliation_status": reconciliation_status,
        "finalization_status": finalization_status
    }
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
    workspace_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value]))
):
    """Faculty member's finalized subject assignments."""
    if not current_user.faculty_profile:
        return []
    return workload_service.get_faculty_subjects(db, current_user.faculty_profile.id, workspace_id)

@router.get("/viewer/{semester_type}")
def get_workload_viewer(
    semester_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Returns detailed allocation rows for the specified semester type."""
    from app.models.domain import SubjectAllocation, AllocationComponent, AcademicWorkspace, Semester, Subject, Section, FacultyProfile, Programme, CurriculumOffering
    target_st = semester_type.upper()
    
    query = db.query(AllocationComponent).join(
        SubjectAllocation, AllocationComponent.allocation_id == SubjectAllocation.id
    ).join(
        AcademicWorkspace, SubjectAllocation.workspace_id == AcademicWorkspace.id
    ).join(
        Semester, AcademicWorkspace.semester_id == Semester.id
    ).join(
        Subject, SubjectAllocation.subject_id == Subject.id
    ).join(
        FacultyProfile, AllocationComponent.faculty_id == FacultyProfile.id
    ).join(
        User, FacultyProfile.user_id == User.id
    ).filter(
        User.department_id == current_user.department_id
    )
    
    if target_st == "ODD":
        query = query.filter(Semester.semester_number % 2 != 0)
    elif target_st == "EVEN":
        query = query.filter(Semester.semester_number % 2 == 0)
        
    components = query.all()
    result = []
    
    for comp in components:
        sa = comp.allocation
        sec = db.query(Section).filter(Section.id == sa.section_id).first() if sa.section_id else None
        
        # Get Programme
        prog_name = "Unknown Programme"
        offering = db.query(CurriculumOffering).filter(CurriculumOffering.subject_id == sa.subject_id).first()
        if offering:
            prog = db.query(Programme).filter(Programme.id == offering.programme_id).first()
            if prog:
                prog_name = prog.name
                
        result.append({
            "faculty_name": comp.faculty.name,
            "department": current_user.department.name,
            "programme": prog_name,
            "subject_code": sa.subject.course_code,
            "subject_name": sa.subject.course_name,
            "semester": sa.workspace.semester.semester_number,
            "section": sec.name if sec else "-",
            "role": comp.role.value,
            "theory_hours": comp.theory_hours,
            "lab_hours": comp.practical_hours,
            "total_hours": comp.theory_hours + comp.practical_hours,
            "allocation_status": "Allocated"
        })
        
    # Sort by faculty name, then subject
    result.sort(key=lambda x: (x["faculty_name"], x["subject_name"]))
    return result

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
            
    # Validate reconciliation for all subjects in workspaces
    for ws in workspaces:
        ws_allocations = [a for a in allocations if a.workspace_id == ws.id]
        subjects_in_ws = list(set(a.subject_id for a in ws_allocations))
        
        workload_service = WorkloadService()
        for subj in subjects_in_ws:
            recon = workload_service.calculate_subject_reconciliation(db, subj, ws.id)
            if recon and recon["status"] != "RECONCILED":
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Cannot finalize: Subject ID {subj} is not fully reconciled (Status: {recon['status']}).")
                
    # 3. Fetch Faculty Profiles to enforce Hour Caps
    from app.services.faculty_service import FacultyService
    faculty_service = FacultyService()
    
    for fac_id, total_hours in faculty_hours.items():
        fp = db.query(FacultyProfile).filter(FacultyProfile.id == fac_id).first()
        if not fp:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Invalid faculty profile referenced: {fac_id}")
            
        fac_cap = faculty_service.get_faculty_target_workload(db, fp)
            
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

