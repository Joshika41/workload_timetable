import os
import sys
import pandas as pd
import math

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.connection import SessionLocal, engine
from app.models.domain import (
    Base, Institution, Department, Programme, AcademicYear, Semester,
    AcademicWorkspace, Subject, CurriculumOffering, Section, User,
    FacultyProfile, RoleEnum, SemesterTypeEnum, WorkspaceWorkflowStateEnum,
    PolicyConfig
)
from app.core.workspace import WorkspaceContext, encode_workspace_id
import bcrypt

FILE_PATH = os.path.join("data", "institutions", "FLABS", "master", "FLABS_Workload_ERP_Master_Data_2026_27_v2.xlsx")

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

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

def run():
    print(f"Loading {FILE_PATH}...")
    xl = pd.ExcelFile(FILE_PATH)
    
    institutions_df = pd.read_excel(xl, sheet_name='Institutions', header=1)
    departments_df = pd.read_excel(xl, sheet_name='Departments', header=1)
    programmes_df = pd.read_excel(xl, sheet_name='Programmes', header=1)
    faculty_df = pd.read_excel(xl, sheet_name='Faculty', header=1)
    subjects_df = pd.read_excel(xl, sheet_name='Subjects', header=1)
    offerings_df = pd.read_excel(xl, sheet_name='Curriculum_Offerings', header=1)
    sections_df = pd.read_excel(xl, sheet_name='Sections', header=1)

    print("\n--- VALIDATION ---")
    # Check duplicates
    dupe_courses = subjects_df[subjects_df.duplicated('course_code')]['course_code'].tolist()
    if dupe_courses: print(f"Duplicate Course Codes: {dupe_courses}")
    
    dupe_emp_ids = faculty_df[faculty_df['employee_id'].notna() & faculty_df.duplicated('employee_id')]['employee_id'].tolist()
    if dupe_emp_ids: print(f"Duplicate Employee IDs: {dupe_emp_ids}")
    
    # Missing relationships
    missing_depts = set(departments_df['institution_code']) - set(institutions_df['institution_code'])
    if missing_depts: print(f"Departments referencing unknown Institutions: {missing_depts}")
    
    missing_progs = set(programmes_df['department_code']) - set(departments_df['department_code'])
    if missing_progs: print(f"Programmes referencing unknown Departments: {missing_progs}")

    # Exclusions
    fac_to_exclude = faculty_df[(faculty_df['shift'] == 'Shift-2') | (faculty_df['faculty_type'] == 'FTS')]
    print(f"Excluded Faculty Count (Shift-2 or FTS): {len(fac_to_exclude)}")
    
    # Let's check offerings
    # Exclude Semester 7 and 8
    off_to_exclude = offerings_df[offerings_df['semester'].isin([7, 8])]
    print(f"Excluded Offerings Count (Sem 7-8): {len(off_to_exclude)}")

    print("\n--- IMPORT ---")
    db = SessionLocal()
    try:
        # Institutions
        inst_map = {}
        for _, row in institutions_df.iterrows():
            if pd.isna(row['institution_code']): continue
            code = str(row['institution_code']).strip().upper()
            name = str(row.get('institution_name', code)).strip()
            if name == 'nan' or not name: name = code
            inst, _ = get_or_create(db, Institution, code=code, defaults={'name': name})
            inst_map[row['institution_code']] = inst
            
        # Departments
        dept_map = {}
        for _, row in departments_df.iterrows():
            if pd.isna(row['department_code']): continue
            inst_code = row['institution_code']
            if inst_code not in inst_map: continue
            dept, _ = get_or_create(db, Department, name=str(row['department_name']).strip(), institution_id=inst_map[inst_code].id)
            dept_map[row['department_code']] = dept

        # Programmes
        prog_map = {}
        for _, row in programmes_df.iterrows():
            if pd.isna(row['programme_code']): continue
            dept_code = row['department_code']
            if dept_code not in dept_map: continue
            level = "Postgraduate" if "PG" in str(row.get('level', 'UG')) else "Undergraduate"
            prog, _ = get_or_create(db, Programme, name=str(row['programme_name']).strip(), department_id=dept_map[dept_code].id, defaults={'programme_type': level})
            prog_map[row['programme_code']] = prog
            
        # Academic Year (Standardizing on 2026-2027)
        ay, _ = get_or_create(db, AcademicYear, name="2026-2027")
        
        # Semesters
        sem_map = {}
        for i in range(1, 9):
            sem, _ = get_or_create(db, Semester, name=f"Semester {i}", semester_number=i)
            sem_map[i] = sem

        # Subjects
        subject_map = {}
        for _, row in subjects_df.iterrows():
            if pd.isna(row['course_code']): continue
            ccode = str(row['course_code']).strip()
            title = str(row['course_title']).strip()
            cat = str(row['preference_bucket']).strip() if pd.notna(row.get('preference_bucket')) else "CORE"
            
            l = int(row['L_lecture']) if pd.notna(row.get('L_lecture')) else 0
            t = int(row['T_tutorial']) if pd.notna(row.get('T_tutorial')) else 0
            p = int(row['P_practical']) if pd.notna(row.get('P_practical')) else 0
            c = int(row['credits']) if pd.notna(row.get('credits')) else 0
            
            sub, _ = get_or_create(db, Subject, course_code=ccode, defaults={
                'course_name': title,
                'category': cat,
                'theory_hours': l + t,
                'practical_hours': p,
                'total_hours': l + t + p,
                'credits': c
            })
            subject_map[ccode] = sub

        # Curriculum Offerings
        offering_count = 0
        for _, row in offerings_df.iterrows():
            if pd.isna(row['programme_code']) or pd.isna(row['course_code']): continue
            prog_code = row['programme_code']
            ccode = str(row['course_code']).strip()
            sem_num = int(row['semester']) if pd.notna(row['semester']) else 1
            
            if sem_num in [7, 8]: continue # Skip per policy
            
            if prog_code not in prog_map or ccode not in subject_map: continue
            
            prog = prog_map[prog_code]
            sub = subject_map[ccode]
            
            sem_type_str = str(row.get('semester_type', 'ODD')).strip().upper()
            sem_type = SemesterTypeEnum.ODD if sem_type_str == 'ODD' else SemesterTypeEnum.EVEN
            
            # create workspace context
            ctx = WorkspaceContext(
                department_id=prog.department_id,
                programme_id=prog.id,
                programme_year=(sem_num + 1) // 2,
                academic_year_id=ay.id,
                semester=sem_num
            )
            ws_id = encode_workspace_id(ctx)
            
            # Upsert Workspace
            get_or_create(db, AcademicWorkspace, id=ws_id, defaults={
                'department_id': prog.department_id,
                'programme_id': prog.id,
                'academic_year_id': ay.id,
                'semester_id': sem_map[sem_num].id,
                'programme_year': (sem_num + 1) // 2
            })
            
            get_or_create(db, CurriculumOffering,
                programme_id=prog.id, academic_year_id=ay.id, subject_id=sub.id,
                semester=sem_num,
                defaults={
                    'programme_year': (sem_num + 1) // 2,
                    'semester_type': sem_type
                }
            )
            offering_count += 1

        # Faculty
        fac_count = 0
        pwd_hash = get_password_hash("password")
        for _, row in faculty_df.iterrows():
            if pd.isna(row['faculty_key']): continue
            if row.get('shift') == 'Shift-2' or row.get('faculty_type') == 'FTS': continue
            
            dept_code = row['department_code']
            if dept_code not in dept_map: continue
            
            dept = dept_map[dept_code]
            email = str(row['email']).strip()
            if pd.isna(row['email']) or not email:
                email = f"fac_{row['faculty_key']}@srm.edu"
                
            emp_id = str(row['employee_id']).strip() if pd.notna(row['employee_id']) else str(row['faculty_key']).strip()
            
            fac, fac_created = get_or_create(db, User, email=email, defaults={
                'hashed_password': pwd_hash,
                'role': RoleEnum.FACULTY,
                'department_id': dept.id
            })
            
            if fac_created:
                target_w = int(row['target_workload']) if pd.notna(row.get('target_workload')) else None
                defaults = {
                    'name': str(row['faculty_name']).strip(),
                    'designation': str(row['designation']).strip() if pd.notna(row.get('designation')) else 'Assistant Professor',
                    'home_department_id': dept.id,
                    'faculty_type': str(row.get('faculty_type', 'REGULAR')).strip()
                }
                if target_w is not None:
                    defaults['target_workload'] = target_w
                    
                get_or_create(db, FacultyProfile, user_id=fac.id, erp_id=emp_id, defaults=defaults)
            fac_count += 1
            
        # Sections
        sec_count = 0
        for _, row in sections_df.iterrows():
            if pd.isna(row['section_key']): continue
            ws_key = str(row['workspace_key']).strip()
            # In the Excel file, workspace_key might just refer to the programme and semester.
            # We need to parse it. It's likely formatted like "FLABS-BCA-DS-S1".
            parts = ws_key.split('-')
            if len(parts) >= 3:
                prog_code = "-".join(parts[:-1]) # FLABS-BCA-DS
                sem_str = parts[-1]
                if sem_str.startswith('S'):
                    sem_num = int(sem_str[1:])
                    if prog_code in prog_map and sem_num in sem_map:
                        prog = prog_map[prog_code]
                        ctx = WorkspaceContext(
                            department_id=prog.department_id,
                            programme_id=prog.id,
                            programme_year=(sem_num + 1) // 2,
                            academic_year_id=ay.id,
                            semester=sem_num
                        )
                        ws_id = encode_workspace_id(ctx)
                        # Ensure workspace exists
                        get_or_create(db, AcademicWorkspace, id=ws_id, defaults={
                            'department_id': prog.department_id,
                            'programme_id': prog.id,
                            'academic_year_id': ay.id,
                            'semester_id': sem_map[sem_num].id,
                            'programme_year': (sem_num + 1) // 2
                        })
                        
                        sec_name = str(row['section_code']).strip()
                        strength = int(row['student_strength']) if pd.notna(row.get('student_strength')) else 0
                        is_active = True if str(row.get('is_active', 'Y')).strip().upper() == 'Y' else False
                        
                        get_or_create(db, Section, workspace_id=ws_id, name=sec_name, defaults={
                            'student_strength': strength,
                            'is_active': is_active
                        })
                        sec_count += 1
            
        db.commit()
        print(f"Imported Offerings: {offering_count}")
        print(f"Imported Faculty: {fac_count}")
        print(f"Imported Sections: {sec_count}")
        print("Done.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run()
