from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models.domain import User, RoleEnum, FacultyProfile, Department, Programme, AcademicYear, AcademicWorkspace
from app.auth.jwt import verify_password, create_access_token
from typing import Optional
from pydantic import BaseModel

router = APIRouter()

class DemoLoginRequest(BaseModel):
    role: str
    department_id: Optional[int] = None
    programme_id: Optional[int] = None
    semester_type: Optional[str] = "ODD"
    faculty_id: Optional[int] = None  # For faculty "who are you" step

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    
    faculty_profile = db.query(FacultyProfile).filter(FacultyProfile.user_id == user.id).first()
    name = faculty_profile.name if faculty_profile else user.email
    designation = faculty_profile.designation if faculty_profile else user.role.value
    erp_id = faculty_profile.erp_id if faculty_profile else user.email
    
    dept = db.query(Department).filter(Department.id == user.department_id).first()
    inst_name = ""
    inst_id = None
    if dept and dept.institution:
        inst_name = dept.institution.name
        inst_id = dept.institution.id
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "role": user.role.value,
        "name": name,
        "user_id": user.id,
        "faculty_profile_id": faculty_profile.id if faculty_profile else None,
        "department_id": user.department_id,
        "department_name": dept.name if dept else None,
        "designation": designation,
        "erp_id": erp_id,
        "institution_id": inst_id,
        "institution_name": inst_name,
    }

@router.post("/demo-login")
def demo_login(req: DemoLoginRequest, db: Session = Depends(get_db)):
    """
    Creates a real backend session for the seeded demo users.
    No credentials required - just role, department_id, programme_id, semester_type.
    Faculty: also accepts faculty_id to impersonate a specific faculty member.
    """
    try:
        requested_role = RoleEnum(req.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {req.role}")
    
    user = None

    if requested_role == RoleEnum.FACULTY and req.faculty_id:
        # Faculty "who are you" - find the user for this faculty profile
        fp = db.query(FacultyProfile).filter(FacultyProfile.id == req.faculty_id).first()
        if fp:
            user = db.query(User).filter(User.id == fp.user_id).first()
    
    if not user and req.department_id:
        user = db.query(User).filter(
            User.role == requested_role,
            User.department_id == req.department_id
        ).first()
    
    if not user:
        user = db.query(User).filter(User.role == requested_role).first()
    
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"No demo user found for role '{req.role}' in this department. Please check that seed data is loaded."
        )
    
    # Build the token with full context
    token_data = {
        "sub": str(user.id),
        "role": user.role.value,
        "dept_id": user.department_id,
        "prog_id": req.programme_id,
        "sem_type": req.semester_type or "ODD"
    }
    access_token = create_access_token(data=token_data)
    
    faculty_profile = db.query(FacultyProfile).filter(FacultyProfile.user_id == user.id).first()
    name = faculty_profile.name if faculty_profile else (user.email.split("@")[0].replace("_", " ").title())
    
    dept = db.query(Department).filter(Department.id == user.department_id).first()
    prog = db.query(Programme).filter(Programme.id == req.programme_id).first() if req.programme_id else None
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role.value,
        "name": name,
        "user_id": user.id,
        "faculty_profile_id": faculty_profile.id if faculty_profile else None,
        "department_id": user.department_id,
        "department_name": dept.name if dept else None,
        "programme_id": req.programme_id,
        "programme_name": prog.name if prog else None,
        "programme_type": prog.programme_type if prog else None,
        "semester_type": req.semester_type or "ODD",
    }

@router.get("/profiles")
def get_profiles(role: str, institution_id: int, db: Session = Depends(get_db)):
    """Returns users matching the role and institution."""
    try:
        req_role = RoleEnum(role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    query = db.query(User).join(Department, User.department_id == Department.id)
    if req_role == RoleEnum.HOD:
        query = query.filter(User.role.in_([RoleEnum.HOD, RoleEnum.ERP_COORDINATOR]))
    else:
        query = query.filter(User.role == req_role)
        
    query = query.filter(Department.institution_id == institution_id)
    users = query.all()
    
    profiles = []
    for u in users:
        fp = db.query(FacultyProfile).filter(FacultyProfile.user_id == u.id).first()
        dept = db.query(Department).filter(Department.id == u.department_id).first()
        name = fp.name if fp else (u.email.split('@')[0].title())
        designation = fp.designation if fp else (req_role.value)
        erp_id = fp.erp_id if fp else u.email
        
        profiles.append({
            "user_id": u.id,
            "username": u.email,
            "name": name,
            "designation": designation,
            "erp_id": erp_id,
            "department": dept.name if dept else ""
        })
        
    # Sort by seniority (naive string sort for now, or rely on explicit IDs)
    return sorted(profiles, key=lambda x: x["name"])
