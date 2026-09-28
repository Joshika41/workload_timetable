from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database.connection import get_db
from app.models.domain import (
    User, RoleEnum, AcademicWorkspace, WorkspaceWorkflowStateEnum,
    Subject, PreferenceSubmission, PreferenceStatusEnum
)
from app.auth.dependencies import require_role, get_current_user
from app.schemas.preferences import (
    PreferenceSubmitRequest, PreferenceSubmissionResponse,
    PreferenceDecisionRequest, SubmissionReviewRequest
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

# ── Faculty: POST submit preferences (Core+Elective enforced here + finalization lock)
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

    # Enforce Core + Elective rule
    subject_ids = [p.subject_id for p in req.preferences]
    if len(subject_ids) != len(set(subject_ids)):
        raise HTTPException(status_code=400, detail="Duplicate subjects found in preferences")

    subjects = db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
    categories = {s.id: s.category for s in subjects}

    has_core = any(categories.get(sid, "") == "CORE" for sid in subject_ids)
    has_elective = any(categories.get(sid, "") == "ELECTIVE" for sid in subject_ids)

    if not has_core:
        raise HTTPException(
            status_code=422,
            detail="Submission must include at least one CORE subject."
        )
    if not has_elective:
        raise HTTPException(
            status_code=422,
            detail="Submission must include at least one ELECTIVE subject."
        )

    sub = pref_service.submit_preferences(db, current_user, req, context)
    return {"message": "Preferences submitted successfully", "id": sub.id}

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
    programmes = db.query(Programme).filter(Programme.department_id == dept.id).all()
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
    
    offerings = db.query(CurriculumOffering).filter(
        CurriculumOffering.programme_id.in_(prog_ids),
        CurriculumOffering.semester_type == sem_enum,
        CurriculumOffering.semester <= 6  # Cap at sem 6 (no sem 7, 8)
    ).all()
    
    # Group by semester
    grouped = defaultdict(list)
    seen = set()
    for off in offerings:
        key = (off.semester, off.subject_id)
        if key in seen:
            continue
        seen.add(key)
        
        subj = off.subject
        is_optional = subj.category.upper() in ('MINOR', 'MULTIDISCIPLINARY')
        grouped[off.semester].append({
            "id": subj.id,
            "course_code": subj.course_code,
            "course_name": subj.course_name,
            "category": subj.category,
            "theory_hours": subj.theory_hours or 0,
            "practical_hours": subj.practical_hours or 0,
            "credits": subj.credits or 0,
            "class_type": prog_map.get(off.programme_id, ""),
            "is_optional": is_optional,
        })
    
    from app.models.domain import AcademicWorkspace, PreferenceSubmission, PreferenceItem, FacultyProfile, Semester, AcademicYear
    
    fp = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
    ay = db.query(AcademicYear).first()

    result = []
    for sem_num in sorted(grouped.keys()):
        # Pick first programme for this semester (they share the same dept)
        matching_off = next((o for o in offerings if o.semester == sem_num), None)
        prog_name = prog_map.get(matching_off.programme_id, "") if matching_off else ""
        prog_id = matching_off.programme_id if matching_off else 0
        
        is_sub = False
        sel_subs = []
        is_fin = False
        
        sem = db.query(Semester).filter(Semester.semester_number == sem_num).first()
        if sem and ay and fp:
            # Match submission across any workspace in this faculty's department for this semester
            subm = db.query(PreferenceSubmission).join(
                AcademicWorkspace, PreferenceSubmission.workspace_id == AcademicWorkspace.id
            ).filter(
                AcademicWorkspace.department_id == current_user.department_id,
                AcademicWorkspace.semester_id == sem.id,
                PreferenceSubmission.faculty_id == fp.id
            ).first()
            if subm:
                is_sub = True
                items = db.query(PreferenceItem).filter(PreferenceItem.submission_id == subm.id).all()
                sel_subs = [it.subject_id for it in items]
                if subm.workspace:
                    is_fin = (subm.workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED)

        result.append({
            "semester_number": sem_num,
            "programme_name": prog_name,
            "programme_id": prog_id,
            "subjects": grouped[sem_num],
            "is_submitted": is_sub,
            "selected_subject_ids": sel_subs,
            "is_finalized": is_fin,
        })
    
    return result

# ── Faculty: POST submit preferences (direct, without workspace_id)
@router.post("/faculty/preferences/submit")
def submit_preferences_direct(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([RoleEnum.FACULTY.value]))
):
    """Direct preference submission: takes semester_number, programme_id, subject_ids."""
    from app.models.domain import (
        FacultyProfile, PreferenceItem, CurriculumOffering, AcademicYear, Semester, Programme
    )
    from datetime import datetime
    
    raw_sem_num = payload.get("semester_number")
    if raw_sem_num is None:
        raise HTTPException(status_code=400, detail="semester_number is required.")
    semester_number = int(raw_sem_num)
    programme_id = payload.get("programme_id")
    subject_ids = payload.get("subject_ids", [])
    
    if not subject_ids:
        raise HTTPException(status_code=400, detail="No subjects selected.")
    
    # Validate Core + Elective
    subjects = db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
    categories = {s.id: s.category.upper() for s in subjects}
    
    has_core = any(c == "CORE" for c in categories.values())
    has_elective = any(c in ("ELECTIVE", "DISCIPLINE_ELECTIVE") for c in categories.values())
    
    if not has_core:
        raise HTTPException(status_code=422, detail="Please select at least one Core subject.")
    if not has_elective:
        raise HTTPException(status_code=422, detail="Please select at least one Elective subject.")
    
    # Find or create workspace
    ay = db.query(AcademicYear).first()
    if not ay:
        raise HTTPException(status_code=500, detail="No academic year configured.")
    
    # Find semester
    sem = db.query(Semester).filter(Semester.semester_number == semester_number).first()
    if not sem:
        raise HTTPException(status_code=404, detail=f"Semester {semester_number} not found.")
    
    workspace = None
    if programme_id:
        workspace = db.query(AcademicWorkspace).filter(
            AcademicWorkspace.programme_id == programme_id,
            AcademicWorkspace.semester_id == sem.id,
            AcademicWorkspace.department_id == current_user.department_id,
        ).first()
    
    if not workspace:
        # Fallback to any existing workspace for this department and semester
        workspace = db.query(AcademicWorkspace).filter(
            AcademicWorkspace.department_id == current_user.department_id,
            AcademicWorkspace.semester_id == sem.id,
        ).first()
    
    if not workspace:
        # Create workspace dynamically with standard URL-safe encode
        from app.core.workspace import WorkspaceContext, encode_workspace_id
        target_prog = None
        if programme_id:
            target_prog = db.query(Programme).filter(Programme.id == programme_id).first()
        if not target_prog:
            target_prog = db.query(Programme).filter(Programme.department_id == current_user.department_id).first()
        target_prog_id = target_prog.id if target_prog else 1
        
        prog_year = (semester_number + 1) // 2
        ctx = WorkspaceContext(
            department_id=current_user.department_id,
            programme_id=target_prog_id,
            programme_year=prog_year,
            academic_year_id=ay.id,
            semester=semester_number,
        )
        ws_id = encode_workspace_id(ctx)
        workspace = AcademicWorkspace(
            id=ws_id,
            department_id=current_user.department_id,
            programme_id=target_prog_id,
            academic_year_id=ay.id,
            semester_id=sem.id,
            programme_year=prog_year,
            workflow_state=WorkspaceWorkflowStateEnum.PREFERENCES,
        )
        db.add(workspace)
        db.flush()
    
    # Check finalization
    if workspace.workflow_state == WorkspaceWorkflowStateEnum.FINALIZED:
        raise HTTPException(status_code=423, detail="This workspace is finalized.")
    
    # Find faculty profile
    fp = db.query(FacultyProfile).filter(FacultyProfile.user_id == current_user.id).first()
    if not fp:
        raise HTTPException(status_code=404, detail="Faculty profile not found.")
    
    # Check for existing submission in this workspace or semester
    existing = db.query(PreferenceSubmission).filter(
        PreferenceSubmission.faculty_id == fp.id,
        PreferenceSubmission.workspace_id == workspace.id,
    ).first()
    
    if not existing:
        existing = db.query(PreferenceSubmission).join(
            AcademicWorkspace, PreferenceSubmission.workspace_id == AcademicWorkspace.id
        ).filter(
            AcademicWorkspace.department_id == current_user.department_id,
            AcademicWorkspace.semester_id == sem.id,
            PreferenceSubmission.faculty_id == fp.id,
        ).first()
    
    if existing:
        # Update existing submission: properly clear relationship collection
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
        existing.status = PreferenceStatusEnum.SUBMITTED
        existing.review_status = PreferenceStatusEnum.PENDING
        existing.submitted_at = datetime.utcnow()
    else:
        # Create new submission
        sub = PreferenceSubmission(
            faculty_id=fp.id,
            workspace_id=workspace.id,
            status=PreferenceStatusEnum.SUBMITTED,
            review_status=PreferenceStatusEnum.PENDING,
            submitted_at=datetime.utcnow(),
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
    return {"message": "Preferences submitted successfully."}

