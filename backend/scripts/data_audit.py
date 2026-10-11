import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.domain import (
    Institution, Department, Programme, AcademicWorkspace, Subject,
    CurriculumOffering, Section, FacultyProfile
)

def run():
    db = SessionLocal()
    try:
        print(f"Institutions: {db.query(Institution).count()}")
        for inst in db.query(Institution).all():
            print(f"  - {inst.name} ({inst.code})")
        
        print(f"Departments: {db.query(Department).count()}")
        print(f"Programmes: {db.query(Programme).count()}")
        print(f"Academic Contexts / Workspaces: {db.query(AcademicWorkspace).count()}")
        print(f"Subjects: {db.query(Subject).count()}")
        print(f"Curriculum Offerings: {db.query(CurriculumOffering).count()}")
        print(f"Sections: {db.query(Section).count()}")
        print(f"Faculty: {db.query(FacultyProfile).count()}")
        
    finally:
        db.close()

if __name__ == "__main__":
    run()
