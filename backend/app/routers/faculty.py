from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.connection import get_db
from app.models.domain import User, FacultyProfile, Department, RoleEnum
from app.auth.dependencies import get_current_user

router = APIRouter()

@router.get("/hod")
def get_hod_faculty_list(
    semester_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return faculty list for HOD dashboard with aggregated statuses."""
    if current_user.role not in [RoleEnum.HOD, RoleEnum.ERP_COORDINATOR]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    query = db.query(FacultyProfile).join(User).filter(User.department_id == current_user.department_id)
    # Order by designation/seniority (mocked via string for now, could use a proper mapping)
    # The prompt explicitly asks to order by seniority.
    profiles = query.all()
    
    # Sort profiles (Professor > Associate > Assistant)
    def get_rank(desig: str):
        d = desig.lower()
        if "associate" in d: return 2
        if "assistant" in d: return 3
        if "professor" in d: return 1
        return 4
        
    profiles.sort(key=lambda p: (get_rank(p.designation), p.name))
    
    result = []
    from app.models.domain import (
        PreferenceSubmission, AllocationComponent, AllocationStatusEnum,
        PreferenceStatusEnum, AcademicWorkspace, Semester, SubjectAllocation
    )
    
    dept = db.query(Department).filter(Department.id == current_user.department_id).first()
    inst_name = dept.institution.name if dept and dept.institution else ""
    dept_name = dept.name if dept else ""
    
    for p in profiles:
        sub_query = db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id == p.id)
        alloc_query = db.query(AllocationComponent).filter(AllocationComponent.faculty_id == p.id)
        
        if semester_type:
            target_st = semester_type.upper()
            sub_query = sub_query.join(
                AcademicWorkspace, PreferenceSubmission.workspace_id == AcademicWorkspace.id
            ).join(
                Semester, AcademicWorkspace.semester_id == Semester.id
            )
            if target_st == "ODD":
                sub_query = sub_query.filter(Semester.semester_number.in_([1, 3, 5]))
            elif target_st == "EVEN":
                sub_query = sub_query.filter(Semester.semester_number.in_([2, 4, 6]))
                
            alloc_query = alloc_query.join(
                SubjectAllocation, AllocationComponent.allocation_id == SubjectAllocation.id
            ).join(
                AcademicWorkspace, SubjectAllocation.workspace_id == AcademicWorkspace.id
            ).join(
                Semester, AcademicWorkspace.semester_id == Semester.id
            )
            if target_st == "ODD":
                alloc_query = alloc_query.filter(Semester.semester_number.in_([1, 3, 5]))
            elif target_st == "EVEN":
                alloc_query = alloc_query.filter(Semester.semester_number.in_([2, 4, 6]))
                
        subs = sub_query.all()
        allocs = alloc_query.all()
        
        pref_status = "Not Submitted"
        has_approval = any(
            s.status == PreferenceStatusEnum.APPROVED or
            any(it.decision == PreferenceStatusEnum.APPROVED for it in s.items)
            for s in subs
        )
        has_submitted = any(
            s.status in [PreferenceStatusEnum.SUBMITTED, PreferenceStatusEnum.APPROVED]
            for s in subs
        )
        
        if has_approval:
            pref_status = "Approved by HOD"
        elif has_submitted:
            pref_status = "Submitted"
            
        alloc_status = "Not Allocated"
        if allocs:
            alloc_status = "Allocated"
            
        result.append({
            "faculty_id": p.id,
            "name": p.name,
            "erp_id": p.erp_id,
            "designation": p.designation,
            "department": dept_name,
            "institution": inst_name,
            "preference_status": pref_status,
            "allocation_status": alloc_status
        })
    return result

@router.get("")
def get_faculty_list(
    department_id: Optional[int] = Query(None),
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return faculty profiles, optionally filtered by department_id."""
    query = db.query(FacultyProfile).join(User, FacultyProfile.user_id == User.id)

    if department_id:
        query = query.filter(User.department_id == department_id)
    else:
        # Default: same dept as requester
        query = query.filter(User.department_id == current_user.department_id)

    profiles = query.all()
    result = []
    
    from app.models.domain import FacultyCycleState
    cycle_states = {}
    if workspace_id:
        states = db.query(FacultyCycleState).filter(FacultyCycleState.workspace_id == workspace_id).all()
        cycle_states = {s.faculty_id: s.state for s in states}

    for p in profiles:
        result.append({
            "id": p.id,
            "name": p.name,
            "erp_id": p.erp_id,
            "designation": p.designation,
            "user_id": p.user_id,
            "cycle_state": cycle_states.get(p.id, "PENDING")
        })
    return result

@router.post("/{faculty_id}/cycle-state")
def update_faculty_cycle_state(
    faculty_id: int,
    workspace_id: str,
    state: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.domain import FacultyCycleState
    cycle_state = db.query(FacultyCycleState).filter(
        FacultyCycleState.workspace_id == workspace_id,
        FacultyCycleState.faculty_id == faculty_id
    ).first()
    
    if cycle_state:
        cycle_state.state = state
        cycle_state.reason = reason
    else:
        cycle_state = FacultyCycleState(
            workspace_id=workspace_id,
            faculty_id=faculty_id,
            state=state,
            reason=reason
        )
        db.add(cycle_state)
    db.commit()
    return {"message": "State updated"}

@router.get("/detail/{faculty_id}")
def get_faculty_detail(
    faculty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return a single faculty's profile, their submitted preferences, existing allocations, and hour cap."""
    from app.models.domain import (
        PreferenceSubmission, PreferenceItem, Subject, CurriculumOffering,
        Programme, PolicyConfig, SubjectAllocation, AllocationComponent
    )
    
    fp = db.query(FacultyProfile).filter(FacultyProfile.id == faculty_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Authorization: must be in same department
    fac_user = db.query(User).filter(User.id == fp.user_id).first()
    if not fac_user or fac_user.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this faculty")
    
    # Get hour cap based on designation
    hour_cap = 16  # default
    desig = fp.designation.lower()
    if "professor" in desig and "associate" not in desig and "assistant" not in desig:
        cap_config = db.query(PolicyConfig).filter(PolicyConfig.key == "max_professor").first()
        hour_cap = int(cap_config.value) if cap_config else 12
    elif "associate" in desig:
        cap_config = db.query(PolicyConfig).filter(PolicyConfig.key == "max_associate").first()
        hour_cap = int(cap_config.value) if cap_config else 14
    elif "assistant" in desig:
        cap_config = db.query(PolicyConfig).filter(PolicyConfig.key == "max_assistant").first()
        hour_cap = int(cap_config.value) if cap_config else 16
    
    # Get all submissions for this faculty
    submissions = db.query(PreferenceSubmission).filter(
        PreferenceSubmission.faculty_id == faculty_id
    ).all()
    
    prefs = []
    for sub in submissions:
        for item in sub.items:
            subj = item.subject
            # Get offering info (programme name / class type)
            offering = db.query(CurriculumOffering).filter(
                CurriculumOffering.subject_id == subj.id
            ).first()
            prog_name = ""
            semester = 0
            if offering:
                prog = db.query(Programme).filter(Programme.id == offering.programme_id).first()
                prog_name = prog.name if prog else ""
                semester = offering.semester

            sem_type = "ODD" if semester % 2 != 0 else "EVEN"
            if offering and getattr(offering, "semester_type", None):
                val = offering.semester_type
                sem_type = val.value if hasattr(val, "value") else str(val)
            
            prefs.append({
                "id": item.id,
                "subject_id": subj.id,
                "subject_name": subj.course_name,
                "subject_code": subj.course_code,
                "class_type": prog_name,
                "course_type": subj.category,
                "semester": semester,
                "semester_type": sem_type,
                "theory_hours": subj.theory_hours,
                "practical_hours": subj.practical_hours,
                "decision": item.decision.value if item.decision else "PENDING",
                "workspace_id": sub.workspace_id,
            })
            
    # Collect sections for these workspaces
    workspace_ids = list(set([p["workspace_id"] for p in prefs]))
    sections_by_workspace = {}
    if workspace_ids:
        from app.models.domain import Section
        sections_in_db = db.query(Section).filter(Section.workspace_id.in_(workspace_ids)).all()
        for sec in sections_in_db:
            if sec.workspace_id not in sections_by_workspace:
                sections_by_workspace[sec.workspace_id] = []
            sections_by_workspace[sec.workspace_id].append(sec.name)
            
    for p in prefs:
        p["sections"] = sections_by_workspace.get(p["workspace_id"], ["A"]) # default to A if none
    
    # Get allocations
    allocations = []
    components = db.query(AllocationComponent).filter(AllocationComponent.faculty_id == faculty_id).all()
    for comp in components:
        sa = comp.allocation
        if not sa: continue
        allocations.append({
            "subject_id": sa.subject_id,
            "section": sa.section.name if sa.section else "",
            "role": comp.role.value,
            "theory_hours": comp.theory_hours,
            "lab_hours": comp.practical_hours,
            "total_hours": comp.theory_hours + comp.practical_hours,
            "approval": "APPROVED"
        })
            
    return {
        "faculty": {
            "id": fp.id,
            "name": fp.name,
            "erp_id": fp.erp_id,
            "designation": fp.designation,
        },
        "preferences": prefs,
        "hour_cap": hour_cap,
        "allocations": allocations,
    }

@router.post("/{faculty_id}/allocations")
def save_faculty_allocations(
    faculty_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save HOD allocation decisions for a faculty member."""
    from app.models.domain import (
        PreferenceItem, PreferenceSubmission, PreferenceStatusEnum,
        SubjectAllocation, AllocationComponent, Section, AllocationRoleEnum, AllocationStatusEnum,
        FacultyProfile, PolicyConfig
    )
    
    if current_user.role not in [RoleEnum.HOD, RoleEnum.ERP_COORDINATOR]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    fp = db.query(FacultyProfile).filter(FacultyProfile.id == faculty_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Faculty not found")
        
    hour_cap = 16
    desig = fp.designation.lower()
    if "professor" in desig and "associate" not in desig and "assistant" not in desig:
        cap_config = db.query(PolicyConfig).filter(PolicyConfig.key == "max_professor").first()
        hour_cap = int(cap_config.value) if cap_config else 12
    elif "associate" in desig:
        cap_config = db.query(PolicyConfig).filter(PolicyConfig.key == "max_associate").first()
        hour_cap = int(cap_config.value) if cap_config else 14
    elif "assistant" in desig:
        cap_config = db.query(PolicyConfig).filter(PolicyConfig.key == "max_assistant").first()
        hour_cap = int(cap_config.value) if cap_config else 16
        
    allocations = payload.get("allocations", [])
    
    total_requested_hours = sum([int(a.get("theory_hours", 0)) + int(a.get("lab_hours", 0)) for a in allocations if a.get("approval") == "APPROVED"])
    if total_requested_hours > hour_cap:
        raise HTTPException(status_code=400, detail=f"Total hours ({total_requested_hours}) exceed faculty cap ({hour_cap}).")

    
    for alloc in allocations:
        subject_id = alloc.get("subject_id")
        approval = alloc.get("approval", "PENDING")
        section_name = alloc.get("section")
        role_str = alloc.get("role", "Incharge-1")
        theory_hours = int(alloc.get("theory_hours", 0))
        lab_hours = int(alloc.get("lab_hours", 0))
        
        # Enforce hour bounds
        if theory_hours < 0 or theory_hours > 10:
            raise HTTPException(status_code=400, detail=f"Theory hours must be between 0 and 10 for subject {subject_id}.")
        if lab_hours < 0 or lab_hours > 10:
            raise HTTPException(status_code=400, detail=f"Practical hours must be between 0 and 10 for subject {subject_id}.")
        if approval == "APPROVED" and (theory_hours + lab_hours) == 0:
            raise HTTPException(status_code=400, detail=f"Total allocated hours must be greater than 0 for subject {subject_id}.")
            
        # Update preference item decision
        items = db.query(PreferenceItem).join(PreferenceSubmission).filter(
            PreferenceSubmission.faculty_id == faculty_id,
            PreferenceItem.subject_id == subject_id
        ).all()
        
        workspace_id = None
        for item in items:
            workspace_id = item.submission.workspace_id
            if approval == "APPROVED":
                item.decision = PreferenceStatusEnum.APPROVED
            elif approval == "REJECTED":
                item.decision = PreferenceStatusEnum.DENIED
            else:
                item.decision = PreferenceStatusEnum.PENDING
        
        if approval == "APPROVED" and workspace_id:
            if not section_name:
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Section is required for subject {subject_id}.")
                
            # Find the actual section for this workspace
            section = db.query(Section).filter(
                Section.workspace_id == workspace_id, 
                Section.name == section_name
            ).first()
            if not section:
                # Fallback to create section if for some reason it wasn't seeded (safeguard)
                section = Section(workspace_id=workspace_id, name=section_name)
                db.add(section)
                db.flush()
                
            # Check exclusivity: is this subject + section already allocated to someone else in this workspace?
            existing_allocation = db.query(SubjectAllocation).join(AllocationComponent).filter(
                SubjectAllocation.workspace_id == workspace_id,
                SubjectAllocation.subject_id == subject_id,
                SubjectAllocation.section_id == section.id,
                AllocationComponent.faculty_id != faculty_id
            ).first()
            
            if existing_allocation:
                db.rollback()
                raise HTTPException(status_code=400, detail=f"Subject {subject_id} in section {section_name} is already allocated to another faculty member.")
                
            # Upsert allocation
            sa = db.query(SubjectAllocation).join(AllocationComponent).filter(
                AllocationComponent.faculty_id == faculty_id,
                SubjectAllocation.subject_id == subject_id,
                SubjectAllocation.workspace_id == workspace_id
            ).first()
            
            if not sa:
                sa = SubjectAllocation(
                    workspace_id=workspace_id,
                    subject_id=subject_id,
                    section_id=section.id,
                    status=AllocationStatusEnum.ALLOCATED
                )
                db.add(sa)
                db.flush()
            else:
                sa.section_id = section.id
                
            # Upsert component
            db.query(AllocationComponent).filter(AllocationComponent.allocation_id == sa.id).delete()
            
            role_enum = AllocationRoleEnum.INCHARGE_1 if role_str == "Incharge-1" else AllocationRoleEnum.INCHARGE_2
            comp = AllocationComponent(
                allocation_id=sa.id,
                faculty_id=faculty_id,
                role=role_enum,
                theory_hours=theory_hours,
                practical_hours=lab_hours
            )
            db.add(comp)
        
        elif approval in ["REJECTED", "PENDING"] and workspace_id:
            # Delete allocation if it exists
            sa = db.query(SubjectAllocation).join(AllocationComponent).filter(
                AllocationComponent.faculty_id == faculty_id,
                SubjectAllocation.subject_id == subject_id,
                SubjectAllocation.workspace_id == workspace_id
            ).first()
            if sa:
                db.query(AllocationComponent).filter(AllocationComponent.allocation_id == sa.id).delete()
                db.delete(sa)
    
    # Keep parent submission status synchronized with decisions
    faculty_subs = db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id == faculty_id).all()
    for s in faculty_subs:
        if s.items:
            decisions = [it.decision for it in s.items]
            if any(d == PreferenceStatusEnum.APPROVED for d in decisions):
                s.status = PreferenceStatusEnum.APPROVED
                s.review_status = PreferenceStatusEnum.APPROVED
            elif all(d == PreferenceStatusEnum.DENIED for d in decisions):
                s.review_status = PreferenceStatusEnum.DENIED
            elif any(d == PreferenceStatusEnum.PENDING for d in decisions):
                s.review_status = PreferenceStatusEnum.PENDING
    
    db.commit()
    return {"message": "Allocations saved successfully"}

