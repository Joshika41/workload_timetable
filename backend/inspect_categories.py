import sys
from app.database.connection import SessionLocal
from app.models.domain import Programme, CurriculumOffering, Subject, SemesterTypeEnum

db = SessionLocal()
try:
    for p in db.query(Programme).all():
        for st in [SemesterTypeEnum.ODD, SemesterTypeEnum.EVEN]:
            offs = db.query(CurriculumOffering).join(Subject).filter(
                CurriculumOffering.programme_id == p.id,
                CurriculumOffering.semester_type == st,
                CurriculumOffering.requires_preference == True
            ).all()
            by_sem = {}
            for o in offs:
                by_sem.setdefault(o.semester, []).append(o.subject.category.upper())
            for sem, cats in by_sem.items():
                has_core = any(c == 'CORE' for c in cats)
                has_elec = any(c in ('ELECTIVE', 'DISCIPLINE_ELECTIVE') for c in cats)
                if not (has_core and has_elec):
                    print(f"{p.name} Sem {sem} ({st.value}): core={has_core}, elec={has_elec}, cats={set(cats)}")
finally:
    db.close()
