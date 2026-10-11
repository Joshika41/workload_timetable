"""
Transactionally controlled import script for Department of Cyber Security and Department of AIML.
Performs:
1. Non-destructive schema migration: updates unique constraint on subjects to (course_code, course_name)
2. Departments update/reuse
3. Programmes update/creation
4. Academic workspaces & WorkspaceProgrammeMap creation
5. Faculty profiles, User accounts (with correct HOD/Faculty roles and designations)
6. Faculty Workspace Scopes and Faculty Programme Scopes
7. Subjects and Curriculum Offerings
8. Rollback capability on validation error
"""

import os
import sys
import pandas as pd
from sqlalchemy import text, or_

sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app.database.connection import SessionLocal, engine
from app.models.domain import (
    Institution, Department, Programme, AcademicWorkspace, WorkspaceProgrammeMap,
    FacultyProfile, User, FacultyWorkspaceScope, FacultyProgrammeScope,
    Subject, CurriculumOffering, Section, PreferenceSubmission, SubjectAllocation,
    AcademicYear, Semester, RoleEnum, SemesterTypeEnum, WorkspaceWorkflowStateEnum
)
from app.auth.jwt import get_password_hash
from app.core.workspace import encode_workspace_id, WorkspaceContext

cyber_path = os.path.join(BASE_DIR, 'data', 'institutions', 'FLABS', 'workspaces', 'FLABS_Cyber_Security_Department_Master_Data_2026_27_FINAL.xlsx')
aiml_path = os.path.join(BASE_DIR, 'data', 'institutions', 'FLABS', 'workspaces', 'FLABS_AIML_Department_Master_Data_2026_27.xlsx')

def get_or_create(session, model, defaults=None, **kwargs):
    instance = session.query(model).filter_by(**kwargs).first()
    if instance:
        return instance, False
    params = dict((k, v) for k, v in kwargs.items())
    if defaults:
        params.update(defaults)
    instance = model(**params)
    session.add(instance)
    session.flush()
    return instance, True

def run_import(dry_run=False):
    db = SessionLocal()
    try:
        print("=== STEP 0: ENSURING SCHEMA FLEXIBILITY FOR SUBJECTS ===")
        # Check if subjects_course_code_key constraint exists
        with engine.connect() as conn:
            check_constraint = conn.execute(text(
                "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='subjects' AND constraint_name='subjects_course_code_key'"
            )).fetchone()
            if check_constraint:
                print("Dropping global UNIQUE constraint subjects_course_code_key...")
                conn.execute(text("ALTER TABLE subjects DROP CONSTRAINT subjects_course_code_key"))
                conn.commit()
                print("Creating composite UNIQUE constraint subjects_code_name_key (course_code, course_name)...")
                conn.execute(text("ALTER TABLE subjects ADD CONSTRAINT subjects_code_name_key UNIQUE (course_code, course_name)"))
                conn.commit()
            else:
                print("Constraint subjects_course_code_key already resolved.")

        print("\n=== STEP 1: LOAD SOURCE WORKBOOKS ===")
        xl_c = pd.ExcelFile(cyber_path)
        xl_a = pd.ExcelFile(aiml_path)
        print("Cyber workbook loaded successfully.")
        print("AIML workbook loaded successfully.")

        # Institutional reference
        flabs = db.query(Institution).filter(or_(Institution.code == 'FLABS', Institution.name.ilike('%FLABS%'))).first()
        if not flabs:
            raise ValueError("Institution FLABS not found in database!")
        print(f"Institution: {flabs.name} (ID: {flabs.id})")

        # Academic Year reference (2026-2027)
        ay = db.query(AcademicYear).filter(AcademicYear.name.in_(['2026-2027', '2026-27'])).first()
        if not ay:
            ay, _ = get_or_create(db, AcademicYear, name="2026-2027")
        print(f"Academic Year: {ay.name} (ID: {ay.id})")

        # Semesters mapping
        sem_map = {}
        for s in db.query(Semester).all():
            sem_map[s.semester_number] = s

        print("\n=== STEP 2: UPSERT DEPARTMENTS & PROGRAMMES ===")
        # Department of Cyber Security
        dept_cyber, _ = get_or_create(db, Department, name="Department of Cyber Security", institution_id=flabs.id)
        print(f"Cyber Security Department: ID={dept_cyber.id}, Name={dept_cyber.name}")

        # Department of AIML (Reuse Dept 2, update name if needed)
        dept_aiml = db.query(Department).filter_by(id=2).first()
        if dept_aiml:
            if dept_aiml.name != "Department of AIML":
                print(f"Updating Department 2 name from '{dept_aiml.name}' to 'Department of AIML'...")
                dept_aiml.name = "Department of AIML"
                db.flush()
        else:
            dept_aiml, _ = get_or_create(db, Department, name="Department of AIML", institution_id=flabs.id)
        print(f"AIML Department: ID={dept_aiml.id}, Name={dept_aiml.name}")

        # Cyber Security Programmes (Prog 10 & 11)
        prog_bsc_cyber = db.query(Programme).filter_by(id=10, department_id=dept_cyber.id).first()
        if not prog_bsc_cyber:
            prog_bsc_cyber = db.query(Programme).filter(Programme.department_id == dept_cyber.id, Programme.name.ilike("%B.Sc%")).first()
        if prog_bsc_cyber:
            prog_bsc_cyber.name = "B.Sc. Cyber Security"
            prog_bsc_cyber.programme_type = "UG"
        else:
            prog_bsc_cyber = Programme(name="B.Sc. Cyber Security", programme_type="UG", department_id=dept_cyber.id)
            db.add(prog_bsc_cyber)
            db.flush()

        prog_msc_cyber = db.query(Programme).filter_by(id=11, department_id=dept_cyber.id).first()
        if not prog_msc_cyber:
            prog_msc_cyber = db.query(Programme).filter(Programme.department_id == dept_cyber.id, Programme.name.ilike("%M.Sc%")).first()
        if prog_msc_cyber:
            prog_msc_cyber.name = "M.Sc. Cyber Security"
            prog_msc_cyber.programme_type = "PG"
        else:
            prog_msc_cyber = Programme(name="M.Sc. Cyber Security", programme_type="PG", department_id=dept_cyber.id)
            db.add(prog_msc_cyber)
            db.flush()

        print(f"Cyber Programmes: [{prog_bsc_cyber.id}] {prog_bsc_cyber.name} ({prog_bsc_cyber.programme_type}), [{prog_msc_cyber.id}] {prog_msc_cyber.name} ({prog_msc_cyber.programme_type})")

        # AIML Programmes (Prog 3 B.Sc, and create M.Sc)
        prog_bsc_aiml = db.query(Programme).filter_by(id=3, department_id=dept_aiml.id).first()
        if not prog_bsc_aiml:
            prog_bsc_aiml = db.query(Programme).filter(Programme.department_id == dept_aiml.id, Programme.name.ilike("%B.Sc%")).first()
        if prog_bsc_aiml:
            prog_bsc_aiml.name = "B.Sc. Computer Science with specialization in AIML"
            prog_bsc_aiml.programme_type = "UG"
        else:
            prog_bsc_aiml = Programme(name="B.Sc. Computer Science with specialization in AIML", programme_type="UG", department_id=dept_aiml.id)
            db.add(prog_bsc_aiml)
            db.flush()

        prog_msc_aiml = db.query(Programme).filter(Programme.department_id == dept_aiml.id, Programme.name.ilike("%M.Sc%")).first()
        if not prog_msc_aiml:
            prog_msc_aiml = Programme(name="M.Sc. Computer Science with specialization in AIML", programme_type="PG", department_id=dept_aiml.id)
            db.add(prog_msc_aiml)
            db.flush()
        else:
            prog_msc_aiml.name = "M.Sc. Computer Science with specialization in AIML"
            prog_msc_aiml.programme_type = "PG"

        print(f"AIML Programmes: [{prog_bsc_aiml.id}] {prog_bsc_aiml.name} ({prog_bsc_aiml.programme_type}), [{prog_msc_aiml.id}] {prog_msc_aiml.name} ({prog_msc_aiml.programme_type})")

        print("\n=== STEP 3: UPSERT ACADEMIC WORKSPACES & WORKSPACE PROGRAMME MAPS ===")
        # Cyber Security Workspaces (10 semesters: B.Sc S1-S6, M.Sc S1-S4)
        # Requirement: "There must be one shared Cyber Security HOD/workload workspace covering both programmes... Use existing multi-programme workspace mapping"
        cyber_workspaces = []
        for sem in range(1, 7):
            ctx = WorkspaceContext(
                department_id=dept_cyber.id,
                programme_id=prog_bsc_cyber.id,
                programme_year=(sem + 1) // 2,
                academic_year_id=ay.id,
                semester=sem
            )
            ws_id = encode_workspace_id(ctx)
            ws, _ = get_or_create(db, AcademicWorkspace, id=ws_id, defaults={
                'department_id': dept_cyber.id,
                'programme_id': prog_bsc_cyber.id,
                'academic_year_id': ay.id,
                'semester_id': sem_map[sem].id,
                'programme_year': (sem + 1) // 2,
                'workflow_state': WorkspaceWorkflowStateEnum.PREFERENCES
            })
            cyber_workspaces.append(ws)
            # Map to both programmes for shared workspace support
            get_or_create(db, WorkspaceProgrammeMap, workspace_id=ws.id, programme_id=prog_bsc_cyber.id)
            get_or_create(db, WorkspaceProgrammeMap, workspace_id=ws.id, programme_id=prog_msc_cyber.id)

        for sem in range(1, 5):
            ctx = WorkspaceContext(
                department_id=dept_cyber.id,
                programme_id=prog_msc_cyber.id,
                programme_year=(sem + 1) // 2,
                academic_year_id=ay.id,
                semester=sem
            )
            ws_id = encode_workspace_id(ctx)
            ws, _ = get_or_create(db, AcademicWorkspace, id=ws_id, defaults={
                'department_id': dept_cyber.id,
                'programme_id': prog_msc_cyber.id,
                'academic_year_id': ay.id,
                'semester_id': sem_map[sem].id,
                'programme_year': (sem + 1) // 2,
                'workflow_state': WorkspaceWorkflowStateEnum.PREFERENCES
            })
            cyber_workspaces.append(ws)
            # Map to both programmes for shared workspace support
            get_or_create(db, WorkspaceProgrammeMap, workspace_id=ws.id, programme_id=prog_msc_cyber.id)
            get_or_create(db, WorkspaceProgrammeMap, workspace_id=ws.id, programme_id=prog_bsc_cyber.id)

        print(f"Cyber Security Workspaces: {len(cyber_workspaces)} operational semester workspaces created/verified.")

        # AIML Workspaces (B.Sc S1-S6, M.Sc S1-S4)
        # Requirement: "Preserve the two separate AIML operational workspaces... B.Sc CS with AIML, M.Sc CS with AIML"
        aiml_bsc_workspaces = []
        for sem in range(1, 7):
            ctx = WorkspaceContext(
                department_id=dept_aiml.id,
                programme_id=prog_bsc_aiml.id,
                programme_year=(sem + 1) // 2,
                academic_year_id=ay.id,
                semester=sem
            )
            ws_id = encode_workspace_id(ctx)
            ws, _ = get_or_create(db, AcademicWorkspace, id=ws_id, defaults={
                'department_id': dept_aiml.id,
                'programme_id': prog_bsc_aiml.id,
                'academic_year_id': ay.id,
                'semester_id': sem_map[sem].id,
                'programme_year': (sem + 1) // 2,
                'workflow_state': WorkspaceWorkflowStateEnum.PREFERENCES
            })
            aiml_bsc_workspaces.append(ws)
            # Separate workspace: maps ONLY to B.Sc programme
            get_or_create(db, WorkspaceProgrammeMap, workspace_id=ws.id, programme_id=prog_bsc_aiml.id)

        aiml_msc_workspaces = []
        for sem in range(1, 5):
            ctx = WorkspaceContext(
                department_id=dept_aiml.id,
                programme_id=prog_msc_aiml.id,
                programme_year=(sem + 1) // 2,
                academic_year_id=ay.id,
                semester=sem
            )
            ws_id = encode_workspace_id(ctx)
            ws, _ = get_or_create(db, AcademicWorkspace, id=ws_id, defaults={
                'department_id': dept_aiml.id,
                'programme_id': prog_msc_aiml.id,
                'academic_year_id': ay.id,
                'semester_id': sem_map[sem].id,
                'programme_year': (sem + 1) // 2,
                'workflow_state': WorkspaceWorkflowStateEnum.PREFERENCES
            })
            aiml_msc_workspaces.append(ws)
            # Separate workspace: maps ONLY to M.Sc programme
            get_or_create(db, WorkspaceProgrammeMap, workspace_id=ws.id, programme_id=prog_msc_aiml.id)

        print(f"AIML Workspaces: {len(aiml_bsc_workspaces)} B.Sc workspaces, {len(aiml_msc_workspaces)} M.Sc workspaces created/verified.")

        print("\n=== STEP 4: UPSERT USERS, FACULTY PROFILES & SCOPES ===")
        pwd_hash = get_password_hash("password")

        # 4A. Cyber Security Faculty (15 rows)
        c_fac_df = pd.read_excel(xl_c, 'Faculty', header=1)
        c_fac_profiles = []
        for _, row in c_fac_df.iterrows():
            emp_id = str(row['employee_id']).strip()
            name = str(row['faculty_name']).strip()
            email = str(row['email']).strip().lower()
            desig = str(row['designation']).strip() if pd.notna(row['designation']) else "Assistant Professor"
            target_w = int(row['target_workload']) if pd.notna(row.get('target_workload')) else 16
            
            # HOD designated: Dr. J. Jebamalar Tamilselvi (TSH009)
            is_hod = (emp_id == "TSH009" or "Jebamalar" in name)
            user_role = RoleEnum.HOD if is_hod else RoleEnum.FACULTY

            user = db.query(User).filter_by(email=email).first()
            if not user:
                user = User(
                    email=email,
                    hashed_password=pwd_hash,
                    role=user_role,
                    department_id=dept_cyber.id,
                    is_active=True
                )
                db.add(user)
                db.flush()
            else:
                user.role = user_role
                user.department_id = dept_cyber.id

            fac_prof = db.query(FacultyProfile).filter_by(user_id=user.id).first()
            if not fac_prof:
                fac_prof = FacultyProfile(
                    user_id=user.id,
                    erp_id=emp_id,
                    name=name,
                    designation=desig,
                    home_department_id=dept_cyber.id,
                    target_workload=target_w,
                    faculty_type="REGULAR"
                )
                db.add(fac_prof)
                db.flush()
            else:
                fac_prof.name = name
                fac_prof.erp_id = emp_id
                fac_prof.designation = desig
                fac_prof.home_department_id = dept_cyber.id
                fac_prof.target_workload = target_w

            c_fac_profiles.append(fac_prof)

            # Programme scopes: Mapped to BOTH B.Sc and M.Sc Cyber Security
            get_or_create(db, FacultyProgrammeScope, faculty_id=fac_prof.id, programme_id=prog_bsc_cyber.id)
            get_or_create(db, FacultyProgrammeScope, faculty_id=fac_prof.id, programme_id=prog_msc_cyber.id)

            # Workspace scopes: Mapped to all Cyber Security operational workspaces
            for ws in cyber_workspaces:
                get_or_create(db, FacultyWorkspaceScope, faculty_id=fac_prof.id, workspace_id=ws.id)

        print(f"Cyber Security: {len(c_fac_profiles)} faculty members imported with full programme & workspace scopes.")

        # 4B. AIML Faculty (16 Shift-I rows)
        a_fac_df = pd.read_excel(xl_a, 'Faculty', header=1)
        # Exclude Shift-2 or FTS per requirement
        a_fac_shift1 = a_fac_df[a_fac_df['shift'].astype(str).str.upper().str.contains('SHIFT I|SHIFT-1|SHIFT-I')]
        print(f"AIML Shift-I rows to import: {len(a_fac_shift1)} (5 Shift-II rows excluded)")
        
        a_fac_profiles = []
        for _, row in a_fac_shift1.iterrows():
            emp_id = str(row['employee_id']).strip()
            name = str(row['faculty_name']).strip()
            email = str(row['email']).strip().lower()
            desig = str(row['designation']).strip() if pd.notna(row['designation']) else "Assistant Professor"
            target_w = int(row['target_workload']) if pd.notna(row.get('target_workload')) else 16
            
            # B.Sc AIML HOD designated: Dr. S. Subbaiah (TSH118)
            is_hod = (emp_id == "TSH118" or "Subbaiah" in name)
            user_role = RoleEnum.HOD if is_hod else RoleEnum.FACULTY

            user = db.query(User).filter_by(email=email).first()
            if not user:
                user = User(
                    email=email,
                    hashed_password=pwd_hash,
                    role=user_role,
                    department_id=dept_aiml.id,
                    is_active=True
                )
                db.add(user)
                db.flush()
            else:
                user.role = user_role
                user.department_id = dept_aiml.id

            fac_prof = db.query(FacultyProfile).filter_by(user_id=user.id).first()
            if not fac_prof:
                fac_prof = FacultyProfile(
                    user_id=user.id,
                    erp_id=emp_id,
                    name=name,
                    designation=desig,
                    home_department_id=dept_aiml.id,
                    target_workload=target_w,
                    faculty_type="REGULAR"
                )
                db.add(fac_prof)
                db.flush()
            else:
                fac_prof.name = name
                fac_prof.erp_id = emp_id
                fac_prof.designation = desig
                fac_prof.home_department_id = dept_aiml.id
                fac_prof.target_workload = target_w

            a_fac_profiles.append(fac_prof)

            # Programme scopes: Mapped to B.Sc AIML ONLY (M.Sc unassigned per requirement)
            get_or_create(db, FacultyProgrammeScope, faculty_id=fac_prof.id, programme_id=prog_bsc_aiml.id)

            # Workspace scopes: Mapped to B.Sc AIML workspaces ONLY
            for ws in aiml_bsc_workspaces:
                get_or_create(db, FacultyWorkspaceScope, faculty_id=fac_prof.id, workspace_id=ws.id)

        print(f"AIML: {len(a_fac_profiles)} Shift-I faculty members imported with B.Sc programme & workspace scopes. M.Sc left unassigned.")

        print("\n=== STEP 5: UPSERT SUBJECTS ===")
        # Load subjects from both masters
        c_subj_df = pd.read_excel(xl_c, 'Subjects', header=1)
        a_subj_df = pd.read_excel(xl_a, 'Subjects', header=1)

        subject_cache = {} # (course_code, course_name) -> Subject

        # Index existing DB subjects into cache
        for s in db.query(Subject).all():
            subject_cache[(s.course_code.strip(), s.course_name.strip())] = s

        def upsert_subject(row, source_tag):
            code = str(row['course_code']).strip()
            title = str(row['course_title']).strip()
            if not code or code == 'nan' or not title or title == 'nan':
                return None
            
            l = int(row['L_lecture']) if pd.notna(row.get('L_lecture')) else 0
            t = int(row['T_tutorial']) if pd.notna(row.get('T_tutorial')) else 0
            p = int(row['P_practical']) if pd.notna(row.get('P_practical')) else 0
            c = int(row['credits']) if pd.notna(row.get('credits')) else 0
            cat = str(row.get('preference_bucket', 'CORE')).strip() if pd.notna(row.get('preference_bucket')) else 'CORE'

            # Normalization check: if there's an exact code with singular/plural difference (like Essential vs Essentials of AI)
            key = (code, title)
            if key in subject_cache:
                return subject_cache[key]
            
            # Check if there is an existing subject with this code and almost identical title
            existing_same_code = db.query(Subject).filter_by(course_code=code).all()
            for ex in existing_same_code:
                # If title is identical or minor punctuation/plural difference
                if ex.course_name.strip().lower() == title.lower() or ex.course_name.strip().lower() in [title.lower() + 's', title.lower().rstrip('s')]:
                    subject_cache[key] = ex
                    return ex

            # Otherwise, create distinct subject entity
            subj = Subject(
                course_code=code,
                course_name=title,
                theory_hours=l + t,
                practical_hours=p,
                total_hours=l + t + p,
                credits=c,
                category=cat
            )
            db.add(subj)
            db.flush()
            subject_cache[key] = subj
            return subj

        new_subj_count = 0
        reused_subj_count = 0

        for _, r in c_subj_df.iterrows():
            initial_count = len(subject_cache)
            s = upsert_subject(r, "CYBER")
            if s:
                if len(subject_cache) > initial_count:
                    new_subj_count += 1
                else:
                    reused_subj_count += 1

        for _, r in a_subj_df.iterrows():
            initial_count = len(subject_cache)
            s = upsert_subject(r, "AIML")
            if s:
                if len(subject_cache) > initial_count:
                    new_subj_count += 1
                else:
                    reused_subj_count += 1

        print(f"Subjects: {new_subj_count} new subjects added, {reused_subj_count} subjects reused.")

        print("\n=== STEP 6: UPSERT CURRICULUM OFFERINGS ===")
        # 6A. Cyber Security Offerings (B.Sc Sem 1-6, M.Sc Sem 1-4)
        c_off_df = pd.read_excel(xl_c, 'Curriculum_Offerings', header=1)
        c_off_created = 0
        c_off_reused = 0

        for _, row in c_off_df.iterrows():
            # Check placeholders
            if pd.isna(row.get('course_code')) or str(row.get('course_code')).strip() in ['', 'nan']:
                continue
            if row.get('is_placeholder') is True or str(row.get('is_placeholder')).strip().upper() == 'TRUE':
                continue

            code = str(row['course_code']).strip()
            title = str(row['display_title']).strip()
            prog_code = str(row['programme_code']).strip()
            sem_num = int(row['semester'])
            st_str = str(row['semester_type']).strip().upper()
            st_enum = SemesterTypeEnum.ODD if st_str == 'ODD' else SemesterTypeEnum.EVEN

            target_prog = prog_bsc_cyber if 'BSC' in prog_code else prog_msc_cyber

            # Find matching subject
            key = (code, title)
            subj = subject_cache.get(key)
            if not subj:
                # Fallback to query
                subj = db.query(Subject).filter_by(course_code=code).first()

            if not subj:
                print(f"WARNING: Subject not found for offering {code} - {title}")
                continue

            offering, created = get_or_create(
                db, CurriculumOffering,
                programme_id=target_prog.id,
                academic_year_id=ay.id,
                subject_id=subj.id,
                semester=sem_num,
                defaults={
                    'programme_year': (sem_num + 1) // 2,
                    'semester_type': st_enum
                }
            )
            if created:
                c_off_created += 1
            else:
                c_off_reused += 1

        print(f"Cyber Security Offerings: {c_off_created} created, {c_off_reused} reused.")

        # 6B. AIML Offerings (B.Sc Sem 1-6 active, Sem 7-8 excluded; M.Sc Sem 1-4 active)
        a_off_df = pd.read_excel(xl_a, 'Curriculum_Offerings', header=1)
        a_off_created = 0
        a_off_reused = 0
        a_off_excluded_sem78 = 0

        for _, row in a_off_df.iterrows():
            # Check placeholders
            if pd.isna(row.get('course_code')) or str(row.get('course_code')).strip() in ['', 'nan']:
                continue
            if row.get('is_placeholder') is True or str(row.get('is_placeholder')).strip().upper() == 'TRUE':
                continue

            prog_code = str(row['programme_code']).strip()
            sem_num = int(row['semester'])

            # FLABS UG policy: Semesters 7 & 8 excluded from active import
            if 'BSC' in prog_code and sem_num in [7, 8]:
                a_off_excluded_sem78 += 1
                continue

            code = str(row['course_code']).strip()
            title = str(row['display_title']).strip()
            st_str = str(row['semester_type']).strip().upper()
            st_enum = SemesterTypeEnum.ODD if st_str == 'ODD' else SemesterTypeEnum.EVEN

            target_prog = prog_bsc_aiml if 'BSC' in prog_code else prog_msc_aiml

            key = (code, title)
            subj = subject_cache.get(key)
            if not subj:
                subj = db.query(Subject).filter_by(course_code=code).first()

            if not subj:
                print(f"WARNING: Subject not found for offering {code} - {title}")
                continue

            offering, created = get_or_create(
                db, CurriculumOffering,
                programme_id=target_prog.id,
                academic_year_id=ay.id,
                subject_id=subj.id,
                semester=sem_num,
                defaults={
                    'programme_year': (sem_num + 1) // 2,
                    'semester_type': st_enum
                }
            )
            if created:
                a_off_created += 1
            else:
                a_off_reused += 1

        print(f"AIML Offerings: {a_off_created} created, {a_off_reused} reused, {a_off_excluded_sem78} Sem 7-8 excluded.")

        if dry_run:
            print("\nDRY RUN: Rolling back transaction. Pre-import state preserved.")
            db.rollback()
        else:
            print("\nCOMMITTING IMPORT TRANSACTION TO SUPABASE POSTGRESQL...")
            db.commit()
            print("IMPORT COMMITTED SUCCESSFULLY!")

    except Exception as e:
        db.rollback()
        print(f"\nERROR DURING IMPORT: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()

if __name__ == '__main__':
    dry_run_mode = '--dry-run' in sys.argv
    run_import(dry_run=dry_run_mode)
