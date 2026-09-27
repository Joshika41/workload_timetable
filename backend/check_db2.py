from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.domain import AcademicWorkspace

db = SessionLocal()
workspaces = db.query(AcademicWorkspace).all()
print("\n--- WORKSPACES ---")
for w in workspaces:
    print(w.id, w.department_id)
