import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database.connection import SessionLocal
from app.models.domain import (
    FacultyProfile, FacultyWorkspaceScope, FacultyProgrammeScope,
    AcademicWorkspace, Programme, Subject, CurriculumOffering,
    WorkspaceProgrammeMap
)

def audit_sivasankari(db):
    print("--- SIVASANKARI AUDIT ---")
    siva = db.query(FacultyProfile).filter_by(erp_id='TSH281').first()
    if not siva:
        print("Not found.")
        return
        
    print(f"Name: {siva.name}, ERP: {siva.erp_id}")
    
    ws_scopes = db.query(FacultyWorkspaceScope).filter_by(faculty_id=siva.id).all()
    print(f"Workspace Scopes count: {len(ws_scopes)}")
    for sc in ws_scopes:
        ws = db.query(AcademicWorkspace).filter_by(id=sc.workspace_id).first()
        prog = db.query(Programme).filter_by(id=ws.programme_id).first() if ws else None
        print(f"  Workspace: {sc.workspace_id} -> Prog: {prog.name if prog else 'Unknown'}")
        
    prog_scopes = db.query(FacultyProgrammeScope).filter_by(faculty_id=siva.id).all()
    print(f"Programme Scopes count: {len(prog_scopes)}")
    for psc in prog_scopes:
        prog = db.query(Programme).filter_by(id=psc.programme_id).first()
        print(f"  Programme: {prog.name if prog else 'Unknown'}")

def audit_cs_faculty(db):
    print("\n--- CS FACULTY AUDIT ---")
    fac = db.query(FacultyProfile).filter_by(erp_id='TSH252').first() # Just an example, maybe check others
    if not fac:
        print("TSH252 not found.")
        return
    print(f"CS Faculty: {fac.name}, ERP: {fac.erp_id}")

def audit_bsc_cs_curriculum(db):
    print("\n--- BSC CS CURRICULUM AUDIT ---")
    prog = db.query(Programme).filter(Programme.name.ilike('%B.Sc Computer Science%')).first()
    if not prog:
        print("Programme not found.")
        return
        
    offerings = db.query(CurriculumOffering).filter_by(programme_id=prog.id).all()
    print(f"Offerings count: {len(offerings)}")
    for off in offerings[:10]:
        sub = db.query(Subject).filter_by(id=off.subject_id).first()
        if sub and sub.category != 'CORE':
            print(f"  Sub: {sub.course_code} - {sub.course_name} (Cat: {sub.category})")

if __name__ == '__main__':
    db = SessionLocal()
    audit_sivasankari(db)
    audit_cs_faculty(db)
    audit_bsc_cs_curriculum(db)
