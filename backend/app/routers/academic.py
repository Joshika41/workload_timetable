from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.connection import get_db
from app.models.domain import (
    Department, Programme, AcademicYear, CurriculumOffering, Section,
    User, AcademicWorkspace, WorkspaceWorkflowStateEnum, FacultyProfile,
    Institution
)
from app.auth.dependencies import get_current_user, require_role
from app.schemas.academic import DepartmentResponse, AcademicWorkspaceResponse
from app.auth.workspace_auth import verify_workspace_access
from app.core.workspace import WorkspaceContext

router = APIRouter()

@router.get("/institutions")
def get_institutions(db: Session = Depends(get_db)):
    institutions = db.query(Institution).all()
    return [{"id": i.id, "name": i.name} for i in institutions]

@router.get("/departments", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_db)):
    """List all departments with their programmes."""
    depts = db.query(Department).all()
    result = []
    for d in depts:
        progs = [
            {
                "id": p.id,
                "name": p.name,
                "programme_type": p.programme_type
            }
            for p in d.programmes
        ]
        result.append({"id": d.id, "name": d.name, "programmes": progs})
    return result

@router.get("/departments/{dept_id}/programmes")
def get_programmes_by_dept(dept_id: int, db: Session = Depends(get_db)):
    """Get all programmes for a department, grouped by UG/PG level."""
    progs = db.query(Programme).filter(Programme.department_id == dept_id).all()
    ug = [{"id": p.id, "name": p.name, "programme_type": p.programme_type} for p in progs if p.programme_type == "UG"]
    pg = [{"id": p.id, "name": p.name, "programme_type": p.programme_type} for p in progs if p.programme_type == "PG"]
    return {"undergraduate": ug, "postgraduate": pg}

@router.get("/programmes/{programme_id}/semesters")
def get_programme_semesters(
    programme_id: int,
    sem_type: Optional[str] = Query("ODD"),
    db: Session = Depends(get_db)
):
    """Return available semesters for a programme and semester type (ODD/EVEN)."""
    prog = db.query(Programme).filter(Programme.id == programme_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Programme not found")
    
    # Determine max semesters: PG=4, UG=6 (7 and 8 eliminated)
    max_sem = 4 if prog.programme_type == "PG" else 6
    all_sems = list(range(1, max_sem + 1))
    
    if sem_type == "ODD":
        filtered = [s for s in all_sems if s % 2 != 0]
    else:
        filtered = [s for s in all_sems if s % 2 == 0]
    
    return {"programme_id": programme_id, "programme_type": prog.programme_type, "semester_type": sem_type, "semesters": filtered}

@router.get("/faculty/list")
def get_faculty_for_context(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get faculty list for a department (for 'who are you' selector and HOD allocation pool)."""
    query = db.query(FacultyProfile).join(User, FacultyProfile.user_id == User.id)
    if department_id:
        query = query.filter(User.department_id == department_id)
    
    profiles = query.all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "erp_id": p.erp_id,
            "designation": p.designation,
            "user_id": p.user_id,
            "is_dummy": p.is_dummy,
            "is_placeholder": p.is_placeholder,
        }
        for p in profiles
    ]

@router.get("/academic-workspaces", response_model=List[AcademicWorkspaceResponse])
def get_academic_workspaces(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all workspaces for the authenticated user's department."""
    workspaces = db.query(AcademicWorkspace).filter(
        AcademicWorkspace.department_id == current_user.department_id
    ).all()

    result = []
    for w in workspaces:
        semester_type = "ODD" if w.semester.semester_number % 2 != 0 else "EVEN"
        sections = db.query(Section).filter(Section.workspace_id == w.id).all()
        seen_names = set()
        section_list = []
        for s in sections:
            if s.name not in seen_names:
                seen_names.add(s.name)
                section_list.append({"id": s.id, "name": s.name})

        result.append({
            "workspace_id": w.id,
            "department_id": w.department_id,
            "department_name": w.department.name,
            "programme_id": w.programme_id,
            "programme_name": w.programme.name,
            "programme_year": w.programme_year,
            "academic_year_id": w.academic_year_id,
            "academic_year_name": w.academic_year.name,
            "semester": w.semester.semester_number,
            "semester_type": semester_type,
            "workflow_state": w.workflow_state.value,
            "sections": section_list,
        })

    return result

@router.get("/workspaces-by-context")
def get_workspaces_by_context(
    programme_id: int,
    semester_type: str = "ODD",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all workspaces for a specific programme and semester type."""
    workspaces = db.query(AcademicWorkspace).filter(
        AcademicWorkspace.programme_id == programme_id,
        AcademicWorkspace.department_id == current_user.department_id
    ).all()

    result = []
    for w in workspaces:
        sem_num = w.semester.semester_number
        is_odd = sem_num % 2 != 0
        if (semester_type == "ODD" and not is_odd) or (semester_type == "EVEN" and is_odd):
            continue

        # Count faculty stats
        from app.models.domain import PreferenceSubmission, FacultyCycleState, AllocationComponent, SubjectAllocation
        submitted_count = db.query(PreferenceSubmission).filter(
            PreferenceSubmission.workspace_id == w.id,
            PreferenceSubmission.status == "SUBMITTED"
        ).count()
        
        allocated_count = db.query(FacultyCycleState).filter(
            FacultyCycleState.workspace_id == w.id,
            FacultyCycleState.state == "ALLOCATED"
        ).count()
        
        pool_count = db.query(FacultyCycleState).filter(
            FacultyCycleState.workspace_id == w.id
        ).count()
        
        # Subject count from curriculum offerings
        from app.models.domain import CurriculumOffering
        subject_count = db.query(CurriculumOffering).filter(
            CurriculumOffering.programme_id == programme_id,
            CurriculumOffering.semester == sem_num,
            CurriculumOffering.semester_type == semester_type
        ).count()

        # Progress % for sphere
        progress = 0
        if pool_count > 0:
            progress = round((allocated_count / pool_count) * 100)

        sections = db.query(Section).filter(Section.workspace_id == w.id).all()
        seen_names = set()
        section_list = []
        for s in sections:
            if s.name not in seen_names:
                seen_names.add(s.name)
                section_list.append({"id": s.id, "name": s.name})

        result.append({
            "workspace_id": w.id,
            "department_id": w.department_id,
            "programme_id": w.programme_id,
            "programme_name": w.programme.name,
            "programme_year": w.programme_year,
            "semester": sem_num,
            "semester_type": "ODD" if is_odd else "EVEN",
            "academic_year_name": w.academic_year.name,
            "workflow_state": w.workflow_state.value,
            "subject_count": subject_count,
            "submitted_count": submitted_count,
            "allocated_count": allocated_count,
            "pool_count": pool_count,
            "progress_percent": progress,
            "sections": section_list,
        })
    
    result.sort(key=lambda x: x["semester"])
    return result

@router.get("/subjects")
def get_subjects(
    workspace_id: str,
    db: Session = Depends(get_db),
    workspace: WorkspaceContext = Depends(verify_workspace_access)
):
    offerings = db.query(CurriculumOffering).filter(
        CurriculumOffering.programme_id == workspace.programme_id,
        CurriculumOffering.programme_year == workspace.programme_year,
        CurriculumOffering.academic_year_id == workspace.academic_year_id,
        CurriculumOffering.semester == workspace.semester
    ).all()

    result = []
    seen_codes = set()
    for off in offerings:
        sub = off.subject
        if sub.course_code not in seen_codes:
            seen_codes.add(sub.course_code)
            result.append({
                "id": sub.id,
                "course_code": sub.course_code,
                "course_name": sub.course_name,
                "category": sub.category,
                "theory_hours": sub.theory_hours,
                "practical_hours": sub.practical_hours,
                "total_hours": sub.total_hours,
                "credits": sub.credits,
            })
    return result

@router.get("/workspaces/{workspace_id}/workflow-status")
def get_workspace_workflow_status(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    workspace = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if current_user.department_id != workspace.department_id:
        raise HTTPException(status_code=403, detail="Not authorized for this workspace")

    from app.models.domain import PreferenceSubmission, SubjectAllocation, FacultyCycleState
    pref_count = db.query(PreferenceSubmission).filter(
        PreferenceSubmission.workspace_id == workspace_id,
        PreferenceSubmission.status == "SUBMITTED"
    ).count()
    alloc_count = db.query(SubjectAllocation).filter(
        SubjectAllocation.workspace_id == workspace_id
    ).count()
    pool_count = db.query(FacultyCycleState).filter(
        FacultyCycleState.workspace_id == workspace_id
    ).count()
    allocated_count = db.query(FacultyCycleState).filter(
        FacultyCycleState.workspace_id == workspace_id,
        FacultyCycleState.state.in_(["ALLOCATED", "NO_TEACHING"])
    ).count()
    progress = round((allocated_count / pool_count) * 100) if pool_count > 0 else 0

    return {
        "workspace_id": workspace.id,
        "workflow_state": workspace.workflow_state.value,
        "is_finalized": workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED,
        "preference_submissions": pref_count,
        "allocations": alloc_count,
        "pool_count": pool_count,
        "allocated_count": allocated_count,
        "progress_percent": progress,
    }

@router.get("/workspaces/{workspace_id}/finalization")
def get_workspace_finalization(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["HOD", "ERP_COORDINATOR"]))
):
    workspace = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {
        "workspace_id": workspace.id,
        "workflow_state": workspace.workflow_state.value,
        "is_finalized": workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED
    }

@router.post("/workspaces/{workspace_id}/finalize")
def finalize_workspace(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["HOD", "ERP_COORDINATOR"]))
):
    workspace = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
        raise HTTPException(status_code=400, detail="Workspace is already finalized")
    workspace.workflow_state = WorkspaceWorkflowStateEnum.FINALIZED
    db.commit()
    return {"success": True, "message": "Workspace finalized successfully", "workflow_state": workspace.workflow_state.value}
