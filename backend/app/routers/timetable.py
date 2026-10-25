from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
import os

from app.database.connection import get_db
from app.auth.dependencies import get_current_user, require_role
from app.models.domain import User, RoleEnum
from app.services.timetable_service import (
    generate_timetable,
    get_timetable_entries_for_workspace,
    get_timetable_versions,
    publish_timetable_version,
    validate_user_workspace_authorization,
    get_faculty_timetable_entries,
    TimetableGenerationError,
    TimetablePublicationConflictError
)
from app.models.domain import AcademicWorkspace
from app.services.provisional_timetable_preview_service import (
    generate_provisional_timetable_preview,
    ProvisionalPreviewError
)

router = APIRouter()

@router.post("/generate/{workspace_id}")
def api_generate_timetable(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["HOD", "ERP_COORDINATOR", "MASTER_ADMIN"]))
):
    """
    Authenticated canonical timetable generation endpoint.
    Invokes TeachingSessionBuilder -> KairosTimetableAdapter -> KAIROS Solver -> Canonical TimetableEntry persistence.
    """
    try:
        result = generate_timetable(workspace_id=workspace_id, db=db, current_user=current_user)
        return result
    except TimetableGenerationError as e:
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "message": e.message,
                "preflight_errors": e.preflight_errors
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during timetable generation: {str(e)}"
        )

@router.get("/versions/{workspace_id}")
def api_get_timetable_versions(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves all generated timetable versions for a workspace.
    """
    return get_timetable_versions(workspace_id, db)

@router.post("/publish/{version_id}")
def api_publish_timetable(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["HOD", "ERP_COORDINATOR", "MASTER_ADMIN"]))
):
    """
    Publishes a validated draft timetable version after strict cross-workspace conflict validation.
    """
    try:
        return publish_timetable_version(version_id, db)
    except TimetablePublicationConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": e.message,
                "conflicts": e.conflicts
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/workspace/{workspace_id}")
def api_get_timetable(
    workspace_id: str,
    version_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches timetable entries for display.
    """
    result = get_timetable_entries_for_workspace(workspace_id, db, version_id)
    if not result:
        return {"version_id": None, "status": "NOT_FOUND", "entries": []}
    return result


@router.post("/preview/{workspace_id}")
def api_generate_provisional_preview(
    workspace_id: str,
    scope_type: str = "AUTO",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["HOD", "ERP_COORDINATOR", "MASTER_ADMIN"]))
):
    """
    Authenticated provisional timetable preview endpoint.
    Executes KAIROS solver with provisional room preferences and unverified student capacity.
    CRITICAL: Never creates TimetableVersion or TimetableEntry database records, and results are NEVER publishable.
    """
    ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail=f"AcademicWorkspace '{workspace_id}' not found.")

    try:
        validate_user_workspace_authorization(current_user, ws)
    except TimetableGenerationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    try:
        preview_res = generate_provisional_timetable_preview(workspace_id=workspace_id, db=db, scope_type=scope_type)
        return preview_res
    except ProvisionalPreviewError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "message": e.message,
                "blockers": e.blockers
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during provisional timetable preview generation: {str(e)}"
        )


@router.get("/readiness/{workspace_id}")
def api_get_workspace_timetable_readiness(
    workspace_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["HOD", "ERP_COORDINATOR", "MASTER_ADMIN", "FACULTY"]))
):
    """
    Evaluates real-time readiness prerequisites for automated timetable generation.
    Read-only diagnostic audit.
    """
    from app.services.timetable_readiness_service import evaluate_workspace_timetable_readiness
    ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail=f"AcademicWorkspace '{workspace_id}' not found.")

    try:
        validate_user_workspace_authorization(current_user, ws)
    except TimetableGenerationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    return evaluate_workspace_timetable_readiness(workspace_id, db)


@router.get("/faculty/schedule")
def api_get_faculty_schedule(
    semester_type: Optional[str] = None,
    faculty_user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the published timetable entries for the requesting faculty user.
    HODs and MASTER_ADMINs can optionally inspect other faculty schedules via faculty_user_id.
    Standard faculty users are strictly restricted to their own published schedule.
    """
    target_user_id = current_user.id
    if faculty_user_id and faculty_user_id != current_user.id:
        if current_user.role in [RoleEnum.MASTER_ADMIN, RoleEnum.HOD, RoleEnum.ERP_COORDINATOR]:
            target_user_id = faculty_user_id
        elif current_user.faculty_profile and ("HOD" in (current_user.faculty_profile.designation or "").upper() or "HEAD" in (current_user.faculty_profile.designation or "").upper()):
            target_user_id = faculty_user_id
        else:
            raise HTTPException(status_code=403, detail="Unauthorized to view other faculty schedules.")

    return get_faculty_timetable_entries(
        user_id=target_user_id,
        db=db,
        semester_type=semester_type
    )


@router.get("/rooms")
def api_get_timetable_rooms(
    institution_id: Optional[int] = 2,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns active, verified canonical rooms filtered by department/building scope.
    """
    from app.models.timetable import TimetableRoom
    dept = department_id if department_id is not None else current_user.department_id

    query = db.query(TimetableRoom).filter(
        TimetableRoom.active == True,
        TimetableRoom.institution_id == institution_id
    )

    # Department 5 (Postgraduate Department of Computer Applications - MCA): PG Block only
    if dept == 5:
        query = query.filter(TimetableRoom.building == "PG Block")
    # Department 1 (Computer Science - B.Sc & M.Sc CS): Block 5 & BMS Block
    elif dept == 1:
        query = query.filter(TimetableRoom.building.in_(["Block 5", "BMS Block"]))

    rooms = query.order_by(TimetableRoom.room_code.asc()).all()

    return [
        {
            "id": r.id,
            "room_code": r.room_code,
            "room_name": r.room_name,
            "room_type": r.room_type,
            "building": r.building,
            "capacity": r.capacity
        }
        for r in rooms
    ]



