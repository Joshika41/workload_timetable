from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from collections import defaultdict
from app.database.connection import get_db
from app.models.domain import (
    User, RoleEnum, AcademicWorkspace, WorkspaceWorkflowStateEnum,
    Subject, PreferenceSubmission, PreferenceStatusEnum
)
from app.auth.dependencies import require_role, get_current_user
from app.schemas.preferences import (
    PreferenceSubmitRequest, PreferenceSubmissionResponse,
    PreferenceDecisionRequest, SubmissionReviewRequest,
    TermPreferenceSubmitRequest
)
from app.services.preference_service import PreferenceService
from app.auth.workspace_auth import verify_workspace_access
from app.core.workspace import WorkspaceContext, decode_workspace_id

router = APIRouter()
pref_service = PreferenceService()

def _serialize_submission(s) -> dict:
    items = []
    for i in s.items:
        items.append({
            "id": i.id,
            "subject_id": i.subject_id,
            "subject_code": i.subject.course_code,
            "subject_name": i.subject.course_name,
            "category": i.subject.category,
            "rank": i.rank,
            "decision": i.decision.value,
        })
    return {
        "id": s.id,
        "faculty_id": s.faculty_id,
        "faculty_name": s.faculty.name,
        "workspace_id": s.workspace_id,
        "status": s.status.value,
        "review_status": s.review_status.value if hasattr(s, "review_status") and s.review_status else "PENDING",
        "submitted_at": s.submitted_at,
        "items": sorted(items, key=lambda x: x["rank"]),
    }

# ── Faculty: GET my preferences
@router.get("/faculty/preferences", response_model=List[PreferenceSubmissionResponse])
def get_my_preferences(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value])),
    workspace: WorkspaceContext = Depends(verify_workspace_access)
):
    submissions = pref_service.get_my_preferences(db, current_user, workspace_id)
    return [_serialize_submission(s) for s in submissions]

# ── Faculty: POST submit preferences (Legacy/Single workspace route adapted to save draft)
@router.post("/faculty/preferences")
def submit_preferences(
    req: PreferenceSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value]))
):
    try:
        context = decode_workspace_id(req.workspace_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace ID")

    if current_user.department_id != context.department_id:
        raise HTTPException(status_code=403, detail="Not authorized for this workspace")

    # Check finalization lock
    workspace = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == req.workspace_id).first()
    if workspace and workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="This workspace is finalized. Preferences cannot be modified."
        )

    # Save as DRAFT so single workspace submissions cannot bypass the full semester-type completeness rule
    sub = pref_service.save_draft_preferences(db, current_user, req, context)
    return {"message": "Preferences saved as draft. Please submit all applicable semesters together.", "id": sub.id, "status": "DRAFT"}


# ── HOD/Coordinator: GET all preferences for workspace
@router.get("/coordinator/preferences", response_model=List[PreferenceSubmissionResponse])
def get_all_preferences(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value])),
    workspace: WorkspaceContext = Depends(verify_workspace_access)
):
    submissions = pref_service.get_all_preferences(db, current_user, workspace_id)
    return [_serialize_submission(s) for s in submissions]

# ── HOD: PATCH review a whole submission (approve/pending/deny the submission)
@router.patch("/coordinator/preferences/submissions/{submission_id}/review")
def review_submission(
    submission_id: int,
    req: SubmissionReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    submission = db.query(PreferenceSubmission).filter(PreferenceSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Authorization: verify department
    if submission.faculty.user.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check finalization lock
    workspace = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == submission.workspace_id).first()
    if workspace and workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="This workspace is finalized. Review decisions cannot be modified."
        )

    try:
        review_enum = PreferenceStatusEnum(req.review_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid review status")

    if review_enum not in [PreferenceStatusEnum.APPROVED, PreferenceStatusEnum.PENDING, PreferenceStatusEnum.DENIED]:
        raise HTTPException(status_code=400, detail="Review status must be APPROVED, PENDING, or DENIED")

    submission.review_status = review_enum
    db.commit()
    return {"message": "Review updated", "review_status": review_enum.value}

# ── HOD: PATCH item-level decision (kept for backward compatibility)
@router.patch("/coordinator/preferences/{item_id}")
def decide_preference(
    item_id: int,
    req: PreferenceDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.HOD.value, RoleEnum.ERP_COORDINATOR.value]))
):
    pref_service.decide_preference(db, item_id, req.decision)
    return {"message": "Decision updated successfully"}

# ── Faculty: GET my-semesters (returns subjects grouped by semester)
@router.get("/faculty/my-semesters")
def get_faculty_semesters(
    semester_type: str,
    programme_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value]))
):
    """Returns subjects grouped by semester for the faculty's department."""
    from app.models.domain import CurriculumOffering, Programme, Department
    from collections import defaultdict
    
    dept = db.query(Department).filter(Department.id == current_user.department_id).first()
    if not dept:
        return []
    
    # Find programmes in this department
    prog_query = db.query(Programme).filter(Programme.department_id == dept.id)
    
    # Restrict to programmes mapped in FacultyProgrammeScope
    from app.models.domain import FacultyProfile, FacultyProgrammeScope
    fp = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
    if fp:
        mapped_prog_ids = [s.programme_id for s in db.query(FacultyProgrammeScope).filter(FacultyProgrammeScope.faculty_id == fp.id).all()]
        if mapped_prog_ids:
            prog_query = prog_query.filter(Programme.id.in_(mapped_prog_ids))

    if programme_type:
        prog_query = prog_query.filter(Programme.programme_type == programme_type)
    programmes = prog_query.all()
    prog_ids = [p.id for p in programmes]
    prog_map = {p.id: p.name for p in programmes}
    
    if not prog_ids:
        return []
    
    # Get offerings matching semester type and department programmes
    from app.models.domain import SemesterTypeEnum
    try:
        sem_enum = SemesterTypeEnum(semester_type)
    except ValueError:
        return []
    
    offerings = db.query(CurriculumOffering).options(
        joinedload(CurriculumOffering.subject)
    ).filter(
        CurriculumOffering.programme_id.in_(prog_ids),
        CurriculumOffering.semester_type == sem_enum
    ).all()
    
    # Group by (semester, programme)
    grouped = defaultdict(list)
    group_req_pref = defaultdict(lambda: False)
    seen = set()
    for off in offerings:
        # Include programme_id in the uniqueness key so a subject can exist in multiple programmes if needed
        key = (off.semester, off.programme_id, off.subject_id)
        if key in seen:
            continue
        seen.add(key)
        
        subj = off.subject
        group_key = (off.semester, off.programme_id)
        if off.requires_preference:
            group_req_pref[group_key] = True

        is_optional = subj.category.upper() in ('MINOR', 'MULTIDISCIPLINARY')
        grouped[group_key].append({
            "id": subj.id,
            "course_code": subj.course_code,
            "course_name": subj.course_name,
            "category": subj.category,
            "theory_hours": subj.theory_hours or 0,
            "practical_hours": subj.practical_hours or 0,
            "credits": subj.credits or 0,
            "class_type": prog_map.get(off.programme_id, ""),
            "is_optional": is_optional,
            "requires_preference": off.requires_preference if off.requires_preference is not None else True,
        })
    
    from app.models.domain import AcademicWorkspace, PreferenceSubmission, PreferenceItem, FacultyProfile, Semester, AcademicYear, WorkspaceWorkflowStateEnum
    
    fp = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
    ay = db.query(AcademicYear).first()

    # Pre-fetch ALL semesters in one query (eliminates N+1)
    all_sems = db.query(Semester).all()
    sem_by_number = {s.semester_number: s for s in all_sems}

    # Pre-fetch ALL preference submissions for this faculty in one query
    submission_map = {}  # (prog_id, sem_id) -> PreferenceSubmission
    if fp and ay:
        submissions = db.query(PreferenceSubmission).options(
            joinedload(PreferenceSubmission.workspace)
        ).join(
            AcademicWorkspace, PreferenceSubmission.workspace_id == AcademicWorkspace.id
        ).filter(
            PreferenceSubmission.faculty_id == fp.id
        ).all()
        for subm in submissions:
            ws = subm.workspace
            if ws:
                submission_map[(ws.programme_id, ws.semester_id)] = subm

    # Pre-fetch all preference items for found submissions in one query
    sub_ids = [s.id for s in submission_map.values()]
    items_map = {}  # submission_id -> [subject_id, ...]
    if sub_ids:
        all_items = db.query(PreferenceItem).filter(PreferenceItem.submission_id.in_(sub_ids)).all()
        for it in all_items:
            items_map.setdefault(it.submission_id, []).append(it.subject_id)

    result = []
    for (sem_num, prog_id) in sorted(grouped.keys()):
        prog_name = prog_map.get(prog_id, "")
        
        is_sub = False
        sub_status = "PENDING"
        sel_subs = []
        is_fin = False
        
        sem = sem_by_number.get(sem_num)
        if sem and ay and fp:
            subm = submission_map.get((prog_id, sem.id))
            if subm:
                sub_status = subm.status.value if hasattr(subm.status, 'value') else str(subm.status)
                is_sub = (sub_status == "SUBMITTED" or sub_status == "APPROVED")
                sel_subs = items_map.get(subm.id, [])
                if subm.workspace:
                    is_fin = (subm.workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED)

        subs_in_group = grouped[(sem_num, prog_id)]
        req_pref = group_req_pref[(sem_num, prog_id)]
        
        # Check available categories among subjects that require preference
        req_subs = [s for s in subs_in_group if s.get("requires_preference", True)]
        has_core_avail = any(s["category"].upper() == "CORE" for s in req_subs)
        has_elec_avail = any(s["category"].upper() in ("ELECTIVE", "DISCIPLINE_ELECTIVE") for s in req_subs)

        result.append({
            "semester_number": sem_num,
            "programme_name": prog_name,
            "programme_id": prog_id,
            "subjects": subs_in_group,
            "requires_preference": req_pref,
            "has_core_available": has_core_avail,
            "has_elective_available": has_elec_avail,
            "is_submitted": is_sub,
            "status": sub_status,
            "selected_subject_ids": sel_subs,
            "is_finalized": is_fin,
        })
    return result

# ── Faculty: Helper to get or create workspace
def _get_or_create_workspace(db: Session, department_id: int, semester_number: int, programme_id: Optional[int]):

    from app.models.domain import AcademicYear, Semester, Programme, AcademicWorkspace, WorkspaceWorkflowStateEnum
    from app.core.workspace import WorkspaceContext, encode_workspace_id
    
    ay = db.query(AcademicYear).first()
    if not ay:
        raise HTTPException(status_code=500, detail="No academic year configured.")
    sem = db.query(Semester).filter(Semester.semester_number == semester_number).first()
    if not sem:
        raise HTTPException(status_code=404, detail=f"Semester {semester_number} not found.")
    
    workspace = None
    if programme_id:
        workspace = db.query(AcademicWorkspace).filter(
            AcademicWorkspace.programme_id == programme_id,
            AcademicWorkspace.semester_id == sem.id
        ).first()
    if not workspace:
        workspace = db.query(AcademicWorkspace).filter(
            AcademicWorkspace.department_id == department_id,
            AcademicWorkspace.semester_id == sem.id,
        ).first()
    if not workspace:
        target_prog = None
        if programme_id:
            target_prog = db.query(Programme).filter(Programme.id == programme_id).first()
        if not target_prog:
            target_prog = db.query(Programme).filter(Programme.department_id == department_id).first()
        target_prog_id = target_prog.id if target_prog else 1
        prog_year = (semester_number + 1) // 2
        ctx = WorkspaceContext(
            department_id=department_id,
            programme_id=target_prog_id,
            programme_year=prog_year,
            academic_year_id=ay.id,
            semester=semester_number,
        )
        ws_id = encode_workspace_id(ctx)
        workspace = AcademicWorkspace(
            id=ws_id,
            department_id=department_id,
            programme_id=target_prog_id,
            academic_year_id=ay.id,
            semester_id=sem.id,
            programme_year=prog_year,
            workflow_state=WorkspaceWorkflowStateEnum.PREFERENCES,
        )
        db.add(workspace)
        db.flush()
    return workspace

# ── Faculty: POST save draft preferences (per semester)
@router.post("/faculty/preferences/save-draft")
def save_preferences_draft(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value]))
):
    """Saves preferences for a semester as a DRAFT without marking the semester or term as SUBMITTED."""
    from app.models.domain import FacultyProfile, PreferenceItem, WorkspaceWorkflowStateEnum
    from datetime import datetime

    raw_sem_num = payload.get("semester_number")
    if raw_sem_num is None:
        raise HTTPException(status_code=400, detail="semester_number is required.")
    semester_number = int(raw_sem_num)
    programme_id = payload.get("programme_id")
    subject_ids = payload.get("subject_ids", [])

    fp = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Faculty profile not found.")

    workspace = _get_or_create_workspace(db, current_user.department_id, semester_number, programme_id)
    if workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
        raise HTTPException(status_code=423, detail="This workspace is finalized.")

    existing = db.query(PreferenceSubmission).filter(
        PreferenceSubmission.faculty_id == fp.id,
        PreferenceSubmission.workspace_id == workspace.id,
    ).first()

    if existing:
        existing.items.clear()
        db.flush()
        for idx, sid in enumerate(subject_ids):
            item = PreferenceItem(
                submission_id=existing.id,
                subject_id=sid,
                rank=idx + 1,
                decision=PreferenceStatusEnum.PENDING,
            )
            existing.items.append(item)
        existing.status = PreferenceStatusEnum.DRAFT
    else:
        sub = PreferenceSubmission(
            faculty_id=fp.id,
            workspace_id=workspace.id,
            status=PreferenceStatusEnum.DRAFT,
            review_status=PreferenceStatusEnum.PENDING,
            submitted_at=None,
        )
        db.add(sub)
        db.flush()
        for idx, sid in enumerate(subject_ids):
            item = PreferenceItem(
                submission_id=sub.id,
                subject_id=sid,
                rank=idx + 1,
                decision=PreferenceStatusEnum.PENDING,
            )
            sub.items.append(item)

    db.commit()
    return {"message": "Draft saved successfully.", "status": "DRAFT"}

# ── Faculty: POST submit preferences for the whole semester type (ODD/EVEN)
@router.post("/faculty/preferences/submit-term")
def submit_term_preferences(
    payload: TermPreferenceSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value]))
):
    """
    Submits preferences for all applicable semesters in an ODD or EVEN semester type.
    Enforces complete validation across all applicable contexts before committing.
    """
    from app.models.domain import (
        FacultyProfile, FacultyProgrammeScope, CurriculumOffering, Programme,
        Department, SemesterTypeEnum, Semester, AcademicWorkspace, WorkspaceWorkflowStateEnum,
        PreferenceItem
    )
    from datetime import datetime

    raw_st = payload.semester_type.upper()
    try:
        sem_enum = SemesterTypeEnum(raw_st)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid semester_type. Must be ODD or EVEN.")

    fp = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Faculty profile not found.")

    dept = db.query(Department).filter(Department.id == current_user.department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found.")

    # 1. Determine faculty authorized programme scopes
    mapped_scopes = db.query(FacultyProgrammeScope).filter(FacultyProgrammeScope.faculty_id == fp.id).all()
    if mapped_scopes:
        prog_ids = [s.programme_id for s in mapped_scopes]
    else:
        dept_progs = db.query(Programme).filter(Programme.department_id == dept.id).all()
        prog_ids = [p.id for p in dept_progs]

    if not prog_ids:
        raise HTTPException(status_code=400, detail="No authorized programmes found for faculty.")

    # 2. Query all curriculum offerings for this term and programme scopes
    offerings = db.query(CurriculumOffering).options(
        joinedload(CurriculumOffering.subject),
        joinedload(CurriculumOffering.programme)
    ).filter(
        CurriculumOffering.programme_id.in_(prog_ids),
        CurriculumOffering.semester_type == sem_enum
    ).all()

    # Group offerings by context: (semester, programme_id)
    contexts = defaultdict(list)
    for off in offerings:
        contexts[(off.semester, off.programme_id)].append(off)

    # Filter applicable contexts: those having at least one offering with requires_preference == True
    applicable_contexts = {}
    for ctx_key, offs in contexts.items():
        if any(o.requires_preference for o in offs):
            applicable_contexts[ctx_key] = offs

    # If payload provided new draft selections, persist them first in draft state
    if payload.selections:
        for sel in payload.selections:
            ws = _get_or_create_workspace(db, current_user.department_id, sel.semester_number, sel.programme_id)
            if ws.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
                continue
            sub = db.query(PreferenceSubmission).filter(
                PreferenceSubmission.faculty_id == fp.id,
                PreferenceSubmission.workspace_id == ws.id
            ).first()
            if sub:
                sub.items.clear()
                db.flush()
                for idx, sid in enumerate(sel.subject_ids):
                    sub.items.append(PreferenceItem(
                        submission_id=sub.id,
                        subject_id=sid,
                        rank=idx + 1,
                        decision=PreferenceStatusEnum.PENDING
                    ))
            else:
                sub = PreferenceSubmission(
                    faculty_id=fp.id,
                    workspace_id=ws.id,
                    status=PreferenceStatusEnum.DRAFT,
                    review_status=PreferenceStatusEnum.PENDING,
                    submitted_at=None
                )
                db.add(sub)
                db.flush()
                for idx, sid in enumerate(sel.subject_ids):
                    sub.items.append(PreferenceItem(
                        submission_id=sub.id,
                        subject_id=sid,
                        rank=idx + 1,
                        decision=PreferenceStatusEnum.PENDING
                    ))
        db.flush()

    # 3. Check current selections for every applicable context
    all_sems = db.query(Semester).all()
    sem_by_number = {s.semester_number: s for s in all_sems}

    missing_contexts = []
    category_errors = []
    workspaces_to_submit = []

    for (sem_num, p_id), offs in sorted(applicable_contexts.items()):
        prog = db.query(Programme).filter(Programme.id == p_id).first()
        prog_label = prog.name if prog else f"Programme {p_id}"
        ctx_name = f"Semester {sem_num} ({prog_label})"

        sem = sem_by_number.get(sem_num)
        ws = None
        if sem:
            ws = db.query(AcademicWorkspace).filter(
                AcademicWorkspace.programme_id == p_id,
                AcademicWorkspace.semester_id == sem.id
            ).first()
        if not ws:
            ws = _get_or_create_workspace(db, current_user.department_id, sem_num, p_id)

        # Check existing submission/draft
        subm = db.query(PreferenceSubmission).filter(
            PreferenceSubmission.faculty_id == fp.id,
            PreferenceSubmission.workspace_id == ws.id
        ).first()

        selected_subject_ids = [it.subject_id for it in subm.items] if subm else []

        if not selected_subject_ids:
            missing_contexts.append(ctx_name)
            continue

        # Check Category Rules for this semester
        req_offs = [o for o in offs if o.requires_preference]
        avail_categories = [o.subject.category.upper() for o in req_offs if o.subject]
        has_avail_core = any(c == "CORE" for c in avail_categories)
        has_avail_elective = any(c in ("ELECTIVE", "DISCIPLINE_ELECTIVE") for c in avail_categories)

        selected_subjects = [o.subject for o in req_offs if o.subject and o.subject_id in selected_subject_ids]
        sel_categories = [s.category.upper() for s in selected_subjects]
        has_sel_core = any(c == "CORE" for c in sel_categories)
        has_sel_elective = any(c in ("ELECTIVE", "DISCIPLINE_ELECTIVE") for c in sel_categories)

        if has_avail_core and has_avail_elective:
            if not has_sel_core or not has_sel_elective:
                category_errors.append(f"{ctx_name}: Please select at least one Core and at least one Elective subject.")
        elif has_avail_core and not has_avail_elective:
            if not has_sel_core:
                category_errors.append(f"{ctx_name}: Please select at least one Core subject.")
        elif not has_avail_core and has_avail_elective:
            if not has_sel_elective:
                category_errors.append(f"{ctx_name}: Please select at least one Elective subject.")

        workspaces_to_submit.append((ws, subm))

    # 4. If any validation fails, block completely and return HTTP 422
    if missing_contexts or category_errors:
        err_details = []
        if missing_contexts:
            err_details.append(
                f"Please finish your preference submission for all applicable semesters in this {raw_st} semester. "
                f"Incomplete semesters: {', '.join(missing_contexts)}."
            )
        if category_errors:
            err_details.extend(category_errors)
        
        # Roll back any pending flushes so drafts stay drafts and no SUBMITTED status is created
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"Please finish your preference submission for all applicable semesters in this {raw_st} semester.",
                "incomplete_semesters": missing_contexts,
                "errors": err_details,
            }
        )

    # 5. Commit atomically: mark all applicable submissions as SUBMITTED
    now = datetime.utcnow()
    for ws, subm in workspaces_to_submit:
        if subm:
            subm.status = PreferenceStatusEnum.SUBMITTED
            subm.review_status = PreferenceStatusEnum.PENDING
            subm.submitted_at = now
        else:
            new_sub = PreferenceSubmission(
                faculty_id=fp.id,
                workspace_id=ws.id,
                status=PreferenceStatusEnum.SUBMITTED,
                review_status=PreferenceStatusEnum.PENDING,
                submitted_at=now
            )
            db.add(new_sub)

    db.commit()
    return {
        "message": f"Successfully submitted preferences for all applicable {raw_st} semesters.",
        "status": "SUBMITTED",
        "semester_type": raw_st,
        "submitted_contexts": len(workspaces_to_submit)
    }

# ── Faculty: POST submit preferences (kept for single semester saving/fallback)
@router.post("/faculty/preferences/submit")
def submit_preferences_direct(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value]))
):
    """Direct single semester draft save or fallback submission."""
    # Delegate to save_preferences_draft so single-semester submissions save as draft
    return save_preferences_draft(payload, db, current_user)


