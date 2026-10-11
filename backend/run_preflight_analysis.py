import os
import sys
import json
import pandas as pd
from collections import defaultdict

sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app.database.connection import SessionLocal
from app.models.domain import (
    Institution, Department, Programme, AcademicWorkspace, WorkspaceProgrammeMap,
    FacultyProfile, User, FacultyWorkspaceScope, FacultyProgrammeScope,
    Subject, CurriculumOffering, Section, PreferenceSubmission, SubjectAllocation,
    AcademicYear, Semester
)
from app.core.workspace import encode_workspace_id, WorkspaceContext

cyber_path = os.path.join(BASE_DIR, 'data', 'institutions', 'FLABS', 'workspaces', 'FLABS_Cyber_Security_Department_Master_Data_2026_27_FINAL.xlsx')
aiml_path = os.path.join(BASE_DIR, 'data', 'institutions', 'FLABS', 'workspaces', 'FLABS_AIML_Department_Master_Data_2026_27.xlsx')

def analyze():
    db = SessionLocal()
    print("======================================================================")
    print("                  CURRENT DATABASE BASELINE SNAPSHOT                  ")
    print("======================================================================")
    
    inst_count = db.query(Institution).count()
    dept_count = db.query(Department).count()
    prog_count = db.query(Programme).count()
    ws_count = db.query(AcademicWorkspace).count()
    wp_map_count = db.query(WorkspaceProgrammeMap).count()
    user_count = db.query(User).count()
    fac_count = db.query(FacultyProfile).count()
    subj_count = db.query(Subject).count()
    off_count = db.query(CurriculumOffering).count()
    sec_count = db.query(Section).count()
    pref_count = db.query(PreferenceSubmission).count()
    alloc_count = db.query(SubjectAllocation).count()
    
    print(f"Institutions: {inst_count}")
    print(f"Departments: {dept_count}")
    for d in db.query(Department).all():
        print(f"  - [{d.id}] {d.name} (inst_id={d.institution_id})")
    print(f"Programmes: {prog_count}")
    for p in db.query(Programme).all():
        print(f"  - [{p.id}] {p.name} (type={p.programme_type}, dept_id={p.department_id})")
    print(f"Academic Workspaces: {ws_count}")
    for w in db.query(AcademicWorkspace).all():
        pname = w.programme.name if w.programme else "None"
        print(f"  - WS ID: {w.id} (dept={w.department_id}, prog={w.programme_id} ({pname}), sem={w.semester.semester_number if w.semester else w.semester_id}, year={w.programme_year})")
    print(f"WorkspaceProgrammeMaps: {wp_map_count}")
    for m in db.query(WorkspaceProgrammeMap).all():
        print(f"  - Map: WS={m.workspace_id} -> Prog={m.programme_id}")
    print(f"Users: {user_count}, Faculty Profiles: {fac_count}")
    print(f"Subjects: {subj_count}, Curriculum Offerings: {off_count}")
    print(f"Sections: {sec_count}, Preferences: {pref_count}, Allocations: {alloc_count}")
    
    print("\n======================================================================")
    print("                     CYBER SECURITY PREFLIGHT                         ")
    print("======================================================================")
    xl_cyber = pd.ExcelFile(cyber_path)
    print(f"Source file: {cyber_path}")
    print(f"Sheets: {xl_cyber.sheet_names}")
    
    cyber_depts = pd.read_excel(xl_cyber, 'Departments', header=1)
    print("\nDepartments sheet:")
    print(cyber_depts[['department_code', 'department_name', 'mapping_status']])
    
    cyber_progs = pd.read_excel(xl_cyber, 'Programmes', header=1)
    print("\nProgrammes sheet:")
    print(cyber_progs[['programme_code', 'programme_name', 'level', 'department_code']])
    
    cyber_ws = pd.read_excel(xl_cyber, 'Operational_Workspaces', header=1)
    print("\nOperational Workspaces sheet:")
    print(cyber_ws[['workspace_code', 'workspace_name', 'primary_programme_code']])
    
    cyber_wp = pd.read_excel(xl_cyber, 'Workspace_Programme_Map', header=1)
    print("\nWorkspace_Programme_Map sheet:")
    print(cyber_wp)
    
    cyber_fac = pd.read_excel(xl_cyber, 'Faculty', header=1)
    print(f"\nFaculty sheet ({len(cyber_fac)} rows):")
    print(cyber_fac[['faculty_key', 'faculty_name', 'employee_id', 'designation', 'email']])
    
    cyber_hod = pd.read_excel(xl_cyber, 'HOD_Assignment', header=1)
    print("\nHOD Assignment sheet:")
    print(cyber_hod)
    
    cyber_ws_scope = pd.read_excel(xl_cyber, 'Faculty_Workspace_Scope', header=1)
    print(f"\nFaculty_Workspace_Scope ({len(cyber_ws_scope)} rows):")
    print(cyber_ws_scope)
    
    cyber_prog_scope = pd.read_excel(xl_cyber, 'Faculty_Programme_Scope', header=1)
    print(f"\nFaculty_Programme_Scope ({len(cyber_prog_scope)} rows):")
    print(cyber_prog_scope)
    
    cyber_subj = pd.read_excel(xl_cyber, 'Subjects', header=1)
    print(f"\nSubjects sheet ({len(cyber_subj)} rows):")
    print(cyber_subj.head(10))
    
    cyber_off = pd.read_excel(xl_cyber, 'Curriculum_Offerings', header=1)
    print(f"\nCurriculum Offerings sheet ({len(cyber_off)} rows):")
    print(cyber_off.head(10))
    print(f"Offerings breakdown by programme and semester:")
    print(cyber_off.groupby(['programme_code', 'semester', 'semester_type']).size())
    
    if 'Code_Correction_Audit' in xl_cyber.sheet_names:
        cyber_audit = pd.read_excel(xl_cyber, 'Code_Correction_Audit', header=1)
        print("\nCode Correction Audit:")
        print(cyber_audit)

    print("\n======================================================================")
    print("                          AIML PREFLIGHT                              ")
    print("======================================================================")
    xl_aiml = pd.ExcelFile(aiml_path)
    print(f"Source file: {aiml_path}")
    print(f"Sheets: {xl_aiml.sheet_names}")
    
    dept_sheet = 'Parent_Department' if 'Parent_Department' in xl_aiml.sheet_names else 'Departments'
    aiml_depts = pd.read_excel(xl_aiml, dept_sheet, header=1)
    print(f"\n{dept_sheet} sheet:")
    print(aiml_depts)
    
    prog_sheet = 'Programme' if 'Programme' in xl_aiml.sheet_names else 'Programmes'
    aiml_progs = pd.read_excel(xl_aiml, prog_sheet, header=1)
    print(f"\n{prog_sheet} sheet:")
    print(aiml_progs)
    
    ws_sheet = 'Operational_Workspace' if 'Operational_Workspace' in xl_aiml.sheet_names else 'Operational_Workspaces'
    aiml_ws = pd.read_excel(xl_aiml, ws_sheet, header=1)
    print(f"\n{ws_sheet} sheet:")
    print(aiml_ws)
    
    aiml_wp = pd.read_excel(xl_aiml, 'Workspace_Programme_Map', header=1)
    print("\nWorkspace_Programme_Map sheet:")
    print(aiml_wp)
    
    aiml_fac = pd.read_excel(xl_aiml, 'Faculty', header=1)
    print(f"\nFaculty sheet ({len(aiml_fac)} rows):")
    print(aiml_fac)
    
    aiml_hod = pd.read_excel(xl_aiml, 'HOD_Assignment', header=1)
    print("\nHOD Assignment sheet:")
    print(aiml_hod)
    
    aiml_ws_scope = pd.read_excel(xl_aiml, 'Faculty_Workspace_Scope', header=1)
    print(f"\nFaculty_Workspace_Scope ({len(aiml_ws_scope)} rows):")
    print(aiml_ws_scope)
    
    aiml_prog_scope = pd.read_excel(xl_aiml, 'Faculty_Programme_Scope', header=1)
    print(f"\nFaculty_Programme_Scope ({len(aiml_prog_scope)} rows):")
    print(aiml_prog_scope)
    
    aiml_subj = pd.read_excel(xl_aiml, 'Subjects', header=1)
    print(f"\nSubjects sheet ({len(aiml_subj)} rows):")
    print(aiml_subj.head(10))
    
    aiml_off = pd.read_excel(xl_aiml, 'Curriculum_Offerings', header=1)
    print(f"\nCurriculum Offerings sheet ({len(aiml_off)} rows):")
    print(aiml_off.head(10))
    print(f"Offerings breakdown by programme and semester:")
    print(aiml_off.groupby(['programme_code', 'semester', 'semester_type']).size())
    
    if 'Excluded_Source_Offerings' in xl_aiml.sheet_names:
        aiml_excl = pd.read_excel(xl_aiml, 'Excluded_Source_Offerings', header=1)
        print(f"\nExcluded Source Offerings ({len(aiml_excl)} rows):")
        print(aiml_excl.head(10))
        print("Excluded offerings semester breakdown:")
        print(aiml_excl.groupby(['programme_code', 'semester']).size())

    print("\n======================================================================")
    print("                     IDENTITY & CONFLICT CHECKS                       ")
    print("======================================================================")
    # Check course codes between Cyber Security, AIML, and existing DB
    db_subjects = {s.course_code: s for s in db.query(Subject).all()}
    
    print("\nChecking Cyber Security Subject Codes against DB:")
    for _, row in cyber_subj.iterrows():
        code = str(row['course_code']).strip()
        title = str(row['course_title']).strip()
        if code in db_subjects:
            existing = db_subjects[code]
            print(f"  [MATCH/CONFLICT] {code}: Source Title='{title}' vs DB Title='{existing.course_name}'")

    print("\nChecking AIML Subject Codes against DB:")
    for _, row in aiml_subj.iterrows():
        code = str(row['course_code']).strip()
        title = str(row['course_title']).strip()
        if code in db_subjects:
            existing = db_subjects[code]
            print(f"  [MATCH/CONFLICT] {code}: Source Title='{title}' vs DB Title='{existing.course_name}'")

    # Check faculty employees/emails against DB
    db_fac_erp = {f.erp_id: f for f in db.query(FacultyProfile).all() if f.erp_id}
    db_users_email = {u.email.lower(): u for u in db.query(User).all()}
    
    print("\nChecking Cyber Security Faculty against DB:")
    for _, row in cyber_fac.iterrows():
        emp_id = str(row['employee_id']).strip() if pd.notna(row['employee_id']) else ''
        email = str(row['email']).strip().lower() if pd.notna(row['email']) else ''
        name = str(row['faculty_name']).strip()
        fac_in_db = db_fac_erp.get(emp_id)
        user_in_db = db_users_email.get(email)
        print(f"  Faculty: {name} (Emp: {emp_id}, Email: {email}) -> DB Fac: {fac_in_db.name if fac_in_db else 'None'}, DB User: {user_in_db.id if user_in_db else 'None'}")

    print("\nChecking AIML Faculty against DB:")
    for _, row in aiml_fac.iterrows():
        emp_id = str(row['employee_id']).strip() if pd.notna(row['employee_id']) else ''
        email = str(row['email']).strip().lower() if pd.notna(row['email']) else ''
        name = str(row['faculty_name']).strip()
        fac_in_db = db_fac_erp.get(emp_id)
        user_in_db = db_users_email.get(email)
        print(f"  Faculty: {name} (Emp: {emp_id}, Email: {email}) -> DB Fac: {fac_in_db.name if fac_in_db else 'None'}, DB User: {user_in_db.id if user_in_db else 'None'}")

    db.close()

if __name__ == '__main__':
    analyze()
