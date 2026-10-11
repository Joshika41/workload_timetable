from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.domain import User
from app.auth.jwt import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
        
    user_id = int(user_id_str)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user

def require_role(allowed_roles: list):
    def role_checker(current_user: User = Depends(get_current_user)):
        has_permission = current_user.role.value in allowed_roles
        
        # Dynamic HOD authorization based on real dataset designations
        if not has_permission and 'HOD' in allowed_roles and current_user.role.value == 'FACULTY':
            if current_user.faculty_profile and ('HOD' in current_user.faculty_profile.designation or 'Head' in current_user.faculty_profile.designation):
                has_permission = True
                
        if not has_permission:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return role_checker
