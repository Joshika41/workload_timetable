from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from collections import defaultdict
from app.database.connection import get_db
from app.models.domain import (
    Department, Programme, AcademicYear, CurriculumOffering, Section,
    User, AcademicWorkspace, WorkspaceWorkflowStateEnum, FacultyProfile,
    Institution, RoleEnum, Subject, PolicyConfig, SemesterTypeEnum
)
from app.models.timetable import TimetableRoom
from app.auth.dependencies import get_current_user, require_role
from app.schemas.academic import DepartmentResponse, AcademicWorkspaceResponse
from app.auth.workspace_auth import verify_workspace_access
from app.core.workspace import WorkspaceContext
from pydantic import BaseModel
import json

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
    workspace_id: Optional[str] = Query(None),
    curriculum_offering_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Get faculty list for a department or specific offering/workspace (HOD allocation pool)."""
    from app.models.domain import FacultyWorkspaceScope, OfferingTeachingRule, FacultyTeachingEligibility
    
    query = db.query(FacultyProfile).join(User, FacultyProfile.user_id == User.id)
    
    if curriculum_offering_id and workspace_id:
        rule = db.query(OfferingTeachingRule).filter_by(curriculum_offering_id=curriculum_offering_id).first()
        if rule and rule.cross_department_allowed:
            # Can be home-workspace faculty OR anyone with matching teaching domain
            # We will fetch faculty in the workspace, PLUS any faculty (even other depts) with matching eligibility
            query = query.outerjoin(FacultyWorkspaceScope, FacultyWorkspaceScope.faculty_id == FacultyProfile.id)\
                         .outerjoin(FacultyTeachingEligibility, FacultyTeachingEligibility.faculty_id == FacultyProfile.id)\
                         .filter(
                             (FacultyWorkspaceScope.workspace_id == workspace_id) |
                             (FacultyTeachingEligibility.domain_code == rule.teaching_domain_code)
                         )
        else:
            # Normal home-workspace faculty
            query = query.join(FacultyWorkspaceScope, FacultyWorkspaceScope.faculty_id == FacultyProfile.id)\
                         .filter(FacultyWorkspaceScope.workspace_id == workspace_id)
    elif workspace_id:
        # Fallback to workspace members
        query = query.join(FacultyWorkspaceScope, FacultyWorkspaceScope.faculty_id == FacultyProfile.id)\
                     .filter(FacultyWorkspaceScope.workspace_id == workspace_id)
    elif department_id:
        query = query.filter(User.department_id == department_id)
    
    # Need distinct because of outer joins
    profiles = query.distinct().all()
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
    programme_id: int = 0,
    semester_type: str = "ODD",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all workspaces for a specific programme and semester type. If programme_id is 0, returns all for department."""
    from app.models.domain import AcademicWorkspace, FacultyProfile, FacultyWorkspaceScope
    
    query = db.query(AcademicWorkspace)
    
    is_hod = False
    if current_user.role == RoleEnum.HOD or current_user.role == RoleEnum.ERP_COORDINATOR:
        is_hod = True
    elif current_user.role == RoleEnum.FACULTY:
        fp = current_user.faculty_profile
        if fp and ('HOD' in fp.designation.upper() or 'HEAD' in fp.designation.upper()):
            is_hod = True

    if not is_hod:
        query = query.join(FacultyWorkspaceScope, FacultyWorkspaceScope.workspace_id == AcademicWorkspace.id)\
                     .join(FacultyProfile, FacultyProfile.id == FacultyWorkspaceScope.faculty_id)\
                     .filter(FacultyProfile.user_id == current_user.id)
    else:
        # HOD / Admin sees department workspaces
        query = query.filter(AcademicWorkspace.department_id == current_user.department_id)

    if programme_id:
        from app.models.domain import WorkspaceProgrammeMap
        query = query.join(WorkspaceProgrammeMap, WorkspaceProgrammeMap.workspace_id == AcademicWorkspace.id)\
                     .filter(WorkspaceProgrammeMap.programme_id == programme_id)
                     
    workspaces = query.all()

    result = []
    for w in workspaces:
        sem_num = w.semester.semester_number
        is_odd = sem_num % 2 != 0
        if (semester_type == "ODD" and not is_odd) or (semester_type == "EVEN" and is_odd):
            continue

    ws_ids = [w.id for w in workspaces]

    # Pre-fetch sections for all workspaces in a single query
    sections_by_ws = defaultdict(list)
    seen_sec_names = defaultdict(set)
    if ws_ids:
        all_sections = db.query(Section).filter(Section.workspace_id.in_(ws_ids)).all()
        for s in all_sections:
            if s.name not in seen_sec_names[s.workspace_id]:
                seen_sec_names[s.workspace_id].add(s.name)
                sections_by_ws[s.workspace_id].append({"id": s.id, "name": s.name})

    # Pre-fetch counts using SQL GROUP BY instead of 4 queries per workspace
    from app.models.domain import PreferenceSubmission, FacultyCycleState, AllocationComponent, SubjectAllocation, CurriculumOffering
    from sqlalchemy import func

    sub_counts = dict(
        db.query(PreferenceSubmission.workspace_id, func.count(PreferenceSubmission.id))
        .filter(PreferenceSubmission.workspace_id.in_(ws_ids), PreferenceSubmission.status == "SUBMITTED")
        .group_by(PreferenceSubmission.workspace_id)
        .all()
    ) if ws_ids else {}

    alloc_counts = dict(
        db.query(FacultyCycleState.workspace_id, func.count(FacultyCycleState.id))
        .filter(FacultyCycleState.workspace_id.in_(ws_ids), FacultyCycleState.state == "ALLOCATED")
        .group_by(FacultyCycleState.workspace_id)
        .all()
    ) if ws_ids else {}

    pool_counts = dict(
        db.query(FacultyCycleState.workspace_id, func.count(FacultyCycleState.id))
        .filter(FacultyCycleState.workspace_id.in_(ws_ids))
        .group_by(FacultyCycleState.workspace_id)
        .all()
    ) if ws_ids else {}

    result = []
    for w in workspaces:
        sem_num = w.semester.semester_number if w.semester else 0
        is_odd = sem_num % 2 != 0
        if (semester_type == "ODD" and not is_odd) or (semester_type == "EVEN" and is_odd):
            continue

        submitted_count = sub_counts.get(w.id, 0)
        allocated_count = alloc_counts.get(w.id, 0)
        pool_count = pool_counts.get(w.id, 0)
        
        progress = 0
        if pool_count > 0:
            progress = round((allocated_count / pool_count) * 100)

        section_list = sections_by_ws.get(w.id, [])

        result.append({
            "workspace_id": w.id,
            "department_id": w.department_id,
            "programme_id": w.programme_id,
            "programme_name": w.programme.name if w.programme else "",
            "programme_year": w.programme_year,
            "semester": sem_num,
            "semester_type": "ODD" if is_odd else "EVEN",
            "academic_year_name": w.academic_year.name if w.academic_year else "",
            "workflow_state": w.workflow_state.value if hasattr(w.workflow_state, 'value') else str(w.workflow_state),
            "subject_count": 0,
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
    from app.models.domain import OfferingTeachingRule
    
    # We join OfferingTeachingRule and filter to keep those where preference_eligible is True or there is no rule
    offerings_query = db.query(CurriculumOffering).outerjoin(
        OfferingTeachingRule, OfferingTeachingRule.curriculum_offering_id == CurriculumOffering.id
    ).filter(
        CurriculumOffering.programme_id == workspace.programme_id,
        CurriculumOffering.programme_year == workspace.programme_year,
        CurriculumOffering.academic_year_id == workspace.academic_year_id,
        CurriculumOffering.semester == workspace.semester,
        (OfferingTeachingRule.id == None) | (OfferingTeachingRule.preference_eligible == True)
    )
    offerings = offerings_query.all()

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


# =====================================================================
# CURRICULUM SUBJECTS MANAGEMENT & SELECTION (HOD / MCA PORTAL)
# =====================================================================

class BatchUpdateSubjectsRequest(BaseModel):
    programme_id: int
    semester: int
    selected_offering_ids: List[int]

class DepartmentCapacityRequest(BaseModel):
    department_id: int
    total_classrooms: int = 6
    classroom_capacity: int = 60
    total_labs: int = 4
    lab_capacity: int = 35

class MasterSubjectCreateRequest(BaseModel):
    course_code: str
    course_name: str
    category: str = "CORE"
    theory_hours: int = 3
    practical_hours: int = 0
    credits: int = 3
    programme_id: Optional[int] = None
    semester: Optional[int] = None

class MasterSubjectUpdateRequest(BaseModel):
    course_code: Optional[str] = None
    course_name: Optional[str] = None
    category: Optional[str] = None
    theory_hours: Optional[int] = None
    practical_hours: Optional[int] = None
    credits: Optional[int] = None

def categorize_srm_course(course_code: str, category_raw: str = None):
    code = (course_code or "").upper().strip()
    course_type = "Theory"
    if code.endswith("J"):
        course_type = "Integrated (Theory + Practical)"
    elif code.endswith("L"):
        course_type = "Practical / Lab"
    elif code.endswith("T"):
        course_type = "Theory"
    elif "PROJECT" in (category_raw or "").upper():
        course_type = "Project"
        
    if "AE" in code:
        return "ABILITY_ENHANCEMENT", "Ability Enhancement Courses (AEC)", course_type
    elif "25C" in code or "21C" in code or code.startswith("PCA25C") or code.startswith("CAC"):
        return "CORE", "Professional Core Courses", course_type
    elif "25D" in code or "21D" in code or code.startswith("PCA25D") or code.startswith("CAD"):
        return "DISCIPLINE_ELECTIVE", "Discipline Elective Courses", course_type
    elif "25G" in code or "21G" in code or code.startswith("PCA25G") or code.startswith("CAG"):
        return "GENERIC_ELECTIVE", "Generic Elective Courses", course_type
    elif "25S" in code or "21S" in code or code.startswith("PCA25S") or code.startswith("CAS"):
        return "SKILL_ENHANCEMENT", "Skill Enhancement Courses (SEC)", course_type
    elif "25P" in code or "21P" in code or code.startswith("PCA25P") or code.startswith("CAP"):
        return "PROJECT_INTERNSHIP", "Project Work & Internship", course_type
    
    cat_str = (category_raw or "CORE").upper()
    if "ELECTIVE" in cat_str:
        return "DISCIPLINE_ELECTIVE", "Discipline Elective Courses", course_type
    elif "SKILL" in cat_str:
        return "SKILL_ENHANCEMENT", "Skill Enhancement Courses (SEC)", course_type
    elif "ABILITY" in cat_str:
        return "ABILITY_ENHANCEMENT", "Ability Enhancement Courses (AEC)", course_type
    elif "PROJECT" in cat_str or "INTERN" in cat_str:
        return "PROJECT_INTERNSHIP", "Project Work & Internship", course_type
    return "CORE", "Professional Core Courses", course_type

CATEGORY_ORDER = {
    "CORE": 1,
    "DISCIPLINE_ELECTIVE": 2,
    "GENERIC_ELECTIVE": 3,
    "SKILL_ENHANCEMENT": 4,
    "ABILITY_ENHANCEMENT": 5,
    "PROJECT_INTERNSHIP": 6
}

@router.get("/curriculum-subjects")
def get_curriculum_subjects(
    department_id: Optional[int] = Query(None),
    programme_id: Optional[int] = Query(None),
    semester: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns all curriculum offerings for a programme/department, grouped by syllabus category.
    Includes tick-selection state (requires_preference) so HOD can select offered subjects.
    """
    target_prog = None
    if programme_id:
        target_prog = db.query(Programme).filter(Programme.id == programme_id).first()
    elif department_id:
        target_prog = db.query(Programme).filter(Programme.department_id == department_id).first()
    
    if not target_prog:
        # Fallback to MCA (id 6)
        target_prog = db.query(Programme).filter(Programme.id == 6).first()
        if not target_prog:
            target_prog = db.query(Programme).first()
            
    if not target_prog:
        return {"programme_id": 0, "programme_name": "", "department_id": 0, "semesters": [], "subjects": []}

    query = db.query(CurriculumOffering).filter(CurriculumOffering.programme_id == target_prog.id)
    all_offerings = query.all()
    available_sems = sorted(list(set(o.semester for o in all_offerings)))
    
    if not available_sems:
        available_sems = [1, 2, 3, 4] if target_prog.programme_type == "PG" else [1, 2, 3, 4, 5, 6]

    filtered_offerings = [o for o in all_offerings if (semester is None or o.semester == semester)]

    subjects_data = []
    for off in filtered_offerings:
        sub = off.subject
        if not sub:
            continue
        cat_key, cat_label, course_type = categorize_srm_course(sub.course_code, sub.category)
        
        # Calculate L-T-P breakdown cleanly
        t_hrs = sub.theory_hours or 0
        p_hrs = sub.practical_hours or 0
        # If integrated course has 0 practical hours recorded, derive standard
        if course_type.startswith("Integrated") and p_hrs == 0:
            p_hrs = 2
            
        subjects_data.append({
            "offering_id": off.id,
            "subject_id": sub.id,
            "course_code": sub.course_code,
            "course_name": sub.course_name,
            "category_key": cat_key,
            "category_label": cat_label,
            "course_type": course_type,
            "theory_hours": t_hrs,
            "practical_hours": p_hrs,
            "total_hours": t_hrs + p_hrs,
            "credits": sub.credits or 0,
            "semester": off.semester,
            "semester_type": off.semester_type.value if hasattr(off.semester_type, 'value') else str(off.semester_type),
            "is_offered": bool(off.requires_preference),
            "programme_year": off.programme_year,
        })

    # Sort by semester, then category order, then course code
    subjects_data.sort(key=lambda x: (x["semester"], CATEGORY_ORDER.get(x["category_key"], 99), x["course_code"]))

    dept_name = target_prog.department.name if target_prog.department else ""
    return {
        "programme_id": target_prog.id,
        "programme_name": target_prog.name,
        "department_id": target_prog.department_id,
        "department_name": dept_name,
        "programme_type": target_prog.programme_type,
        "semesters": available_sems,
        "subjects": subjects_data
    }

@router.post("/curriculum-subjects/batch-update")
def batch_update_curriculum_subjects(
    req: BatchUpdateSubjectsRequest,
    db: Session = Depends(get_db)
):
    """
    Updates which subjects are offered (ticked) for a specific semester in this programme.
    """
    offerings = db.query(CurriculumOffering).filter(
        CurriculumOffering.programme_id == req.programme_id,
        CurriculumOffering.semester == req.semester
    ).all()
    
    selected_set = set(req.selected_offering_ids)
    updated_count = 0
    for off in offerings:
        new_val = off.id in selected_set
        if off.requires_preference != new_val:
            off.requires_preference = new_val
            updated_count += 1
            
    db.commit()
    return {
        "success": True,
        "message": f"Updated {len(offerings)} offerings ({len(selected_set)} selected)",
        "programme_id": req.programme_id,
        "semester": req.semester,
        "selected_count": len(selected_set)
    }

# =====================================================================
# DEPARTMENT INFRASTRUCTURE & SEATING CAPACITY
# =====================================================================

@router.get("/department-capacity")
def get_department_capacity(
    department_id: int = Query(...),
    db: Session = Depends(get_db)
):
    """
    Returns total classrooms, classroom capacity, total labs, and lab capacity for a department.
    """
    key = f"dept_{department_id}_capacity"
    config = db.query(PolicyConfig).filter(PolicyConfig.key == key).first()
    
    if config:
        try:
            data = json.loads(config.value)
            return {
                "department_id": department_id,
                "total_classrooms": data.get("total_classrooms", 6),
                "classroom_capacity": data.get("classroom_capacity", 60),
                "total_labs": data.get("total_labs", 4),
                "lab_capacity": data.get("lab_capacity", 35)
            }
        except Exception:
            pass
            
    return {
        "department_id": department_id,
        "total_classrooms": 6,
        "classroom_capacity": 60,
        "total_labs": 4,
        "lab_capacity": 35
    }

@router.post("/department-capacity")
def save_department_capacity(
    req: DepartmentCapacityRequest,
    db: Session = Depends(get_db)
):
    """
    Saves classroom and lab seating capacities into policy_config and timetable_rooms.
    """
    key = f"dept_{req.department_id}_capacity"
    scope = f"department_{req.department_id}"
    value_data = {
        "total_classrooms": req.total_classrooms,
        "classroom_capacity": req.classroom_capacity,
        "total_labs": req.total_labs,
        "lab_capacity": req.lab_capacity
    }
    
    config = db.query(PolicyConfig).filter(PolicyConfig.key == key).first()
    if not config:
        config = PolicyConfig(key=key, scope=scope, value=json.dumps(value_data))
        db.add(config)
    else:
        config.value = json.dumps(value_data)
        
    # Get institution_id from department
    dept = db.query(Department).filter(Department.id == req.department_id).first()
    inst_id = dept.institution_id if dept else 1

    # Sync into TimetableRoom records for timetable generation
    # Classrooms
    for c_idx in range(1, req.total_classrooms + 1):
        code = f"D{req.department_id}-CR{c_idx}"
        room = db.query(TimetableRoom).filter(TimetableRoom.room_code == code).first()
        if not room:
            room = TimetableRoom(
                institution_id=inst_id,
                room_code=code,
                room_name=f"Lecture Classroom {c_idx}",
                room_type="CLASSROOM",
                capacity=req.classroom_capacity,
                active=True
            )
            db.add(room)
        else:
            room.capacity = req.classroom_capacity
            room.active = True
            
    # Laboratories
    for l_idx in range(1, req.total_labs + 1):
        code = f"D{req.department_id}-LAB{l_idx}"
        room = db.query(TimetableRoom).filter(TimetableRoom.room_code == code).first()
        if not room:
            room = TimetableRoom(
                institution_id=inst_id,
                room_code=code,
                room_name=f"Computer Lab {l_idx}",
                room_type="LAB",
                capacity=req.lab_capacity,
                active=True
            )
            db.add(room)
        else:
            room.capacity = req.lab_capacity
            room.active = True

    db.commit()
    return {
        "success": True,
        "message": f"Successfully updated capacity for Department #{req.department_id}",
        "data": value_data
    }

# =====================================================================
# UNIVERSAL MASTER SUBJECT REPOSITORY (SUPER ADMIN)
# =====================================================================

@router.get("/master-subjects")
def get_master_subjects(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns all campus master subjects across all regulations and departments.
    """
    query = db.query(Subject)
    if search:
        s_term = f"%{search}%"
        query = query.filter((Subject.course_code.ilike(s_term)) | (Subject.course_name.ilike(s_term)))
    if category and category != "ALL":
        query = query.filter(Subject.category == category)
        
    subjects = query.order_by(Subject.course_code).all()
    result = []
    for s in subjects:
        cat_key, cat_label, c_type = categorize_srm_course(s.course_code, s.category)
        result.append({
            "id": s.id,
            "course_code": s.course_code,
            "course_name": s.course_name,
            "category": s.category,
            "category_label": cat_label,
            "course_type": c_type,
            "theory_hours": s.theory_hours or 0,
            "practical_hours": s.practical_hours or 0,
            "total_hours": s.total_hours or 0,
            "credits": s.credits or 0
        })
    return result

@router.post("/master-subjects")
def create_master_subject(
    req: MasterSubjectCreateRequest,
    db: Session = Depends(get_db)
):
    """Creates a new Master Subject in the campus repository."""
    existing = db.query(Subject).filter(Subject.course_code == req.course_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Subject with code '{req.course_code}' already exists.")
        
    sub = Subject(
        course_code=req.course_code.strip().upper(),
        course_name=req.course_name.strip(),
        category=req.category.strip().upper(),
        theory_hours=req.theory_hours,
        practical_hours=req.practical_hours,
        total_hours=req.theory_hours + req.practical_hours,
        credits=req.credits
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    
    # Optional offering link
    if req.programme_id and req.semester:
        sem_type = SemesterTypeEnum.ODD if req.semester % 2 != 0 else SemesterTypeEnum.EVEN
        prog_year = (req.semester + 1) // 2
        offering = CurriculumOffering(
            programme_id=req.programme_id,
            academic_year_id=1,
            subject_id=sub.id,
            programme_year=prog_year,
            semester=req.semester,
            semester_type=sem_type,
            requires_preference=True
        )
        db.add(offering)
        db.commit()
        
    return {"success": True, "subject_id": sub.id, "course_code": sub.course_code}

@router.put("/master-subjects/{subject_id}")
def update_master_subject(
    subject_id: int,
    req: MasterSubjectUpdateRequest,
    db: Session = Depends(get_db)
):
    """Updates an existing Master Subject."""
    sub = db.query(Subject).filter(Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    if req.course_code is not None:
        sub.course_code = req.course_code.strip().upper()
    if req.course_name is not None:
        sub.course_name = req.course_name.strip()
    if req.category is not None:
        sub.category = req.category.strip().upper()
    if req.theory_hours is not None:
        sub.theory_hours = req.theory_hours
    if req.practical_hours is not None:
        sub.practical_hours = req.practical_hours
    if req.theory_hours is not None or req.practical_hours is not None:
        sub.total_hours = (sub.theory_hours or 0) + (sub.practical_hours or 0)
    if req.credits is not None:
        sub.credits = req.credits
        
    db.commit()
    return {"success": True, "subject_id": sub.id}

@router.delete("/master-subjects/{subject_id}")
def delete_master_subject(
    subject_id: int,
    db: Session = Depends(get_db)
):
    """Deletes a Master Subject."""
    sub = db.query(Subject).filter(Subject.id == subject_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    # Delete associated curriculum offerings first
    db.query(CurriculumOffering).filter(CurriculumOffering.subject_id == subject_id).delete()
    db.delete(sub)
    db.commit()
    return {"success": True, "message": f"Subject #{subject_id} deleted"}


# =====================================================================
# WEEKLY CLASS TIMETABLE GENERATION (EXCEL 2026 FORMAT)
# =====================================================================

class GenerateWeeklyTimetableRequest(BaseModel):
    programme_id: int = 6
    semester: int = 1
    department_id: int = 5
    section: str = "A"
    default_room: str = "Room 1"

class SaveWeeklyTimetableRequest(BaseModel):
    programme_id: int
    semester: int
    department_id: int
    section: str = "A"
    schedule: List[dict]

class SwapSlotsRequest(BaseModel):
    programme_id: int
    semester: int
    section: str = "A"
    slot_a_id: str
    slot_b_id: str

PERIOD_TIMINGS = [
    {"period": 1, "time": "08:30 - 09:20"},
    {"period": 2, "time": "09:25 - 10:15"},
    {"period": 3, "time": "10:30 - 11:20"},
    {"period": 4, "time": "11:25 - 12:15"},
    {"period": 5, "time": "01:00 - 01:50"},
    {"period": 6, "time": "01:55 - 02:45"},
]

WEEK_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]

@router.get("/timetable/semester-weekly")
def get_semester_weekly_timetable(
    programme_id: int = Query(6),
    semester: int = Query(1),
    section: str = Query("A"),
    db: Session = Depends(get_db)
):
    """
    Returns the weekly timetable schedule for a programme, semester, and section.
    """
    key = f"timetable_weekly_{programme_id}_sem_{semester}_{section}"
    config = db.query(PolicyConfig).filter(PolicyConfig.key == key).first()
    
    if config:
        try:
            data = json.loads(config.value)
            return {
                "exists": True,
                "programme_id": programme_id,
                "semester": semester,
                "section": section,
                "schedule": data.get("schedule", []),
                "days": data.get("days", WEEK_DAYS[:5]),
                "periods": PERIOD_TIMINGS,
                "created_at": data.get("created_at")
            }
        except Exception:
            pass
            
    return {
        "exists": False,
        "programme_id": programme_id,
        "semester": semester,
        "section": section,
        "schedule": [],
        "days": WEEK_DAYS[:5],
        "periods": PERIOD_TIMINGS
    }

@router.post("/timetable/generate-weekly")
def generate_weekly_timetable(
    req: GenerateWeeklyTimetableRequest,
    db: Session = Depends(get_db)
):
    """
    Creates/generates a weekly timetable based on active curriculum subjects for this semester,
    matching the format of the official SRM Daily TIME TABLE Excel sheet.
    Uses 'Room 1' by default (or 'Lab 1' for practicals).
    """
    # 1. Fetch active offerings
    offerings = db.query(CurriculumOffering).filter(
        CurriculumOffering.programme_id == req.programme_id,
        CurriculumOffering.semester == req.semester,
        CurriculumOffering.requires_preference == True
    ).all()

    if not offerings:
        # Fallback to all offerings for this semester
        offerings = db.query(CurriculumOffering).filter(
            CurriculumOffering.programme_id == req.programme_id,
            CurriculumOffering.semester == req.semester
        ).all()

    # 2. Fetch department faculty
    faculty_list = db.query(FacultyProfile).join(User, FacultyProfile.user_id == User.id)\
        .filter(User.department_id == req.department_id).all()
        
    faculty_names = [f.name for f in faculty_list] if faculty_list else ["Dr K Kalaiselvi"]
    # Ensure Dr K Kalaiselvi is prioritized
    if "Dr K Kalaiselvi" not in faculty_names:
        faculty_names.insert(0, "Dr K Kalaiselvi")

    # 3. Build syllabus subject pool with target weekly hours
    subject_pool = []
    fac_idx = 0
    for off in offerings:
        sub = off.subject
        if not sub:
            continue
            
        cat_key, cat_label, c_type = categorize_srm_course(sub.course_code, sub.category)
        fac_assigned = faculty_names[fac_idx % len(faculty_names)]
        fac_idx += 1
        
        # Calculate target weekly periods (e.g. 4 for 4-credit core, 3 for electives, etc.)
        target_hours = sub.theory_hours or 3
        if target_hours < 2:
            target_hours = 2
        if target_hours > 4:
            target_hours = 4

        # Short course title
        short_name = sub.course_name
        if len(short_name) > 22:
            short_name = short_name.split()[0] + " " + " ".join(short_name.split()[1:3])

        subject_pool.append({
            "code": sub.course_code,
            "title": sub.course_name,
            "short_title": short_name,
            "category": cat_key,
            "type": c_type,
            "credits": sub.credits or 3,
            "target_hours": target_hours,
            "has_lab": "Integrated" in c_type or "Practical" in c_type,
            "faculty": fac_assigned
        })

    # 4. Generate schedule slots across Monday - Friday (5 days x 6 periods = 30 periods)
    active_days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    schedule_slots = []
    
    # Track hours allocated per subject
    allocated_counts = {s["code"]: 0 for s in subject_pool}
    
    # We will populate a 5x6 grid
    # Lab sessions get 2 consecutive periods (e.g. P3-P4 or P5-P6)
    grid = {} # (day, period) -> slot
    
    # Schedule Lab blocks first for courses with lab
    lab_courses = [s for s in subject_pool if s["has_lab"]]
    lab_days = ["TUESDAY", "THURSDAY", "WEDNESDAY"]
    for idx, lab_sub in enumerate(lab_courses[:3]):
        day = lab_days[idx % len(lab_days)]
        p_start, p_end = (3, 4) if idx % 2 == 0 else (5, 6)
        room_name = "4th Floor Lab" if idx == 0 else f"{req.default_room} (Lab)"
        
        for p in [p_start, p_end]:
            grid[(day, p)] = {
                "id": f"{day.lower()[:3]}_p{p}",
                "day": day,
                "period": p,
                "time": PERIOD_TIMINGS[p - 1]["time"],
                "course_code": lab_sub["code"],
                "course_name": lab_sub["title"],
                "course_short": f"{lab_sub['short_title']} Lab",
                "category": lab_sub["category"],
                "course_type": "Practical / Lab",
                "room": room_name,
                "faculty_name": lab_sub["faculty"],
                "shift": "SH 1",
                "section": req.section,
                "is_lab": True
            }
            allocated_counts[lab_sub["code"]] += 1

    # Now distribute theory lectures across the remaining slots
    import random
    cur_sub_idx = 0
    for day in active_days:
        for p in range(1, 7):
            if (day, p) in grid:
                continue
                
            # Pick next subject that needs hours
            chosen_sub = None
            if subject_pool:
                # Find subject with lowest allocation so far
                candidates = sorted(subject_pool, key=lambda s: allocated_counts[s["code"]])
                chosen_sub = candidates[0]
                allocated_counts[chosen_sub["code"]] += 1
            
            if chosen_sub:
                grid[(day, p)] = {
                    "id": f"{day.lower()[:3]}_p{p}",
                    "day": day,
                    "period": p,
                    "time": PERIOD_TIMINGS[p - 1]["time"],
                    "course_code": chosen_sub["code"],
                    "course_name": chosen_sub["title"],
                    "course_short": chosen_sub["short_title"],
                    "category": chosen_sub["category"],
                    "course_type": chosen_sub["type"],
                    "room": req.default_room,
                    "faculty_name": chosen_sub["faculty"],
                    "shift": "SH 1",
                    "section": req.section,
                    "is_lab": False
                }
            else:
                grid[(day, p)] = {
                    "id": f"{day.lower()[:3]}_p{p}",
                    "day": day,
                    "period": p,
                    "time": PERIOD_TIMINGS[p - 1]["time"],
                    "course_code": "TUTORIAL",
                    "course_name": "Tutorial & Technical Mentoring",
                    "course_short": "Tutorial",
                    "category": "OTHER",
                    "course_type": "Theory",
                    "room": req.default_room,
                    "faculty_name": "Dr K Kalaiselvi",
                    "shift": "SH 1",
                    "section": req.section,
                    "is_lab": False
                }

    # Flatten into list ordered by day, then period
    for day in active_days:
        for p in range(1, 7):
            if (day, p) in grid:
                schedule_slots.append(grid[(day, p)])

    # 5. Persist to PolicyConfig
    key = f"timetable_weekly_{req.programme_id}_sem_{req.semester}_{req.section}"
    import datetime
    payload = {
        "programme_id": req.programme_id,
        "semester": req.semester,
        "section": req.section,
        "department_id": req.department_id,
        "days": active_days,
        "schedule": schedule_slots,
        "created_at": datetime.datetime.now().isoformat()
    }
    
    config = db.query(PolicyConfig).filter(PolicyConfig.key == key).first()
    if not config:
        config = PolicyConfig(
            key=key,
            scope=f"programme_{req.programme_id}",
            value=json.dumps(payload)
        )
        db.add(config)
    else:
        config.value = json.dumps(payload)
    db.commit()

    return {
        "success": True,
        "message": f"Successfully generated weekly timetable for Semester {req.semester} (Section {req.section})",
        "programme_id": req.programme_id,
        "semester": req.semester,
        "section": req.section,
        "days": active_days,
        "periods": PERIOD_TIMINGS,
        "schedule": schedule_slots,
        "total_slots": len(schedule_slots)
    }

@router.post("/timetable/save-weekly")
def save_weekly_timetable(
    req: SaveWeeklyTimetableRequest,
    db: Session = Depends(get_db)
):
    """
    Saves modifications (class edits or class swaps) to the weekly timetable.
    """
    key = f"timetable_weekly_{req.programme_id}_sem_{req.semester}_{req.section}"
    import datetime
    payload = {
        "programme_id": req.programme_id,
        "semester": req.semester,
        "section": req.section,
        "department_id": req.department_id,
        "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        "schedule": req.schedule,
        "updated_at": datetime.datetime.now().isoformat()
    }
    
    config = db.query(PolicyConfig).filter(PolicyConfig.key == key).first()
    if not config:
        config = PolicyConfig(
            key=key,
            scope=f"programme_{req.programme_id}",
            value=json.dumps(payload)
        )
        db.add(config)
    else:
        config.value = json.dumps(payload)
    db.commit()

    return {
        "success": True,
        "message": "Weekly timetable saved successfully."
    }

@router.post("/timetable/swap-slots")
def swap_timetable_slots(
    req: SwapSlotsRequest,
    db: Session = Depends(get_db)
):
    """
    Swaps two classes in the weekly timetable.
    """
    key = f"timetable_weekly_{req.programme_id}_sem_{req.semester}_{req.section}"
    config = db.query(PolicyConfig).filter(PolicyConfig.key == key).first()
    if not config:
        raise HTTPException(status_code=404, detail="Timetable not found for this semester.")
        
    try:
        data = json.loads(config.value)
        schedule = data.get("schedule", [])
        
        idx_a = next((i for i, s in enumerate(schedule) if s.get("id") == req.slot_a_id), None)
        idx_b = next((i for i, s in enumerate(schedule) if s.get("id") == req.slot_b_id), None)
        
        if idx_a is None or idx_b is None:
            raise HTTPException(status_code=400, detail="One or both slots not found in timetable.")
            
        slot_a = schedule[idx_a]
        slot_b = schedule[idx_b]
        
        # Swap subject, course_name, faculty, room, is_lab
        fields_to_swap = ["course_code", "course_name", "course_short", "category", "course_type", "room", "faculty_name", "is_lab"]
        for f in fields_to_swap:
            slot_a[f], slot_b[f] = slot_b.get(f), slot_a.get(f)
            
        data["schedule"] = schedule
        config.value = json.dumps(data)
        db.commit()
        
        return {
            "success": True,
            "message": f"Successfully swapped classes between {slot_a.get('day')} Period {slot_a.get('period')} and {slot_b.get('day')} Period {slot_b.get('period')}",
            "schedule": schedule
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


