from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.connection import get_db
from app.models.domain import User, FacultyProfile, Department, RoleEnum
from app.auth.dependencies import get_current_user, require_role

router = APIRouter()

@router.get("/hod")
def get_hod_faculty_list(
    semester_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Return faculty list for HOD dashboard with aggregated statuses."""
        
    query = db.query(FacultyProfile).join(User).filter(User.department_id == current_user.department_id)
    # Order by seniority_index, then name
    query = query.order_by(FacultyProfile.seniority_index, FacultyProfile.name)
    profiles = query.all()
    
    result = []
    from app.models.domain import (
        PreferenceSubmission, AllocationComponent, AllocationStatusEnum,
        PreferenceStatusEnum, AcademicWorkspace, Semester, SubjectAllocation, PolicyConfig
    )
    
    dept = db.query(Department).filter(Department.id == current_user.department_id).first()
    inst_name = dept.institution.name if dept and dept.institution else ""
    dept_name = dept.name if dept else ""
    
    # Calculate expected number of semesters for this department and semester type ONCE
    expected_semesters = 1
    if semester_type:
        target_st = semester_type.upper()
        from app.models.domain import CurriculumOffering, Programme
        # Find all distinct semesters for this department's programmes
        progs = db.query(Programme).filter(Programme.department_id == current_user.department_id).all()
        prog_ids = [pr.id for pr in progs]
        
        if prog_ids:
            offerings = db.query(CurriculumOffering).filter(CurriculumOffering.programme_id.in_(prog_ids))
            if target_st == "ODD":
                offerings = offerings.filter(CurriculumOffering.semester % 2 != 0)
            elif target_st == "EVEN":
                offerings = offerings.filter(CurriculumOffering.semester % 2 == 0)
            
            distinct_sems = set(o.semester for o in offerings.all())
            expected_semesters = len(distinct_sems) if distinct_sems else 1

    # Bulk fetch submissions and allocations for all profiles
    profile_ids = [p.id for p in profiles]
    
    sub_query = db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id.in_(profile_ids))
    alloc_query = db.query(AllocationComponent).filter(AllocationComponent.faculty_id.in_(profile_ids))
    
    if semester_type:
        target_st = semester_type.upper()
        sub_query = sub_query.join(
            AcademicWorkspace, PreferenceSubmission.workspace_id == AcademicWorkspace.id
        ).join(
            Semester, AcademicWorkspace.semester_id == Semester.id
        )
        if target_st == "ODD":
            sub_query = sub_query.filter(Semester.semester_number % 2 != 0)
        elif target_st == "EVEN":
            sub_query = sub_query.filter(Semester.semester_number % 2 == 0)
            
        alloc_query = alloc_query.join(
            SubjectAllocation, AllocationComponent.allocation_id == SubjectAllocation.id
        ).join(
            AcademicWorkspace, SubjectAllocation.workspace_id == AcademicWorkspace.id
        ).join(
            Semester, AcademicWorkspace.semester_id == Semester.id
        )
        if target_st == "ODD":
            alloc_query = alloc_query.filter(Semester.semester_number % 2 != 0)
        elif target_st == "EVEN":
            alloc_query = alloc_query.filter(Semester.semester_number % 2 == 0)
            
    all_subs = sub_query.all()
    all_allocs = alloc_query.all()
    
    # Group by faculty_id
    from collections import defaultdict
    subs_by_faculty = defaultdict(list)
    for s in all_subs:
        subs_by_faculty[s.faculty_id].append(s)
        
    allocs_by_faculty = defaultdict(list)
    for a in all_allocs:
        allocs_by_faculty[a.faculty_id].append(a)
        
    # Pre-fetch faculty programme scopes
    from app.models.domain import FacultyProgrammeScope, CurriculumOffering, SemesterTypeEnum
    all_scopes = db.query(FacultyProgrammeScope).filter(FacultyProgrammeScope.faculty_id.in_(profile_ids)).all()
    scopes_by_faculty = defaultdict(list)
    for sc in all_scopes:
        scopes_by_faculty[sc.faculty_id].append(sc.programme_id)

    # Department programmes fallback
    dept_progs = db.query(Programme).filter(Programme.department_id == current_user.department_id).all()
    dept_prog_ids = [pr.id for pr in dept_progs]

    target_sem_type_enum = None
    if semester_type:
        try:
            target_sem_type_enum = SemesterTypeEnum(semester_type.upper())
        except ValueError:
            pass

    for p in profiles:
        subs = subs_by_faculty.get(p.id, [])
        allocs = allocs_by_faculty.get(p.id, [])
        
        pref_status = "Not Submitted"
        
        fac_prog_ids = scopes_by_faculty.get(p.id) or dept_prog_ids
        # Find applicable (semester, programme) contexts for this faculty that require preference
        applicable_contexts = set()
        if target_sem_type_enum and fac_prog_ids:
            off_query = db.query(CurriculumOffering).filter(
                CurriculumOffering.programme_id.in_(fac_prog_ids),
                CurriculumOffering.semester_type == target_sem_type_enum,
                CurriculumOffering.requires_preference == True
            ).all()
            for o in off_query:
                applicable_contexts.add((o.semester, o.programme_id))
        
        submitted_contexts = set()
        for s in subs:
            if s.status in [PreferenceStatusEnum.SUBMITTED, PreferenceStatusEnum.APPROVED]:
                if s.workspace and s.workspace.semester:
                    submitted_contexts.add((s.workspace.semester.semester_number, s.workspace.programme_id))
                
        has_approval = any(
            s.status == PreferenceStatusEnum.APPROVED or
            any(it.decision == PreferenceStatusEnum.APPROVED for it in s.items)
            for s in subs
        )
        
        if applicable_contexts:
            has_submitted_all = applicable_contexts.issubset(submitted_contexts)
            has_submitted_any = len(submitted_contexts.intersection(applicable_contexts)) > 0
        else:
            has_submitted_all = len(submitted_contexts) > 0
            has_submitted_any = len(submitted_contexts) > 0
        
        if has_approval:
            pref_status = "Approved by HOD"
        elif has_submitted_all:
            pref_status = "Submitted"
        elif has_submitted_any:
            pref_status = "Partially Submitted"
            
        alloc_status = "Not Allocated"
        if allocs:
            total_alloc_hours = sum([c.theory_hours + c.practical_hours for c in allocs])
            
            from app.services.faculty_service import FacultyService
            fs = FacultyService()
            hour_cap = fs.get_faculty_target_workload(db, p)
                
            if total_alloc_hours >= hour_cap:
                alloc_status = "Allocated"
            else:
                alloc_status = "Partially Allocated"
            
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
    semester_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return a single faculty's profile, their submitted preferences, existing allocations, and hour cap."""
    from app.models.domain import (
        PreferenceSubmission, PreferenceItem, Subject, CurriculumOffering,
        Programme, PolicyConfig, SubjectAllocation, AllocationComponent,
        AcademicWorkspace, Semester
    )
    
    fp = db.query(FacultyProfile).filter(FacultyProfile.id == faculty_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Faculty not found")
    
    # Authorization: must be in same department
    fac_user = db.query(User).filter(User.id == fp.user_id).first()
    if not fac_user or fac_user.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this faculty")
    
    # Get hour cap based on designation / explicit target
    from app.services.faculty_service import FacultyService
    fac_service = FacultyService()
    hour_cap = fac_service.get_faculty_target_workload(db, fp)
    
    # Get all submissions for this faculty
    sub_query = db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id == faculty_id)
    if semester_type:
        target_st = semester_type.upper()
        sub_query = sub_query.join(
            AcademicWorkspace, PreferenceSubmission.workspace_id == AcademicWorkspace.id
        ).join(
            Semester, AcademicWorkspace.semester_id == Semester.id
        )
        if target_st == "ODD":
            sub_query = sub_query.filter(Semester.semester_number % 2 != 0)
        elif target_st == "EVEN":
            sub_query = sub_query.filter(Semester.semester_number % 2 == 0)
            
    submissions = sub_query.all()
    
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
    comp_query = db.query(AllocationComponent).filter(AllocationComponent.faculty_id == faculty_id)
    if semester_type:
        target_st = semester_type.upper()
        comp_query = comp_query.join(
            SubjectAllocation, AllocationComponent.allocation_id == SubjectAllocation.id
        ).join(
            AcademicWorkspace, SubjectAllocation.workspace_id == AcademicWorkspace.id
        ).join(
            Semester, AcademicWorkspace.semester_id == Semester.id
        )
        if target_st == "ODD":
            comp_query = comp_query.filter(Semester.semester_number % 2 != 0)
        elif target_st == "EVEN":
            comp_query = comp_query.filter(Semester.semester_number % 2 == 0)
            
    components = comp_query.all()
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
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    """Save HOD allocation decisions for a faculty member."""
    from app.models.domain import (
        PreferenceItem, PreferenceSubmission, PreferenceStatusEnum,
        SubjectAllocation, AllocationComponent, Section, AllocationRoleEnum, AllocationStatusEnum,
        FacultyProfile, PolicyConfig
    )
        
    fp = db.query(FacultyProfile).filter(FacultyProfile.id == faculty_id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Faculty not found")
        
    from app.services.faculty_service import FacultyService
    faculty_service = FacultyService()
    hour_cap = faculty_service.get_faculty_target_workload(db, fp)
        
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
            
        from app.models.domain import Subject
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if subject and (subject.practical_hours is None or subject.practical_hours == 0) and lab_hours > 0:
            raise HTTPException(status_code=400, detail=f"Subject {subject.course_code} is theory-only. Lab hours cannot be assigned.")
            
        if approval == "APPROVED" and (theory_hours + lab_hours) == 0:
            raise HTTPException(status_code=400, detail=f"Total allocated hours must be greater than 0 for subject {subject_id}.")
            
        # Update preference item decision
        items = db.query(PreferenceItem).join(PreferenceSubmission).filter(
            PreferenceSubmission.faculty_id == faculty_id,
            PreferenceItem.subject_id == subject_id
        ).all()
        
        workspace_id = alloc.get("workspace_id")
        for item in items:
            workspace_id = item.submission.workspace_id
            
        if not workspace_id:
            # Fallback: look up workspace for this subject via CurriculumOffering and AcademicWorkspace
            from app.models.domain import CurriculumOffering, AcademicWorkspace
            offering = db.query(CurriculumOffering).filter(CurriculumOffering.subject_id == subject_id).first()
            if offering:
                ws = db.query(AcademicWorkspace).filter(
                    AcademicWorkspace.programme_id == offering.programme_id,
                    AcademicWorkspace.academic_year_id == offering.academic_year_id
                ).first()
                if ws:
                    workspace_id = ws.id
        
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
                
            # Check exclusivity: is this (workspace_id, section_id, subject_id) already allocated to someone else?
            existing_sa = db.query(SubjectAllocation).filter(
                SubjectAllocation.workspace_id == workspace_id,
                SubjectAllocation.subject_id == subject_id,
                SubjectAllocation.section_id == section.id,
            ).first()
            
            if existing_sa:
                for comp in existing_sa.components:
                    if comp.faculty_id != faculty_id:
                        other_fac_name = comp.faculty.name if comp.faculty else f"Faculty #{comp.faculty_id}"
                        subj_code = subject.course_code if subject else f"ID {subject_id}"
                        db.rollback()
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Subject {subj_code} in Section {section_name} is already allocated to {other_fac_name}."
                        )

            # Check if this faculty was previously allocated to this subject in a DIFFERENT section or allocation in this workspace
            prev_allocations = db.query(SubjectAllocation).join(AllocationComponent).filter(
                AllocationComponent.faculty_id == faculty_id,
                SubjectAllocation.subject_id == subject_id,
                SubjectAllocation.workspace_id == workspace_id
            ).all()

            for prev_sa in prev_allocations:
                if not existing_sa or prev_sa.id != existing_sa.id:
                    # Clean up the previous section's allocation for this faculty
                    db.query(AllocationComponent).filter(AllocationComponent.allocation_id == prev_sa.id).delete()
                    db.delete(prev_sa)
                    db.flush()

            # Upsert canonical SubjectAllocation for (workspace_id, section.id, subject_id)
            sa = db.query(SubjectAllocation).filter(
                SubjectAllocation.workspace_id == workspace_id,
                SubjectAllocation.subject_id == subject_id,
                SubjectAllocation.section_id == section.id
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
                sa.status = AllocationStatusEnum.ALLOCATED

            # Delete any existing components on this SubjectAllocation before inserting the fresh one
            db.query(AllocationComponent).filter(AllocationComponent.allocation_id == sa.id).delete()
            db.flush()

            role_enum = AllocationRoleEnum.INCHARGE_1 if role_str == "Incharge-1" else AllocationRoleEnum.INCHARGE_2
            comp = AllocationComponent(
                allocation_id=sa.id,
                faculty_id=faculty_id,
                role=role_enum,
                theory_hours=theory_hours,
                practical_hours=lab_hours
            )
            db.add(comp)
            db.flush()
        
        elif approval in ["REJECTED", "PENDING"] and workspace_id:
            # Delete allocation if it exists for this faculty and subject
            sas = db.query(SubjectAllocation).join(AllocationComponent).filter(
                AllocationComponent.faculty_id == faculty_id,
                SubjectAllocation.subject_id == subject_id,
                SubjectAllocation.workspace_id == workspace_id
            ).all()
            for sa in sas:
                db.query(AllocationComponent).filter(AllocationComponent.allocation_id == sa.id).delete()
                db.delete(sa)
            db.flush()
    
    db.commit()
    return {"message": "Allocations saved successfully"}

