import base64
import json
from pydantic import BaseModel

class WorkspaceContext(BaseModel):
    department_id: int
    programme_id: int
    programme_year: int
    academic_year_id: int
    semester: int
    # Note: section_name is intentionally omitted to make this the true canonical context

def encode_workspace_id(context: WorkspaceContext) -> str:
    """
    Encode a workspace context into an opaque identifier.
    
    SECURITY NOTE: 
    This Base64-encoded workspace_id is an IDENTIFIER, NOT A SECURITY MECHANISM.
    - Base64 is reversible and must NOT be treated as encryption.
    - It must NOT itself provide authorization.
    - Authorization must remain server-side (verify authenticated user -> role -> authorized scope -> requested workspace).
    """
    data = {
        "d": context.department_id,
        "p": context.programme_id,
        "py": context.programme_year,
        "y": context.academic_year_id,
        "s": context.semester
    }
    json_str = json.dumps(data)
    return base64.urlsafe_b64encode(json_str.encode('utf-8')).decode('utf-8')

def decode_workspace_id(workspace_id: str) -> WorkspaceContext:
    """Decode an opaque identifier back into a workspace context."""
    try:
        json_str = base64.urlsafe_b64decode(workspace_id.encode('utf-8')).decode('utf-8')
        data = json.loads(json_str)
        return WorkspaceContext(
            department_id=data["d"],
            programme_id=data["p"],
            programme_year=data.get("py", 1), # Fallback for backwards compat if needed
            academic_year_id=data["y"],
            semester=data["s"]
        )
    except Exception as e:
        raise ValueError("Invalid workspace identifier") from e
