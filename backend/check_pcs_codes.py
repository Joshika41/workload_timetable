import sys
sys.path.append('.')
from app.database.connection import SessionLocal
from app.models.domain import Subject, CurriculumOffering, Programme

db = SessionLocal()
codes = ['PCS25D13J', 'PCS25G11J', 'PCS25D22J', 'PCS25D23J', 'PCS25C31J', 'PCS25D32J', 'PCS25D33J', 'UCD24V01T']
for code in codes:
    subj = db.query(Subject).filter_by(course_code=code).first()
    if subj:
        offs = db.query(CurriculumOffering).filter_by(subject_id=subj.id).all()
        progs = [db.query(Programme).filter_by(id=o.programme_id).first().name for o in offs]
        print(f'{code} in DB: "{subj.course_name}", Used in Programmes: {progs}')
    else:
        print(f'{code} NOT in DB')
db.close()
