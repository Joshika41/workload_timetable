from fastapi import Depends, HTTPException, Query
from app.auth.dependencies import get_current_user
from app.models.domain import User
from app.core.workspace import decode_workspace_id, WorkspaceContext

def verify_workspace_access(workspace_id: str = Query(...), current_user: User = Depends(get_current_user)) -> WorkspaceContext:
    """
    Decodes the opaque workspace_id identifier and enforces server-side authorization.
    This asserts that the decoded workspace context requested by the user is a scope they are allowed to access.
    The workspace_id itself is merely a transport identifier, NOT a security token.
    """
    try:
        context = decode_workspace_id(workspace_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workspace ID")
    
    is_hod = False
    if current_user.role.value in ["HOD", "ERP_COORDINATOR"]:
        is_hod = True
    elif current_user.role.value == "FACULTY":
        if current_user.faculty_profile and ("HOD" in current_user.faculty_profile.designation.upper() or "HEAD" in current_user.faculty_profile.designation.upper()):
            is_hod = True

    # HOD or Coordinator must have access to the department
    if is_hod:
        if current_user.department_id != context.department_id:
            raise HTTPException(status_code=403, detail="Not authorized for this workspace")
    # Faculty must have an explicit scope mapping to the workspace
    else:
        from app.database.connection import SessionLocal
        from app.models.domain import FacultyWorkspaceScope, FacultyProfile
        db = SessionLocal()
        try:
            fac = db.query(FacultyProfile).filter_by(user_id=current_user.id).first()
            if not fac:
                raise HTTPException(status_code=403, detail="Faculty profile not found")
            scope = db.query(FacultyWorkspaceScope).filter_by(faculty_id=fac.id, workspace_id=workspace_id).first()
            if not scope:
                raise HTTPException(status_code=403, detail="Not authorized for this workspace")
        finally:
            db.close()
    
    return context
