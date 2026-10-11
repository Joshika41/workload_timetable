import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal
from app.models.domain import AcademicWorkspace, WorkspaceProgrammeMap

def backfill():
    db = SessionLocal()
    workspaces = db.query(AcademicWorkspace).all()
    count = 0
    for ws in workspaces:
        # Check if map already exists
        exists = db.query(WorkspaceProgrammeMap).filter(
            WorkspaceProgrammeMap.workspace_id == ws.id,
            WorkspaceProgrammeMap.programme_id == ws.programme_id
        ).first()
        
        if not exists:
            mapping = WorkspaceProgrammeMap(
                workspace_id=ws.id,
                programme_id=ws.programme_id
            )
            db.add(mapping)
            count += 1
            
    db.commit()
    print(f"Backfilled {count} workspace-programme mappings.")

if __name__ == "__main__":
    backfill()
