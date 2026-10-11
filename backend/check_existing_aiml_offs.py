import sys
sys.path.append('.')
from app.database.connection import SessionLocal
from app.models.domain import CurriculumOffering, Subject, Programme

db = SessionLocal()
print('=== EXISTING OFFERINGS FOR PROG 3 (B.Sc AIML) ===')
offs = db.query(CurriculumOffering).filter_by(programme_id=3).all()
print(f'Total offerings: {len(offs)}')
by_sem = {}
for o in offs:
    sub = db.query(Subject).get(o.subject_id)
    by_sem.setdefault(o.semester, []).append((sub.course_code, sub.course_name, o.semester_type.value if hasattr(o.semester_type, 'value') else str(o.semester_type)))

for sem in sorted(by_sem.keys()):
    print(f'Sem {sem} ({len(by_sem[sem])} offerings):')
    for code, name, st in by_sem[sem][:3]:
        print(f'   {code}: {name} ({st})')
db.close()
