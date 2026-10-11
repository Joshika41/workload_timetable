import os
import sys
import pandas as pd

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database.connection import SessionLocal
from app.models.domain import (
    FacultyProfile, AcademicWorkspace, WorkspaceProgrammeMap,
    FacultyWorkspaceScope, FacultyProgrammeScope, Programme
)

def get_faculty(db, faculty_key):
    # Try exact match
    fac = db.query(FacultyProfile).filter_by(erp_id=faculty_key).first()
    if fac: return fac
    
    # Try stripping FLABS-DS- or FLABS-
    if faculty_key.startswith("FLABS-DS-"):
        stripped = faculty_key.replace("FLABS-DS-", "")
        fac = db.query(FacultyProfile).filter_by(erp_id=stripped).first()
        if fac: return fac
    elif faculty_key.startswith("FLABS-"):
        stripped = faculty_key.replace("FLABS-", "")
        fac = db.query(FacultyProfile).filter_by(erp_id=stripped).first()
        if fac: return fac
        
    return None

def process_v5_files():
    db = SessionLocal()
    workspaces_dir = os.path.join(os.path.dirname(__file__), "data", "institutions", "FLABS", "workspaces")
    
    inserted_ws_scope = 0
    inserted_prog_scope = 0
    rejected = 0
    
    for filename in os.listdir(workspaces_dir):
        if not filename.endswith(".xlsx"):
            continue
            
        file_path = os.path.join(workspaces_dir, filename)
        try:
            xl = pd.ExcelFile(file_path)
            
            # Map FLABS-WS-xxx to AcademicWorkspace by looking at the primary programme in this file
            workspace_mapping = {}
            if 'Workspace_Programme_Map' in xl.sheet_names:
                df_wp = pd.read_excel(xl, sheet_name='Workspace_Programme_Map', skiprows=1)
                for _, row in df_wp.iterrows():
                    ws_code = str(row.get('workspace_code', '')).strip()
                    prog_code = str(row.get('programme_code', '')).strip()
                    
                    # In our DB, Programme names might be exactly prog_code or stripped of FLABS-
                    prog_name = prog_code.replace("FLABS-", "").replace("-", " ")
                    # Some hardcoded fix for MCA GEN AI
                    if prog_code == "FLABS-MCA-GENAI":
                        prog_name = "MCA GEN AI"
                    elif prog_code == "FLABS-MCA":
                        prog_name = "MCA"
                    elif prog_code == "FLABS-BSC-CS":
                        prog_name = "B.Sc Computer Science"
                    elif prog_code == "FLABS-BCA-DS":
                        prog_name = "BCA Data Science"
                        
                    prog = db.query(Programme).filter(Programme.name.ilike(f"%{prog_name}%")).first()
                    if prog:
                        # Find workspace with this programme_id
                        ws = db.query(AcademicWorkspace).filter_by(programme_id=prog.id).first()
                        if ws:
                            workspace_mapping[ws_code] = ws
            
            # Faculty Workspace Scope
            if 'Faculty_Workspace_Scope' in xl.sheet_names:
                df_ws = pd.read_excel(xl, sheet_name='Faculty_Workspace_Scope', skiprows=1)
                for _, row in df_ws.iterrows():
                    faculty_key = str(row.get('faculty_key', '')).strip()
                    ws_code = str(row.get('workspace_code', '')).strip()
                    
                    if not faculty_key or faculty_key == 'nan':
                        continue
                        
                    fac = get_faculty(db, faculty_key)
                    ws = workspace_mapping.get(ws_code)
                    
                    if fac and ws:
                        exists = db.query(FacultyWorkspaceScope).filter_by(
                            faculty_id=fac.id, workspace_id=ws.id
                        ).first()
                        if not exists:
                            db.add(FacultyWorkspaceScope(faculty_id=fac.id, workspace_id=ws.id))
                            inserted_ws_scope += 1
                    else:
                        print(f"Rejected WS Scope: {faculty_key} / {ws_code} (fac={fac is not None}, ws={ws is not None})")
                        rejected += 1

            # Faculty Programme Scope
            if 'Faculty_Programme_Scope' in xl.sheet_names:
                df_prog = pd.read_excel(xl, sheet_name='Faculty_Programme_Scope', skiprows=1)
                for _, row in df_prog.iterrows():
                    faculty_key = str(row.get('faculty_key', '')).strip()
                    prog_code = str(row.get('programme_code', '')).strip()
                    
                    if not faculty_key or faculty_key == 'nan':
                        continue
                        
                    fac = get_faculty(db, faculty_key)
                    
                    prog_name = prog_code.replace("FLABS-", "").replace("-", " ")
                    if prog_code == "FLABS-MCA-GENAI":
                        prog_name = "MCA GEN AI"
                    elif prog_code == "FLABS-MCA":
                        prog_name = "MCA"
                    elif prog_code == "FLABS-BSC-CS":
                        prog_name = "B.Sc Computer Science"
                    elif prog_code == "FLABS-BCA-DS":
                        prog_name = "BCA Data Science"
                        
                    prog = db.query(Programme).filter(Programme.name.ilike(f"%{prog_name}%")).first()
                    
                    if fac and prog:
                        exists = db.query(FacultyProgrammeScope).filter_by(
                            faculty_id=fac.id, programme_id=prog.id
                        ).first()
                        if not exists:
                            db.add(FacultyProgrammeScope(faculty_id=fac.id, programme_id=prog.id))
                            inserted_prog_scope += 1
                    else:
                        print(f"Rejected Prog Scope: {faculty_key} / {prog_code} (fac={fac is not None}, prog={prog is not None})")
                        rejected += 1
                            
        except Exception as e:
            print(f"Error processing {filename}: {e}")
            
    db.commit()
    print(f"Inserted {inserted_ws_scope} Faculty Workspace Scopes")
    print(f"Inserted {inserted_prog_scope} Faculty Programme Scopes")
    print(f"Rejected {rejected} rows")

    # Verification: MCA Workspace count
    mca_prog = db.query(Programme).filter_by(name="MCA").first()
    if mca_prog:
        mca_ws = db.query(AcademicWorkspace).filter_by(programme_id=mca_prog.id).first()
        if mca_ws:
            count = db.query(FacultyWorkspaceScope).filter_by(workspace_id=mca_ws.id).count()
            print(f"MCA Workspace Scopes: {count}")
            
            siva = db.query(FacultyProfile).filter_by(erp_id="TSH281").first()
            if siva:
                siva_mca = db.query(FacultyWorkspaceScope).filter_by(workspace_id=mca_ws.id, faculty_id=siva.id).first()
                print(f"Dr. R. Sivasankari mapped to MCA Workspace: {siva_mca is not None}")

if __name__ == "__main__":
    process_v5_files()
