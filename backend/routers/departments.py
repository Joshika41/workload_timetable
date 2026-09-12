from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from database import SessionLocal
from routers.auth import verify_admin_role

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class DepartmentCreate(BaseModel):
    name: str
    programme_scope: str

@router.post("/api/admin/departments")
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    dept = models.Department(
        name=payload.name,
        programme_scope=payload.programme_scope,
        is_active=True,
        is_allocation_locked=False
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return {"message": "Department created", "id": dept.id}

@router.get("/api/admin/departments")
def get_departments(db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    depts = db.query(models.Department).filter(models.Department.is_active == True).all()
    return [{
        "id": d.id, 
        "name": d.name, 
        "programme_scope": d.programme_scope,
        "is_allocation_locked": d.is_allocation_locked
    } for d in depts]

@router.delete("/api/admin/departments/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
        
    # Soft delete cascade behavior
    dept.is_active = False
    
    # Soft delete related Syllabus and Cohorts
    db.query(models.Syllabus).filter(models.Syllabus.department_id == department_id).update({"is_active": False})
    db.query(models.Cohort).filter(models.Cohort.department_id == department_id).update({"is_active": False})
    # Note: Faculty records remain untouched as per PRD requirements.
    
    # Also log the deletion action
    audit = models.AuditLog(
        user_id=current_user.id,
        action_type="SOFT_DELETE_DEPARTMENT",
        target_entity=f"Department:{department_id}",
        previous_value={"name": dept.name, "is_active": True},
        new_value={"is_active": False, "cascaded": ["Syllabus", "Cohorts"]}
    )
    db.add(audit)
    db.commit()
    return {"message": "Department and related syllabus/cohorts softly deleted."}


@router.put("/api/admin/departments/{department_id}")
def update_department(department_id: int, payload: DepartmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    dept = db.query(models.Department).filter(models.Department.id == department_id, models.Department.is_active == True).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check name collision
    existing = db.query(models.Department).filter(models.Department.name == payload.name, models.Department.id != department_id, models.Department.is_active == True).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department with this name already exists")
        
    dept.name = payload.name
    dept.has_labs = payload.has_labs
    db.commit()
    return {"message": "Department updated successfully", "department": {"id": dept.id, "name": dept.name}}
