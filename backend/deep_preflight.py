import os
import sys
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

cyber_path = os.path.join(BASE_DIR, 'data', 'institutions', 'FLABS', 'workspaces', 'FLABS_Cyber_Security_Department_Master_Data_2026_27_FINAL.xlsx')
aiml_path = os.path.join(BASE_DIR, 'data', 'institutions', 'FLABS', 'workspaces', 'FLABS_AIML_Department_Master_Data_2026_27.xlsx')

def run_deep_preflight():
    db = SessionLocal()
    
    xl_c = pd.ExcelFile(cyber_path)
    xl_a = pd.ExcelFile(aiml_path)
    
    # 1. Existing DB State
    print("=== 1. DATABASE BASELINE COUNTS ===")
    counts = {
        'institutions': db.query(Institution).count(),
        'departments': db.query(Department).count(),
        'programmes': db.query(Programme).count(),
        'workspaces': db.query(AcademicWorkspace).count(),
        'workspace_programme_maps': db.query(WorkspaceProgrammeMap).count(),
        'users': db.query(User).count(),
        'faculty_profiles': db.query(FacultyProfile).count(),
        'faculty_workspace_scopes': db.query(FacultyWorkspaceScope).count(),
        'faculty_programme_scopes': db.query(FacultyProgrammeScope).count(),
        'subjects': db.query(Subject).count(),
        'curriculum_offerings': db.query(CurriculumOffering).count(),
        'sections': db.query(Section).count(),
        'preference_submissions': db.query(PreferenceSubmission).count(),
        'subject_allocations': db.query(SubjectAllocation).count()
    }
    for k, v in counts.items():
        print(f"  {k}: {v}")
        
    db_subjects = {s.course_code: s for s in db.query(Subject).all()}
    
    # 2. Cyber Security Workbook Analysis
    print("\n=== 2. CYBER SECURITY WORKBOOK ANALYSIS ===")
    c_depts = pd.read_excel(xl_c, 'Departments', header=1)
    c_progs = pd.read_excel(xl_c, 'Programmes', header=1)
    c_ops = pd.read_excel(xl_c, 'Operational_Workspaces', header=1)
    c_wpm = pd.read_excel(xl_c, 'Workspace_Programme_Map', header=1)
    c_ctx = pd.read_excel(xl_c, 'Academic_Contexts', header=1)
    c_subj = pd.read_excel(xl_c, 'Subjects', header=1)
    c_off = pd.read_excel(xl_c, 'Curriculum_Offerings', header=1)
    c_fac = pd.read_excel(xl_c, 'Faculty', header=1)
    c_fws = pd.read_excel(xl_c, 'Faculty_Workspace_Scope', header=1)
    c_fps = pd.read_excel(xl_c, 'Faculty_Programme_Scope', header=1)
    c_hod = pd.read_excel(xl_c, 'HOD_Assignment', header=1)
    
    print(f"Faculty sheet rows: {len(c_fac)}")
    print(f"Faculty Workspace Scope sheet rows: {len(c_fws)}")
    print(f"Faculty Programme Scope sheet rows: {len(c_fps)}")
    print(f"Subjects sheet rows: {len(c_subj)}")
    print(f"Curriculum Offerings sheet rows: {len(c_off)}")
    
    print("\nCyber Offerings Breakdown by Programme, Semester & Semester Type:")
    c_off_summary = c_off.groupby(['programme_code', 'semester', 'semester_type']).size().reset_index(name='count')
    print(c_off_summary)
    
    # 3. AIML Workbook Analysis
    print("\n=== 3. AIML WORKBOOK ANALYSIS ===")
    a_depts = pd.read_excel(xl_a, 'Parent_Department', header=1)
    a_progs = pd.read_excel(xl_a, 'Programme', header=1)
    a_ops = pd.read_excel(xl_a, 'Operational_Workspace', header=1)
    a_wpm = pd.read_excel(xl_a, 'Workspace_Programme_Map', header=1)
    a_ctx = pd.read_excel(xl_a, 'Academic_Contexts', header=1)
    a_subj = pd.read_excel(xl_a, 'Subjects', header=1)
    a_off = pd.read_excel(xl_a, 'Curriculum_Offerings', header=1)
    a_fac = pd.read_excel(xl_a, 'Faculty', header=1)
    a_fws = pd.read_excel(xl_a, 'Faculty_Workspace_Scope', header=1)
    a_fps = pd.read_excel(xl_a, 'Faculty_Programme_Scope', header=1)
    a_hod = pd.read_excel(xl_a, 'HOD_Assignment', header=1)
    a_excl = pd.read_excel(xl_a, 'Excluded_Source_Offerings', header=1)
    
    print(f"Faculty sheet rows: {len(a_fac)} (all Shift-I)")
    print(f"Faculty Workspace Scope sheet rows: {len(a_fws)}")
    print(f"Faculty Programme Scope sheet rows: {len(a_fps)}")
    print(f"Subjects sheet rows: {len(a_subj)}")
    print(f"Curriculum Offerings sheet rows: {len(a_off)}")
    print(f"Excluded Source Offerings rows: {len(a_excl)} (Semesters 7 & 8)")
    
    print("\nAIML Offerings Breakdown by Programme, Semester & Semester Type:")
    a_off_summary = a_off.groupby(['programme_code', 'semester', 'semester_type']).size().reset_index(name='count')
    print(a_off_summary)
    
    print("\nAIML Excluded Offerings Breakdown:")
    a_excl_summary = a_excl.groupby(['programme_code', 'semester']).size().reset_index(name='count')
    print(a_excl_summary)

    # 4. Detailed Subject Cross-Check & Conflict Resolution Check
    print("\n=== 4. SUBJECT MATCH & CONFLICT ANALYSIS ===")
    
    all_incoming_subjects = {}
    
    for idx, row in c_subj.iterrows():
        code = str(row['course_code']).strip()
        title = str(row['course_title']).strip()
        l = int(row['L_lecture']) if pd.notna(row.get('L_lecture')) else 0
        t = int(row['T_tutorial']) if pd.notna(row.get('T_tutorial')) else 0
        p = int(row['P_practical']) if pd.notna(row.get('P_practical')) else 0
        c = int(row['credits']) if pd.notna(row.get('credits')) else 0
        cat = str(row.get('preference_bucket', 'CORE')).strip() if pd.notna(row.get('preference_bucket')) else 'CORE'
        all_incoming_subjects[code] = {
            'source': 'CYBER', 'code': code, 'title': title, 'l': l, 't': t, 'p': p, 'c': c, 'cat': cat
        }
        
    for idx, row in a_subj.iterrows():
        code = str(row['course_code']).strip()
        title = str(row['course_title']).strip()
        l = int(row['L_lecture']) if pd.notna(row.get('L_lecture')) else 0
        t = int(row['T_tutorial']) if pd.notna(row.get('T_tutorial')) else 0
        p = int(row['P_practical']) if pd.notna(row.get('P_practical')) else 0
        c = int(row['credits']) if pd.notna(row.get('credits')) else 0
        cat = str(row.get('preference_bucket', 'CORE')).strip() if pd.notna(row.get('preference_bucket')) else 'CORE'
        
        if code in all_incoming_subjects:
            prev = all_incoming_subjects[code]
            # Check if identical or conflicting
            if prev['title'].lower() != title.lower():
                print(f"  [CROSS-WORKBOOK TITLE VARIATION] Code {code}: CYBER='{prev['title']}' vs AIML='{title}'")
        else:
            all_incoming_subjects[code] = {
                'source': 'AIML', 'code': code, 'title': title, 'l': l, 't': t, 'p': p, 'c': c, 'cat': cat
            }

    # Compare with DB subjects
    reused_subjects = []
    new_subjects = []
    title_conflicts = []
    
    for code, info in all_incoming_subjects.items():
        if code in db_subjects:
            existing = db_subjects[code]
            reused_subjects.append(code)
            if existing.course_name.strip().lower() != info['title'].strip().lower():
                title_conflicts.append((code, existing.course_name, info['title']))
        else:
            new_subjects.append(code)
            
    print(f"Total Unique Incoming Subjects across both masters: {len(all_incoming_subjects)}")
    print(f"Subjects already existing in DB (to be reused): {len(reused_subjects)}")
    print(f"New Subjects to be created in DB: {len(new_subjects)}")
    print(f"Title Conflicts/Variations with DB: {len(title_conflicts)}")
    for c, old_t, new_t in title_conflicts:
        print(f"  - {c}: Existing DB='{old_t}' vs Incoming='{new_t}'")
        
    # 5. Check Curriculum Offerings uniqueness
    print("\n=== 5. CURRICULUM OFFERING KEY UNIQUENESS ===")
    cyber_keys = set(c_off['offering_key'])
    print(f"Cyber offerings total rows: {len(c_off)}, unique keys: {len(cyber_keys)}")
    aiml_keys = set(a_off['offering_key'])
    print(f"AIML offerings total rows: {len(a_off)}, unique keys: {len(aiml_keys)}")
    
    overlap = cyber_keys.intersection(aiml_keys)
    print(f"Offering keys overlap between Cyber and AIML: {len(overlap)}")
    
    # Check existing DB offerings for these programmes
    existing_c_progs = db.query(Programme).filter(Programme.department_id == 6).all()
    for p in existing_c_progs:
        off_cnt = db.query(CurriculumOffering).filter_by(programme_id=p.id).count()
        print(f"Existing DB offerings for Dept 6, Prog {p.name} (id={p.id}): {off_cnt}")
        
    existing_a_progs = db.query(Programme).filter(Programme.department_id == 2).all()
    for p in existing_a_progs:
        off_cnt = db.query(CurriculumOffering).filter_by(programme_id=p.id).count()
        print(f"Existing DB offerings for Dept 2, Prog {p.name} (id={p.id}): {off_cnt}")

    # 6. Faculty analysis
    print("\n=== 6. FACULTY IDENTITIES & REUSE ===")
    print("Cyber Security Faculty Members (15):")
    for _, r in c_fac.iterrows():
        emp = str(r['employee_id']).strip() if pd.notna(r['employee_id']) else ''
        email = str(r['email']).strip().lower() if pd.notna(r['email']) else ''
        print(f"  - {r['faculty_name']} (Emp: {emp}, Email: {email}, Desig: {r['designation']})")
        
    print("\nAIML Faculty Members (16 Shift-I):")
    for _, r in a_fac.iterrows():
        emp = str(r['employee_id']).strip() if pd.notna(r['employee_id']) else ''
        email = str(r['email']).strip().lower() if pd.notna(r['email']) else ''
        print(f"  - {r['faculty_name']} (Emp: {emp}, Email: {email}, Desig: {r['designation']}, Shift: {r['shift']})")

    db.close()

if __name__ == '__main__':
    run_deep_preflight()
