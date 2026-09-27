from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    department_id: Optional[int] = None
    name: Optional[str] = None

class UserMeResponse(BaseModel):
    id: int
    email: str
    role: str
    department_id: Optional[int] = None
    name: Optional[str] = None
    erp_id: Optional[str] = None
