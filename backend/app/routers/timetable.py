from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import Optional
import os

from app.services.timetable_service import generate_timetable, get_timetable_entries_for_workspace, get_timetable_versions, publish_timetable_version

router = APIRouter()

def get_sim_db():
    db_url = "sqlite:///simulation.db"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/generate/{workspace_id}")
def api_generate_timetable(workspace_id: str, db: Session = Depends(get_sim_db)):
    result = generate_timetable(workspace_id, db)
    return result

@router.get("/versions/{workspace_id}")
def api_get_timetable_versions(workspace_id: str, db: Session = Depends(get_sim_db)):
    return get_timetable_versions(workspace_id, db)

@router.post("/publish/{version_id}")
def api_publish_timetable(version_id: int, db: Session = Depends(get_sim_db)):
    try:
        return publish_timetable_version(version_id, db)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/workspace/{workspace_id}")
def api_get_timetable(workspace_id: str, version_id: Optional[int] = None, db: Session = Depends(get_sim_db)):
    result = get_timetable_entries_for_workspace(workspace_id, db, version_id)
    if not result:
        return {"version_id": None, "status": "NOT_FOUND", "entries": []}
    return result
