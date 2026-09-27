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
    
    # HOD or Coordinator must have access to the department
    if current_user.role.value in ["HOD", "ERP_COORDINATOR"]:
        if current_user.department_id != context.department_id:
            raise HTTPException(status_code=403, detail="Not authorized for this workspace")
    # Faculty can only view if they belong to the same department (or specific rules apply)
    elif current_user.role.value == "FACULTY":
        if current_user.department_id != context.department_id:
            raise HTTPException(status_code=403, detail="Not authorized for this workspace")
    
    return context
