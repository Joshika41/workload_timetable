import os
from sqlalchemy.orm import Session
from scripts.run_simulation_solve import run_simulation
from app.models.timetable import TimetableConfiguration, TimetableRun, TimetableStatusEnum, TimetableEntry

def generate_timetable(workspace_id: str, db: Session):
    db_url = "sqlite:///simulation.db"
    status, violations, version_id = run_simulation(db_url, seed_db=True)
    
    return {
        "status": status.name if hasattr(status, 'name') else str(status),
        "violations": violations,
        "version_id": version_id
    }

def get_timetable_versions(workspace_id: str, db: Session):
    from app.models.timetable import TimetableVersion, TimetableRun, TimetableConfiguration
    config = db.query(TimetableConfiguration).filter_by(workspace_id=workspace_id).first()
    if not config:
        return []
    
    versions = db.query(TimetableVersion).join(TimetableRun).filter(
        TimetableRun.configuration_id == config.id
    ).order_by(TimetableVersion.id.desc()).all()
    
    results = []
    for v in versions:
        run = db.query(TimetableRun).get(v.run_id)
        results.append({
            "id": v.id,
            "status": v.status.name,
            "created_at": v.created_at,
            "run_id": run.id,
            "solver_status": run.status.name,
            "violations": run.hard_violation_count
        })
    return results

def publish_timetable_version(version_id: int, db: Session):
    from app.models.timetable import TimetableVersion, TimetableVersionStatusEnum, TimetableRun
    
    version_to_publish = db.query(TimetableVersion).get(version_id)
    if not version_to_publish:
        raise Exception("Version not found")
        
    run = db.query(TimetableRun).get(version_to_publish.run_id)
    
    older_versions = db.query(TimetableVersion).join(TimetableRun).filter(
        TimetableRun.configuration_id == run.configuration_id,
        TimetableVersion.status == TimetableVersionStatusEnum.PUBLISHED
    ).all()
    
    for v in older_versions:
        v.status = TimetableVersionStatusEnum.SUPERSEDED
        
    version_to_publish.status = TimetableVersionStatusEnum.PUBLISHED
    db.commit()
    return {"status": "success", "published_version_id": version_id}

def get_timetable_entries_for_workspace(workspace_id: str, db: Session, version_id: int = None):
    from app.models.timetable import TimetableConfiguration, TimetableRun, TimetableVersion, TimetableVersionStatusEnum
    config = db.query(TimetableConfiguration).filter_by(workspace_id=workspace_id).first()
    if not config:
        return []
    
    if version_id:
        version = db.query(TimetableVersion).get(version_id)
    else:
        version = db.query(TimetableVersion).join(TimetableRun).filter(
            TimetableRun.configuration_id == config.id,
            TimetableVersion.status == TimetableVersionStatusEnum.PUBLISHED
        ).order_by(TimetableVersion.id.desc()).first()
        
    if not version:
        return []
        
    entries = db.query(TimetableEntry).filter_by(timetable_version_id=version.id).all()
    
    from sqlalchemy.orm import joinedload
    from app.models.domain import FacultyProfile
    from app.models.timetable import TimetableRoom, TeachingSession, SynchronizedGroupMember
    
    results = []
    for e in entries:
        ts = db.query(TeachingSession).get(e.teaching_session_id)
        room = db.query(TimetableRoom).get(e.room_id) if e.room_id else None
        
        fac = db.query(FacultyProfile).filter_by(id=ts.faculty_id).first()
        
        section_names = []
        if ts.synchronization_group_id:
            sgms = db.query(SynchronizedGroupMember).filter_by(teaching_session_id=ts.id).all()
            for sgm in sgms:
                from app.models.domain import Section
                sec = db.query(Section).get(sgm.section_id)
                if sec and sec.name not in section_names:
                    section_names.append(sec.name)
        
        from app.models.domain import Section
        if not section_names and ts.section_id:
            sec = db.query(Section).get(ts.section_id)
            if sec:
                section_names.append(sec.name)
                
        from app.models.domain import SubjectAllocation, Subject
        alloc = db.query(SubjectAllocation).get(ts.allocation_id)
        subject = db.query(Subject).get(alloc.subject_id) if alloc else None
        
        results.append({
            "id": e.id,
            "day_index": e.day_index,
            "period_number": e.start_period,
            "duration": ts.duration_in_periods,
            "teaching_type": ts.teaching_type,
            "room": room.room_code if room else "TBA",
            "faculty": fac.name if fac else "Unknown",
            "faculty_id": fac.id if fac else None,
            "user_id": fac.user_id if fac else None,
            "subject": subject.course_name if subject else "Unknown",
            "subject_code": subject.course_code if subject else "Unknown",
            "sections": section_names
        })
        
    return {
        "version_id": version.id,
        "status": version.status.name,
        "created_at": version.created_at,
        "entries": results
    }
