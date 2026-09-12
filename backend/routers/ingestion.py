from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import io
import os
import uuid
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import SessionLocal

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
import models
from models import Syllabus, User, Faculty, ProgramTypeEnum, SemesterTypeEnum, RoleEnum
from routers.auth import verify_admin_role, get_password_hash

router = APIRouter()

def safe_int(val):
    try:
        if val == "" or pd.isna(val):
            return 0
        return int(float(val))
    except:
        return 0

@router.post("/api/admin/upload-faculty")
async def upload_faculty_onboarding(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(verify_admin_role)
):
    try:
        contents = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid or corrupted Excel file. Please check the format.")
        
        df.columns = [str(c).strip().lower().replace(' ', '_').replace('\n', '') for c in df.columns]
        df.dropna(how='all', inplace=True)
        df.fillna("", inplace=True)
        
        erp_col = next((c for c in df.columns if 'erp' in c or 'emp' in c or c == 'id'), None)
        name_col = next((c for c in df.columns if 'name' in c), None)
        dept_col = next((c for c in df.columns if 'dept' in c or 'department' in c), None)
        desig_col = next((c for c in df.columns if 'desig' in c), None)
        email_col = next((c for c in df.columns if 'mail' in c), None)

        if not erp_col or not name_col:
            raise HTTPException(status_code=400, detail="Excel must contain an ERP ID and Name column.")

        emails_to_dispatch = []
        upserted_count = 0

        smtp_host = os.environ.get('SMTP_HOST')
        smtp_user = os.environ.get('SMTP_USER')
        smtp_pass = os.environ.get('SMTP_PASS')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        
        for _, row in df.iterrows():
            try:
                erp_id = str(row.get(erp_col)).strip()
                name = str(row.get(name_col)).strip()
                
                if not name or not erp_id:
                    continue

                desig = str(row.get(desig_col)).strip() if desig_col else "Faculty"
                off_email = str(row.get(email_col)).strip() if email_col else ""

                is_quarantined = False
                skip_email = False
                
                if "new" in erp_id.lower() or erp_id == "":
                    erp_id = f"TEMP-{uuid.uuid4().hex[:8].upper()}"
                    is_quarantined = True
                    skip_email = True
                
                temp_password = secrets.token_urlsafe(8)
                fallback_email = f"{erp_id}@srmist.edu.in"
                final_email = off_email if off_email else fallback_email
                
                existing_user = db.query(models.User).filter(models.User.email == final_email).first()
                if not existing_user:
                    user_record = models.User(
                        email=final_email,
                        hashed_password=get_password_hash(temp_password),
                        role=RoleEnum.FACULTY,
                        is_active=True
                    )
                    db.add(user_record)
                    db.commit()
                    db.refresh(user_record)
                    user_id = user_record.id
                else:
                    user_id = existing_user.id
                    
                existing_faculty = db.query(models.Faculty).filter_by(erp_id=erp_id).first()
                if not existing_faculty:
                    faculty = models.Faculty(
                        user_id=user_id,
                        name=name,
                        erp_id=erp_id,
                        designation=desig,
                        max_theory_hrs=0.0,
                        max_lab_hrs=0.0
                    )
                    db.add(faculty)
                    db.commit()
                    upserted_count += 1
                    
                    if not skip_email and off_email:
                        emails_to_dispatch.append({
                            "email": off_email,
                            "name": name,
                            "password": temp_password,
                            "erp_id": erp_id
                        })
            except Exception as row_error:
                db.rollback()
                print(f"Skipped bad faculty row {erp_id}: {row_error}")
                continue

        for email_data in emails_to_dispatch:
            msg_body = f"Hello {email_data['name']},\n\nYour ERP Account has been provisioned.\nLogin ID: {email_data['email']}\nPassword: {email_data['password']}\n\nPlease login to review your workload allocations."
            if smtp_host and smtp_user and smtp_pass:
                try:
                    msg = MIMEMultipart()
                    msg['From'] = smtp_user
                    msg['To'] = email_data['email']
                    msg['Subject'] = "Welcome to the University Workload ERP"
                    msg.attach(MIMEText(msg_body, 'plain'))
                    
                    server = smtplib.SMTP(smtp_host, smtp_port)
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
                    server.quit()
                except Exception as e:
                    print(f"[SMTP FAIL] Could not send to {email_data['email']}: {e}")
            else:
                print(f"[SMTP MOCK] Email ready for {email_data['email']}")

        return {"message": "Faculty onboarded successfully.", "upserted": upserted_count, "emails_dispatched": len(emails_to_dispatch)}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File parsing error: {str(e)}")

@router.post("/api/admin/upload-syllabus")
async def upload_syllabus_phase2(
    file: UploadFile = File(...), 
    program_type: str = Form(...),
    semester_type: str = Form(...),
    department_id: int = Form(...),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(verify_admin_role)
):
    try:
        contents = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid or corrupted Excel file. Please check the format.")
        
        df.columns = [str(c).strip().lower().replace(' ', '_').replace('\n', '') for c in df.columns]
        df.dropna(how='all', inplace=True)
        df.fillna("", inplace=True)
        
        batch_sync_id = uuid.uuid4().hex
        prog = ProgramTypeEnum(program_type.upper())
        sem = SemesterTypeEnum(semester_type.upper())
        
        code_col = next((c for c in df.columns if 'code' in c), None)
        title_col = next((c for c in df.columns if 'title' in c or 'name' in c or 'subject' in c), None)
        type_col = next((c for c in df.columns if 'type' in c), None)
        cat_col = next((c for c in df.columns if 'category' in c), None)
        th_col = next((c for c in df.columns if 'theory' in c or c == 'l'), None)
        pr_col = next((c for c in df.columns if 'practical' in c or c == 'p'), None)
        cr_col = next((c for c in df.columns if 'credit' in c or c == 'c'), None)

        if not code_col:
            raise HTTPException(status_code=400, detail="Could not find Subject Code column.")

        upserted = 0
        
        for _, row in df.iterrows():
            try:
                sub_code = str(row.get(code_col)).strip()
                if not sub_code:
                    continue
                
                title = str(row.get(title_col)).strip() if title_col else ""
                c_type = str(row.get(type_col)).strip() if type_col else "Theory"
                category = str(row.get(cat_col)).strip() if cat_col else "Core"
                
                th_hrs = safe_int(row.get(th_col)) if th_col else 0
                pr_hrs = safe_int(row.get(pr_col)) if pr_col else 0
                cr = safe_int(row.get(cr_col)) if cr_col else 0

                existing = db.query(Syllabus).filter_by(subject_code=sub_code).first()
                if existing:
                    existing.course_title = title
                    existing.course_type = c_type
                    existing.subject_category = category
                    existing.theory_hours_l = th_hrs
                    existing.practical_hours_p = pr_hrs
                    existing.credits_c = cr
                    existing.program_type = prog
                    existing.semester_type = sem
                    existing.batch_sync_id = batch_sync_id
                    existing.is_active = True
                else:
                    new_sub = Syllabus(
                        subject_code=sub_code,
                        course_title=title,
                        course_type=c_type,
                        subject_category=category,
                        theory_hours_l=th_hrs,
                        practical_hours_p=pr_hrs,
                        credits_c=cr,
                        program_type=prog,
                        semester_type=sem,
                        category="UG" if prog == ProgramTypeEnum.UG else "PG",
                        batch_sync_id=batch_sync_id,
                        is_active=True
                    )
                    db.add(new_sub)
                
                db.commit()
                upserted += 1
            except Exception as row_error:
                db.rollback()
                print(f"Skipped bad syllabus row {sub_code}: {row_error}")
                continue

        try:
            soft_deleted = db.query(Syllabus).filter(
                Syllabus.program_type == prog,
                Syllabus.semester_type == sem,
                (Syllabus.batch_sync_id != batch_sync_id) | (Syllabus.batch_sync_id == None)
            ).update({"is_active": False}, synchronize_session=False)
            db.commit()
        except:
            db.rollback()
            soft_deleted = 0

        
        # Auto-generate mappings for newly inserted syllabus
        active_cohorts = db.query(models.Cohort).filter(
            models.Cohort.program_type == prog,
            models.Cohort.semester_type == sem,
            models.Cohort.is_active == True
        ).all()
        
        # We need all active syllabus to remap
        active_syllabus = db.query(Syllabus).filter(
            Syllabus.program_type == prog,
            Syllabus.semester_type == sem,
            Syllabus.is_active == True
        ).all()

        for syl in active_syllabus:
            for c in active_cohorts:
                existing_map = db.query(models.CohortSyllabusMapping).filter(
                    models.CohortSyllabusMapping.cohort_id == c.id,
                    models.CohortSyllabusMapping.subject_code == syl.subject_code
                ).first()
                if not existing_map:
                    db.add(models.CohortSyllabusMapping(cohort_id=c.id, subject_code=syl.subject_code))

        db.commit()

        return {"message": "Syllabus synced successfully", "upserted": upserted, "soft_deleted": soft_deleted}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File parsing error: {str(e)}")


@router.post("/api/admin/upload-cohorts")
async def upload_cohorts_phase2(
    file: UploadFile = File(...), 
    program_type: str = Form(...),
    semester_type: str = Form(...),
    department_id: int = Form(...),
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(verify_admin_role)
):
    try:
        contents = await file.read()
        try:
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid or corrupted Excel file. Please check the format.")
        
        df.columns = [str(c).strip().lower().replace(' ', '_').replace('\n', '') for c in df.columns]
        df.dropna(how='all', inplace=True)
        df.fillna("", inplace=True)
        
        prog = ProgramTypeEnum(program_type.upper())
        sem = SemesterTypeEnum(semester_type.upper())
        
        dept = db.query(models.Department).filter(models.Department.id == department_id).first()
        dept_name = dept.name if dept else "Unknown"
        
        ay_col = next((c for c in df.columns if 'year' in c or 'ay' in c), None)
        class_col = next((c for c in df.columns if 'class' in c or 'name' in c or 'cohort' in c), None)
        sec_col = next((c for c in df.columns if 'sec' in c), None)
        
        if not class_col:
            raise HTTPException(status_code=400, detail="Could not find Class Name column.")
            
        upserted = 0
        
        # Soft delete existing to replace
        db.query(models.Cohort).filter(
            models.Cohort.department_id == department_id,
            models.Cohort.program_type == prog,
            models.Cohort.semester_type == sem
        ).update({"is_active": False}, synchronize_session=False)
        db.commit()
        
        for _, row in df.iterrows():
            try:
                c_name = str(row.get(class_col)).strip()
                if not c_name:
                    continue
                ay = safe_int(row.get(ay_col)) if ay_col else 1
                sec = str(row.get(sec_col)).strip() if sec_col else "A"
                
                existing = db.query(models.Cohort).filter(
                    models.Cohort.department_id == department_id,
                    models.Cohort.program_type == prog,
                    models.Cohort.semester_type == sem,
                    models.Cohort.academic_year == ay,
                    models.Cohort.class_name == c_name,
                    models.Cohort.section == sec
                ).first()
                
                if existing:
                    existing.is_active = True
                else:
                    new_cohort = models.Cohort(
                        department_id=department_id,
                        department=dept_name,
                        academic_year=ay,
                        class_name=c_name,
                        section=sec,
                        program_type=prog,
                        semester_type=sem,
                        is_active=True
                    )
                    db.add(new_cohort)
                
                upserted += 1
            except Exception as e:
                print(f"Skipped cohort row: {e}")
                continue
        
        db.commit()
        
        # Auto-generate mappings
        active_syllabus = db.query(models.Syllabus).filter(
            models.Syllabus.program_type == prog,
            models.Syllabus.semester_type == sem,
            models.Syllabus.is_active == True
        ).all()
        
        active_cohorts = db.query(models.Cohort).filter(
            models.Cohort.program_type == prog,
            models.Cohort.semester_type == sem,
            models.Cohort.is_active == True
        ).all()
        
        for c in active_cohorts:
            for syl in active_syllabus:
                existing_map = db.query(models.CohortSyllabusMapping).filter(
                    models.CohortSyllabusMapping.cohort_id == c.id,
                    models.CohortSyllabusMapping.subject_code == syl.subject_code
                ).first()
                if not existing_map:
                    db.add(models.CohortSyllabusMapping(cohort_id=c.id, subject_code=syl.subject_code))

        db.commit()
        return {"message": "Cohorts synced and mapped successfully", "upserted": upserted}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"File parsing error: {str(e)}")


from pydantic import BaseModel
from typing import Optional

class SyllabusUpdate(BaseModel):
    course_title: str
    course_type: str
    theory_hours_l: int
    practical_hours_p: int
    credits_c: int

class CohortUpdate(BaseModel):
    academic_year: int
    class_name: str
    section: str

@router.get("/api/admin/syllabus")
def get_syllabus(department_id: int, program_type: str, semester_type: str, db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    prog = ProgramTypeEnum(program_type.upper())
    sem = SemesterTypeEnum(semester_type.upper())
    
    # Needs to match through cohort mapping to filter by department exactly
    # But for a simpler setup, syllabus often belongs to department via relations or direct column
    # Currently syllabus has department_id
    syllabi = db.query(Syllabus).filter(
        Syllabus.program_type == prog,
        Syllabus.semester_type == sem,
        Syllabus.is_active == True,
        # Syllabus.department_id == department_id # if it has it
    ).all()
    return syllabi

@router.put("/api/admin/syllabus/{subject_code}")
def update_syllabus(subject_code: str, payload: SyllabusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    syl = db.query(Syllabus).filter(Syllabus.subject_code == subject_code, Syllabus.is_active == True).first()
    if not syl:
        raise HTTPException(status_code=404, detail="Syllabus not found")
    
    syl.course_title = payload.course_title
    syl.course_type = payload.course_type
    syl.theory_hours_l = payload.theory_hours_l
    syl.practical_hours_p = payload.practical_hours_p
    syl.credits_c = payload.credits_c
    db.commit()
    return {"message": "Syllabus updated successfully"}

@router.get("/api/admin/cohorts")
def get_cohorts(department_id: int, program_type: str, semester_type: str, db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    prog = ProgramTypeEnum(program_type.upper())
    sem = SemesterTypeEnum(semester_type.upper())
    cohorts = db.query(models.Cohort).filter(
        models.Cohort.department_id == department_id,
        models.Cohort.program_type == prog,
        models.Cohort.semester_type == sem,
        models.Cohort.is_active == True
    ).all()
    return cohorts

@router.put("/api/admin/cohorts/{cohort_id}")
def update_cohort(cohort_id: int, payload: CohortUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(verify_admin_role)):
    cohort = db.query(models.Cohort).filter(models.Cohort.id == cohort_id, models.Cohort.is_active == True).first()
    if not cohort:
        raise HTTPException(status_code=404, detail="Cohort not found")
    
    cohort.academic_year = payload.academic_year
    cohort.class_name = payload.class_name
    cohort.section = payload.section
    db.commit()
    return {"message": "Cohort updated successfully"}

