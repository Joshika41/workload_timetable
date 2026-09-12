from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import models
from database import SessionLocal
from models import Syllabus, PreferenceConstraint, SubjectPreference, ProgramTypeEnum, SemesterTypeEnum, Faculty, Cohort, CohortSyllabusMapping

from routers.auth import get_current_user, verify_admin_role, verify_faculty_role

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class PreferenceRequest(BaseModel):
    faculty_id: int
    preferred_day: str
    preferred_period: int
    preference_type: str 

@router.post("/api/faculty/preferences")
def submit_preferences(prefs: List[PreferenceRequest], db: Session = Depends(get_db), current_user: models.User = Depends(verify_faculty_role)):
    try:
        if not prefs:
            return {"message": "No preferences submitted"}
            
        fac_id = prefs[0].faculty_id
        db.query(models.FacultyPreference).filter(models.FacultyPreference.faculty_id == fac_id).delete()
        
        pref_records = []
        for p in prefs:
            pref_records.append(models.FacultyPreference(
                faculty_id=p.faculty_id,
                preferred_day=p.preferred_day,
                preferred_period=p.preferred_period,
                preference_type=models.PreferenceTypeEnum(p.preference_type)
            ))
            
        db.add_all(pref_records)
        db.commit()
        return {"message": f"Successfully saved {len(pref_records)} preferences"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/api/admin/preferences")
def get_all_preferences(
    department_id: Optional[int] = None,
    program_type: str = "UG", 
    semester_type: str = "ODD", 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(verify_admin_role)
):
    try:
        prog = ProgramTypeEnum(program_type.upper())
        sem = SemesterTypeEnum(semester_type.upper())
        
        # Path A: Cohort-Syllabus Mapping path (fully relational)
        cohort_query = db.query(models.CohortSyllabusMapping, models.Cohort, models.Syllabus).join(
            models.Cohort, models.CohortSyllabusMapping.cohort_id == models.Cohort.id
        ).join(
            models.Syllabus, models.CohortSyllabusMapping.subject_code == models.Syllabus.subject_code
        ).filter(
            models.Cohort.program_type == prog,
            models.Cohort.semester_type == sem,
            models.Cohort.is_active == True,
            models.Syllabus.is_active == True
        )
        if department_id is not None:
            cohort_query = cohort_query.filter(models.Cohort.department_id == department_id)
        
        mappings = cohort_query.all()

        # Path B: Fallback - no cohorts exist yet, read syllabi directly
        # This ensures the matrix is ALWAYS populated after a syllabus upload
        if not mappings:
            syllabus_q = db.query(models.Syllabus).filter(
                models.Syllabus.program_type == prog,
                models.Syllabus.semester_type == sem,
                models.Syllabus.is_active == True
            )
            if department_id is not None:
                syllabus_q = syllabus_q.filter(models.Syllabus.department_id == department_id)
            direct_syllabi = syllabus_q.all()

            if not direct_syllabi:
                return []

            all_subject_codes = [s.subject_code for s in direct_syllabi]
            preferences = db.query(models.SubjectPreference, models.Faculty).join(
                models.Faculty, models.SubjectPreference.faculty_id == models.Faculty.id
            ).filter(
                models.SubjectPreference.subject_code.in_(all_subject_codes),
                models.SubjectPreference.is_active == True,
                models.Faculty.is_active == True
            ).all()

            pref_by_subject = {}
            for pref, fac in preferences:
                pref_by_subject.setdefault(pref.subject_code, []).append((pref, fac))

            result = []
            for syl in direct_syllabi:
                prefs_for_sub = pref_by_subject.get(syl.subject_code, [])
                if not prefs_for_sub:
                    result.append({
                        "id": f"unassigned_{syl.subject_code}_nocohort",
                        "faculty_id": "",
                        "faculty_name": "Unassigned",
                        "subject_code": syl.subject_code,
                        "course_title": syl.course_title,
                        "cohort_id": "",
                        "cohort_name": "-",
                        "role_type": "Main",
                        "allocated_theory_hours": 0,
                        "allocated_lab_hours": 0,
                        "max_theory": syl.theory_hours_l or 4,
                        "max_lab": syl.practical_hours_p or 2,
                        "has_conflict": False,
                        "status": "PENDING"
                    })
                else:
                    for pref, fac in prefs_for_sub:
                        result.append({
                            "id": f"{pref.preference_id}_nocohort",
                            "preference_id": pref.preference_id,
                            "faculty_id": fac.id,
                            "faculty_name": fac.name,
                            "subject_code": syl.subject_code,
                            "course_title": syl.course_title,
                            "cohort_id": "",
                            "cohort_name": "-",
                            "role_type": "Main",
                            "allocated_theory_hours": syl.theory_hours_l or 0,
                            "allocated_lab_hours": syl.practical_hours_p or 0,
                            "max_theory": getattr(fac, "max_theory_hours", 4),
                            "max_lab": getattr(fac, "max_lab_hours", 2),
                            "has_conflict": len(prefs_for_sub) > 1,
                            "status": pref.status
                        })
            print(f"DEBUG MATRIX (fallback): {len(result)} rows from {len(direct_syllabi)} syllabi.")
            return result

        # Path A continued: Build from cohort-syllabus mappings
        subject_codes = list(set([syl.subject_code for _, _, syl in mappings if syl]))
        
        preferences = db.query(models.SubjectPreference, models.Faculty).join(
            models.Faculty, models.SubjectPreference.faculty_id == models.Faculty.id
        ).filter(
            models.SubjectPreference.subject_code.in_(subject_codes),
            models.SubjectPreference.is_active == True,
            models.Faculty.is_active == True
        ).all() if subject_codes else []
        
        pref_by_subject = {}
        for pref, fac in preferences:
            pref_by_subject.setdefault(pref.subject_code, []).append((pref, fac))
            
        result = []
        for cmap, cohort, syl in mappings:
            prefs_for_sub = pref_by_subject.get(syl.subject_code, [])
            has_conflict = len(prefs_for_sub) > 1
            
            if not prefs_for_sub:
                result.append({
                    "id": f"unassigned_{syl.subject_code}_{cohort.id}",
                    "faculty_id": "",
                    "faculty_name": "Unassigned",
                    "subject_code": syl.subject_code,
                    "course_title": syl.course_title,
                    "cohort_id": cohort.id,
                    "cohort_name": f"{cohort.academic_year} {cohort.class_name} - {cohort.section}",
                    "role_type": "Main",
                    "allocated_theory_hours": 0,
                    "allocated_lab_hours": 0,
                    "max_theory": syl.theory_hours_l or 4,
                    "max_lab": syl.practical_hours_p or 2,
                    "has_conflict": False,
                    "status": "PENDING"
                })
            else:
                for pref, fac in prefs_for_sub:
                    result.append({
                        "id": f"{pref.preference_id}_{cohort.id}",
                        "preference_id": pref.preference_id,
                        "faculty_id": fac.id,
                        "faculty_name": fac.name,
                        "subject_code": syl.subject_code,
                        "course_title": syl.course_title,
                        "cohort_id": cohort.id,
                        "cohort_name": f"{cohort.academic_year} {cohort.class_name} - {cohort.section}",
                        "role_type": "Main",
                        "allocated_theory_hours": syl.theory_hours_l or 0,
                        "allocated_lab_hours": syl.practical_hours_p or 0,
                        "max_theory": getattr(fac, "max_theory_hours", 4),
                        "max_lab": getattr(fac, "max_lab_hours", 2),
                        "has_conflict": has_conflict,
                        "status": pref.status
                    })
        
        print(f"DEBUG MATRIX: {len(result)} rows from {len(mappings)} cohort-syllabus intersections.")
        return result
    except Exception as e:
        print(f"Error in GET preferences: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/faculty/form-data")
def get_faculty_form_data(
    program_type: str, 
    semester_type: str, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(verify_faculty_role)
):
    prog = ProgramTypeEnum(program_type.upper())
    sem = SemesterTypeEnum(semester_type.upper())
    
    faculty_rec = db.query(models.Faculty).filter_by(user_id=current_user.id).first()
    
    syllabus_records = db.query(models.Syllabus).filter_by(
        program_type=prog, 
        semester_type=sem,
        is_active=True
    ).all()
    
    if not syllabus_records:
        faculty_dept = getattr(faculty_rec, "department", None) if faculty_rec else None
        return {"faculty_department": faculty_dept, "subjects": [], "constraints": []}
        
    faculty_dept = getattr(faculty_rec, "department", None) if faculty_rec else None
    return {
        "faculty_department": faculty_dept,
        "subjects": [
            {
                "subject_code": s.subject_code,
                "course_title": s.course_title,
                "subject_category": s.subject_category,
                "theory_hours_l": s.theory_hours_l,
                "practical_hours_p": s.practical_hours_p,
                "credits_c": s.credits_c
            } for s in syllabus_records
        ]
    }

class CartSubmissionRequest(BaseModel):
    program_type: str
    semester_type: str
    subject_codes: List[str]

@router.post("/api/faculty/submit-cart")
def submit_faculty_cart(
    payload: CartSubmissionRequest,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(verify_faculty_role)
):
    try:
        # Enforce 10-subject maximum cap boundary
        if len(payload.subject_codes) > 10:
            raise HTTPException(status_code=400, detail="Maximum limit of 10 subjects exceeded.")
            
        prog = ProgramTypeEnum(payload.program_type.upper())
        sem = SemesterTypeEnum(payload.semester_type.upper())
        faculty_rec = db.query(models.Faculty).filter_by(user_id=current_user.id).first()
        
        if not faculty_rec:
            raise HTTPException(status_code=400, detail="Faculty profile not found for user.")
            
        faculty_id = faculty_rec.id
        
        if not payload.subject_codes:
            raise HTTPException(status_code=400, detail="Cart is empty.")
            
        with db.begin_nested():
            # Group submitted subjects by category
            subjects = db.query(models.Syllabus).filter(models.Syllabus.subject_code.in_(payload.subject_codes)).all()
            if len(subjects) != len(payload.subject_codes):
                raise HTTPException(status_code=400, detail="One or more subject codes are invalid.")
                
            category_counts = {}
            for s in subjects:
                cat = s.subject_category or "Uncategorized"
                category_counts[cat] = category_counts.get(cat, 0) + 1
                
            constraints = db.query(models.PreferenceConstraint).filter_by(
                program_type=prog, 
                semester_type=sem
            ).all()
            
            constraint_dict = {c.subject_category: c.max_allowed for c in constraints}
            
            for cat, count in category_counts.items():
                max_allowed = constraint_dict.get(cat)
                if max_allowed is not None and count > max_allowed:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Maximum allowed '{cat}' subjects exceeded. Allowed: {max_allowed}, Submitted: {count}."
                    )
            
            # Clear current subject preferences for this faculty.
            db.query(models.SubjectPreference).filter_by(faculty_id=faculty_id).delete()
            
            # Insert new ones
            for sc in payload.subject_codes:
                pref = models.SubjectPreference(
                    faculty_id=faculty_id,
                    subject_code=sc,
                    status='PENDING'
                )
                db.add(pref)
                
        db.commit()
        return {"message": "Cart submitted successfully and is pending approval."}
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
