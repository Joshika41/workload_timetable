from fastapi import APIRouter, Depends, HTTPException, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
import models
from routers.auth import verify_faculty_role
from database import SessionLocal
from routers.auth import get_current_user

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class AllocationRequest(BaseModel):
    faculty_id: int
    subject_id: int
    class_section: str
    theory_hours: float
    practical_hours: float

@router.post("/api/workload/allocate")
def allocate_workload(allocation: AllocationRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    faculty = db.query(models.Faculty).filter(models.Faculty.id == allocation.faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")
        
    subject = db.query(models.Subject).filter(models.Subject.id == allocation.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    
    department_obj = db.query(models.Department).filter(models.Department.name == faculty.department).first()
    if department_obj and not department_obj.has_labs:
        allocation.practical_hours = 0

    new_alloc = models.WorkloadAllocation(
        faculty_id=allocation.faculty_id,
        subject_id=allocation.subject_id,
        class_section=allocation.class_section,
        theory_hours=allocation.theory_hours,
        practical_hours=allocation.practical_hours
    )
    db.add(new_alloc)
    db.commit()
    db.refresh(new_alloc)
    return {"message": "Allocation successfully created", "id": new_alloc.id}

@router.get("/api/workload/summary")
def workload_summary(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    faculties = db.query(models.Faculty).all()
    summary = []
    
    for f in faculties:
        total_theory = sum(alloc.theory_hours for alloc in f.allocations)
        total_prac = sum(alloc.practical_hours for alloc in f.allocations)
        summary.append({
            "faculty_id": f.id,
            "name": f.name,
            "designation": f.designation,
            "total_assigned_hours": total_theory + total_prac
        })
        
    return summary

@router.get('/api/faculty/workload')
def get_faculty_workload_dashboard(
    program_type: str,
    semester_type: str,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(verify_faculty_role)
):
    faculty = db.query(models.Faculty).filter_by(user_id=current_user.id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail='Faculty profile not found.')
        
    prog = models.ProgramTypeEnum(program_type.upper())
    sem = models.SemesterTypeEnum(semester_type.upper())
    
    # Get all active allocations for this faculty
    allocations = db.query(models.WorkloadAllocation, models.Syllabus, models.Cohort).join(
        models.Syllabus, models.WorkloadAllocation.subject_code == models.Syllabus.subject_code
    ).outerjoin(
        models.Cohort, models.WorkloadAllocation.cohort_id == models.Cohort.id
    ).filter(
        models.WorkloadAllocation.faculty_id == faculty.id,
        models.WorkloadAllocation.is_active == True,
        models.Syllabus.program_type == prog,
        models.Syllabus.semester_type == sem
    ).all()
    
    # Check if ANY department tied to these allocations is locked.
    # If not locked, the dashboard can optionally return 'status: pending'
    dept_ids = {s.department_id for _, s, _ in allocations if s.department_id}
    is_locked = False
    if dept_ids:
        is_locked = db.query(models.Department).filter(
            models.Department.id.in_(dept_ids), 
            models.Department.is_allocation_locked == True
        ).count() > 0
        
    result = []
    total_theory = 0
    total_lab = 0
    
    for alloc, syl, coh in allocations:
        total_theory += alloc.allocated_theory_hours
        total_lab += alloc.allocated_lab_hours
        result.append({
            'subject_code': syl.subject_code,
            'course_title': syl.course_title,
            'cohort_name': coh.class_name if coh else 'N/A',
            'theory_hours': alloc.allocated_theory_hours,
            'lab_hours': alloc.allocated_lab_hours,
            'role_type': alloc.role_type.value if hasattr(alloc.role_type, 'value') else alloc.role_type
        })
        
    return {
        'is_published': is_locked,
        'total_theory': total_theory,
        'total_lab': total_lab,
        'allocations': result
    }
