import io
import pandas as pd
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from routers.auth import verify_admin_role
import models

router = APIRouter()

@router.get("/api/admin/templates/faculty")
def download_faculty_template(current_user: models.User = Depends(verify_admin_role)):
    df = pd.DataFrame(columns=["ERP ID", "Name", "Designation", "Phone", "Email"])
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Faculty Template')
    buffer.seek(0)
    
    return StreamingResponse(
        buffer, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=faculty_template.xlsx"}
    )

@router.get("/api/admin/templates/syllabus")
def download_syllabus_template(current_user: models.User = Depends(verify_admin_role)):
    df = pd.DataFrame(columns=[
        "Subject Code", "Course Title", "Course Type", "Subject Category", 
        "Theory Hours (L)", "Practical Hours (P)", "Credits (C)"
    ])
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Syllabus Template')
    buffer.seek(0)
    
    return StreamingResponse(
        buffer, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=syllabus_template.xlsx"}
    )

@router.get("/api/admin/templates/cohorts")
def download_cohorts_template(current_user: models.User = Depends(verify_admin_role)):
    df = pd.DataFrame(columns=["Department Name", "Specialization", "Class and Section", "Student Count"])
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Cohorts Template')
    buffer.seek(0)
    
    return StreamingResponse(
        buffer, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=cohorts_template.xlsx"}
    )
