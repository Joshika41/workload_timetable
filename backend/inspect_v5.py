import os
import sys
import pandas as pd

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.database.connection import SessionLocal
from app.models.domain import (
    FacultyProfile, AcademicWorkspace, WorkspaceProgrammeMap,
    FacultyWorkspaceScope, FacultyProgrammeScope, Programme, Department
)
from app.core.workspace import decode_workspace_id

def inspect_v5_files():
    db = SessionLocal()
    workspaces_dir = os.path.join(os.path.dirname(__file__), "data", "institutions", "FLABS", "workspaces")
    
    print("--- ACTUAL WORKBOOK INSPECTION ---")
    
    total_parsed_ws = 0
    total_parsed_prog = 0
    
    for filename in os.listdir(workspaces_dir):
        if not filename.endswith(".xlsx"):
            continue
            
        file_path = os.path.join(workspaces_dir, filename)
        try:
            xl = pd.ExcelFile(file_path)
            
            print(f"\nWorkbook: {filename}")
            
            # Workspace_Programme_Map
            wp_map_count = 0
            if 'Workspace_Programme_Map' in xl.sheet_names:
                df_wp = pd.read_excel(xl, sheet_name='Workspace_Programme_Map', skiprows=1)
                wp_map_count = len(df_wp)
                
            # Faculty
            fac_count = 0
            if 'Faculty' in xl.sheet_names:
                df_fac = pd.read_excel(xl, sheet_name='Faculty', skiprows=1)
                fac_count = len(df_fac)
                
            # Faculty_Workspace_Scope
            ws_scope_count = 0
            if 'Faculty_Workspace_Scope' in xl.sheet_names:
                df_ws = pd.read_excel(xl, sheet_name='Faculty_Workspace_Scope', skiprows=1)
                ws_scope_count = len(df_ws)
                total_parsed_ws += ws_scope_count
                
                print(f"  Workspace Scope Rows: {ws_scope_count}")
                for _, row in df_ws.iterrows():
                    faculty_key = str(row.get('faculty_key', '')).strip()
                    ws_code = str(row.get('workspace_code', '')).strip()
                    print(f"    Parsed Workspace Scope: faculty_key={faculty_key}, workspace_code={ws_code}")
                    
                    if not faculty_key or faculty_key == 'nan':
                        print("      -> Rejected: Empty faculty_key")
                        continue
                        
                    fac = db.query(FacultyProfile).filter_by(erp_id=faculty_key).first()
                    if not fac:
                        print(f"      -> Rejected: Faculty with erp_id {faculty_key} not found in DB")
                        
                    # Let's see what works
                    
            # Faculty_Programme_Scope
            prog_scope_count = 0
            if 'Faculty_Programme_Scope' in xl.sheet_names:
                df_prog = pd.read_excel(xl, sheet_name='Faculty_Programme_Scope', skiprows=1)
                prog_scope_count = len(df_prog)
                total_parsed_prog += prog_scope_count
                
                print(f"  Programme Scope Rows: {prog_scope_count}")
                for _, row in df_prog.iterrows():
                    faculty_key = str(row.get('faculty_key', '')).strip()
                    prog_code = str(row.get('programme_code', '')).strip()
                    print(f"    Parsed Programme Scope: faculty_key={faculty_key}, programme_code={prog_code}")
                    
            print(f"  Summary -> Faculty: {fac_count}, WS Scope: {ws_scope_count}, Prog Scope: {prog_scope_count}, WS Map: {wp_map_count}")
            
        except Exception as e:
            print(f"Error processing {filename}: {e}")

if __name__ == "__main__":
    inspect_v5_files()
