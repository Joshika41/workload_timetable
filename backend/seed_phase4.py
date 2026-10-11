import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal, engine
from app.models.domain import (
    Base, Institution, Department, Programme, AcademicYear, Semester,
    AcademicWorkspace, Subject, CurriculumOffering, Section, User,
    FacultyProfile, RoleEnum, SemesterTypeEnum, WorkspaceWorkflowStateEnum,
    PolicyConfig
)
import bcrypt
from app.core.workspace import WorkspaceContext, encode_workspace_id

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def get_or_create(session, model, defaults=None, **kwargs):
    instance = session.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    else:
        params = dict((k, v) for k, v in kwargs.items())
        if defaults:
            params.update(defaults)
        instance = model(**params)
        session.add(instance)
        session.flush()
        return instance, True

def seed_phase4():
    # DO NOT drop all. We want to verify multi-run reproducibility without uncontrolled duplication.
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print(f"Initial DB state: Institutions={db.query(Institution).count()}, Users={db.query(User).count()}")

        # 1. Institutions
        inst_data = [
            ("ET", "E&T"),
            ("FLABS", "Flabs"),
            ("MGMT", "Management"),
            ("BARCH", "B-Arch")
        ]
        institutions = {}
        for code, name in inst_data:
            inst, created = get_or_create(db, Institution, code=code, defaults={"name": name})
            institutions[name] = inst # Keep 'name' as key for backward compat in this script
        
        db.commit()
        print(f"Final DB state: Institutions={db.query(Institution).count()}, Users={db.query(User).count()}")
        print("Seed completed successfully in a reproducible manner.")

    except Exception as e:
        print(f"Error during seed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_phase4()
