from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.domain import AcademicWorkspace, User, Department

db = SessionLocal()

print("--- DEPARTMENTS ---")
for d in db.query(Department).all():
    print(d.id, d.name)

print("\n--- USERS ---")
for u in db.query(User).all():
    print(u.id, u.email, u.department_id)

print("\n--- WORKSPACES ---")
for w in db.query(AcademicWorkspace).all():
    print(w.id, w.department_id, w.programme_name)
