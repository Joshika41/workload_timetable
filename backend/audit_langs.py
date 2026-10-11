import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database.connection import SessionLocal
from app.models.domain import Programme, CurriculumOffering, Subject

def audit_bsc_cs_languages(db):
    print("\n--- BSC CS LANGUAGES AUDIT ---")
    prog = db.query(Programme).filter(Programme.name.ilike('%B.Sc Computer Science%')).first()
    
    offerings = db.query(CurriculumOffering).filter_by(programme_id=prog.id).all()
    langs = []
    for off in offerings:
        sub = db.query(Subject).filter_by(id=off.subject_id).first()
        name = sub.course_name.lower()
        if 'tamil' in name or 'hindi' in name or 'french' in name or 'english' in name:
            langs.append(f"{sub.course_code} - {sub.course_name}")
            
    for l in langs:
        print(l)

if __name__ == '__main__':
    db = SessionLocal()
    audit_bsc_cs_languages(db)
