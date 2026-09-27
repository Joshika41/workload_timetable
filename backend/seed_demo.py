import sys
import os
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database.connection import SessionLocal, engine
from app.models.domain import (
    Base, Institution, Department, Programme, AcademicYear, Semester,
    AcademicWorkspace, Subject, CurriculumOffering, Section, User,
    FacultyProfile, RoleEnum, SemesterTypeEnum, WorkspaceWorkflowStateEnum,
    PolicyConfig
)
import bcrypt

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Institutions
        inst_names = ["E&T", "Flabs", "Management", "B-Arch"]
        institutions = {}
        for name in inst_names:
            inst = Institution(name=name)
            db.add(inst)
            db.commit()
            institutions[name] = inst

        # 2. Departments & Programmes
        departments_list = [
            {"name": "B.Sc CS", "programmes": ["B.Sc Computer Science"], "inst": "E&T"},
            {"name": "BCA Data Science", "programmes": ["BCA Data Science"], "inst": "E&T"},
            {"name": "MCA & MCA GEN AI", "programmes": ["MCA", "MCA GEN AI"], "inst": "E&T"},
            {"name": "BCA Gen AI", "programmes": ["BCA Gen AI"], "inst": "E&T"},
            {"name": "M.Sc CS", "programmes": ["M.Sc Computer Science"], "inst": "E&T"},
            {"name": "M.Sc AIML", "programmes": ["M.Sc Artificial Intelligence"], "inst": "E&T"},
            {"name": "B.Sc AIML", "programmes": ["B.Sc Artificial Intelligence"], "inst": "E&T"}
        ]
        
        dept_map = {}
        prog_map = {}
        for d in departments_list:
            dept = Department(institution_id=institutions[d["inst"]].id, name=d["name"])
            db.add(dept)
            db.commit()
            dept_map[d["name"]] = dept
            
            for p_name in d["programmes"]:
                prog = Programme(department_id=dept.id, name=p_name, programme_type="Postgraduate" if "M.Sc" in p_name or "MCA" in p_name else "Undergraduate")
                db.add(prog)
                db.commit()
                prog_map[p_name] = prog

        # 3. Add Policy Configs
        policies = [
            PolicyConfig(key="max_professor", scope="WORKLOAD_CAPS", value="12"),
            PolicyConfig(key="max_associate", scope="WORKLOAD_CAPS", value="14"),
            PolicyConfig(key="max_assistant", scope="WORKLOAD_CAPS", value="16"),
            PolicyConfig(key="incharge_reduction", scope="WORKLOAD_CAPS", value="2")
        ]
        db.add_all(policies)
        db.commit()

        # 4. Academic Year & Semesters (Only 1 to 6 now)
        ay = AcademicYear(name="2026-2027")
        db.add(ay)
        db.commit()
        
        semesters = {}
        for i in range(1, 7):
            sem = Semester(name=f"Semester {i}", semester_number=i)
            db.add(sem)
            db.commit()
            semesters[i] = sem

        # 5. Workspaces for all programmes
        from app.core.workspace import WorkspaceContext, encode_workspace_id
        
        target_workspace_id = None
        for p_name, prog in prog_map.items():
            max_sem = 4 if prog.programme_type == "Postgraduate" else 6
            for sem_num in range(1, max_sem + 1):
                ctx = WorkspaceContext(
                    department_id=prog.department_id,
                    programme_id=prog.id,
                    programme_year=(sem_num + 1) // 2,
                    academic_year_id=ay.id,
                    semester=sem_num
                )
                workspace_id = encode_workspace_id(ctx)
                workspace = AcademicWorkspace(
                    id=workspace_id,
                    department_id=prog.department_id,
                    programme_id=prog.id,
                    academic_year_id=ay.id,
                    semester_id=semesters[sem_num].id,
                    programme_year=(sem_num + 1) // 2,
                    workflow_state=WorkspaceWorkflowStateEnum.PREFERENCES,
                    version=1
                )
                db.add(workspace)
                if p_name == "MCA GEN AI" and sem_num == 1:
                    target_workspace_id = workspace_id
        db.commit()

        # 6. Subjects for MCA GEN AI
        # 6. Subjects and Curriculum Offerings for ALL Programmes & Semesters
        for p_name, prog in prog_map.items():
            max_sem = 4 if prog.programme_type == "Postgraduate" else 6
            for sem_num in range(1, max_sem + 1):
                # Generate 5 dummy subjects per semester
                pdf_subjects = {
                    "B.Sc. AI & ML": [
                        [
                            ("ULT24AE1J", "Tamil - I", 2, 2, 3, "CORE"),
                            ("UAI24101J", "Computing Fundamentals", 3, 3, 4, "CORE"),
                            ("UAI24102J", "Intro to AI and ML", 3, 3, 4, "CORE"),
                            ("UMS24103T", "Math for AI", 4, 0, 4, "CORE"),
                            ("UCD24S01J", "Verbal Ability", 1, 2, 2, "ELECTIVE")
                        ],
                        [
                            ("ULT24AE2J", "Tamil - II", 2, 2, 3, "CORE"),
                            ("USA24201J", "Data Structures and Algorithms", 3, 3, 4, "CORE"),
                            ("UCS24202J", "OOP using Java", 3, 3, 4, "CORE"),
                            ("UMS24203T", "Stats for AI", 4, 0, 4, "CORE")
                        ],
                        [
                            ("UCS24301J", "Operating System", 3, 3, 4, "CORE"),
                            ("USA24302J", "Database Management System", 3, 3, 4, "CORE"),
                            ("UAI24303J", "Machine Learning using Python", 3, 3, 4, "CORE")
                        ],
                        [
                            ("UAI24401J", "Computer Networks", 3, 3, 4, "CORE"),
                            ("UAI24D01J", "Intro to Artificial Neural Networks", 3, 2, 4, "ELECTIVE"),
                            ("UAI24D02J", "Applications of AI", 3, 2, 4, "ELECTIVE")
                        ]
                    ],
                    "B.Sc. Computer Science": [
                        [
                            ("UCS24101J", "Digital Electronics", 3, 3, 4, "CORE"),
                            ("USA24102J", "Programming for Problem Solving", 3, 3, 4, "CORE"),
                            ("UMS24101T", "Discrete Mathematical Structures", 4, 0, 4, "CORE")
                        ],
                        [
                            ("USA24201J", "Data Structures and Algorithms", 3, 3, 4, "CORE"),
                            ("UCS24202J", "Object Oriented Programming using Java", 3, 3, 4, "CORE"),
                            ("UMS24202T", "Mathematical Foundation", 4, 0, 4, "CORE")
                        ],
                        [
                            ("UCS24301J", "Operating System", 3, 3, 4, "CORE"),
                            ("USA24302J", "Database Management System", 3, 3, 4, "CORE"),
                            ("UMS24303T", "Statistical Methods", 4, 0, 4, "CORE")
                        ]
                    ]
                }
                
                prog_real_subjects = pdf_subjects.get(p_name, [])
                real_sem_subs = prog_real_subjects[sem_num - 1] if sem_num <= len(prog_real_subjects) else []

                if real_sem_subs:
                    for s in real_sem_subs:
                        sub = Subject(
                            course_code=s[0], course_name=s[1],
                            theory_hours=s[2], practical_hours=s[3],
                            total_hours=s[2]+s[3], credits=s[4], category=s[5]
                        )
                        db.add(sub)
                        db.flush()
                        
                        off = CurriculumOffering(
                            programme_id=prog.id, academic_year_id=ay.id, subject_id=sub.id,
                            programme_year=(sem_num + 1) // 2, semester=sem_num,
                            semester_type=SemesterTypeEnum.ODD if sem_num % 2 != 0 else SemesterTypeEnum.EVEN
                        )
                        db.add(off)
                else:
                    for i in range(1, 6):
                        sub_code = f"P{prog.id}S{sem_num}C{i}"
                        sub = Subject(
                            course_code=sub_code,
                            course_name=f"Sample Subject {i} for {p_name} Sem {sem_num}",
                            theory_hours=3 if i <= 3 else 0,
                            practical_hours=2 if i > 3 else 0,
                            total_hours=3 if i <= 3 else 2,
                            credits=4 if i <= 3 else 2,
                            category="CORE" if i <= 3 else "ELECTIVE"
                        )
                        db.add(sub)
                        db.flush()
                        
                        off = CurriculumOffering(
                            programme_id=prog.id,
                            academic_year_id=ay.id,
                            subject_id=sub.id,
                            programme_year=(sem_num + 1) // 2,
                            semester=sem_num,
                            semester_type=SemesterTypeEnum.ODD if sem_num % 2 != 0 else SemesterTypeEnum.EVEN
                        )
                        db.add(off)

                # Add Sections for each Workspace
                ctx = WorkspaceContext(
                    department_id=prog.department_id,
                    programme_id=prog.id,
                    programme_year=(sem_num + 1) // 2,
                    academic_year_id=ay.id,
                    semester=sem_num
                )
                workspace_id = encode_workspace_id(ctx)
                for section_name in ["A", "B"]:
                    sec = Section(workspace_id=workspace_id, name=section_name, curriculum_offering_id=None)
                    db.add(sec)
            db.commit()

        # 7. Users
        password_hash = get_password_hash("123456")
        mca_dept = dept_map["MCA & MCA GEN AI"]
        
        # HODs for each department
        for d_name, dept in dept_map.items():
            hod_user = User(
                email=f"hod_{d_name.replace(' ', '').replace('.', '').replace('&', '').lower()}@srm.edu",
                hashed_password=password_hash,
                role=RoleEnum.HOD,
                department_id=dept.id
            )
            db.add(hod_user)
        db.commit()

        # Faculty members for MCA
        faculties_data = [
            ("Dr. Meenakshi",      "meenakshi@srm.edu",  "FAC001", "Professor", "REGULAR"),
            ("Dr. R. Agasthiyan",  "agasthiyan@srm.edu", "FAC002", "Associate Professor", "REGULAR"),
            ("Dr. S. Kumar",       "skumar@srm.edu",     "FAC003", "Assistant Professor", "REGULAR"),
            ("Dr. P. Sharma",      "psharma@srm.edu",    "FAC004", "Associate Professor", "REGULAR"),
            ("Dr. Kavitha R",      "kavitha@srm.edu",    "FAC005", "Professor", "REGULAR"),
            ("Dr. Anand K",        "anand@srm.edu",      "FAC006", "Assistant Professor", "REGULAR"),
            ("Dr. John FTS",       "john_fts@srm.edu",   "FAC007", "FTS", "FTS"),
        ]

        for name, email, erp, desig, f_type in faculties_data:
            fu = User(
                email=email,
                hashed_password=password_hash,
                role=RoleEnum.FACULTY,
                department_id=mca_dept.id
            )
            db.add(fu)
            db.flush()
            fp = FacultyProfile(
                user_id=fu.id, 
                erp_id=erp, 
                name=name, 
                designation=desig,
                home_department_id=mca_dept.id,
                faculty_type=f_type
            )
            db.add(fp)
        db.commit()
            
        # Add a few dummy faculty to other departments
        dummy_counter = 100
        for d_name, dept in dept_map.items():
            if d_name == "MCA & MCA GEN AI": continue
            for i in range(5):
                fu = User(
                    email=f"faculty{dummy_counter}@srm.edu",
                    hashed_password=password_hash,
                    role=RoleEnum.FACULTY,
                    department_id=dept.id
                )
                db.add(fu)
                
                # We need user.id, so we must flush, but commit at the end of the loop is fine if we just flush
                db.flush()

                fp = FacultyProfile(
                    user_id=fu.id, 
                    erp_id=f"FAC{dummy_counter}", 
                    name=f"Dummy Fac {dummy_counter}", 
                    designation="Assistant Professor",
                    home_department_id=dept.id,
                    faculty_type="REGULAR"
                )
                db.add(fp)
                dummy_counter += 1
        db.commit()

        print("Database seeded successfully.")
        print(f"  Target MCA GEN AI Workspace ID: {target_workspace_id}")
        print("Login credentials:")
        print("  HOD MCA: hod_mcamcagenai@srm.edu / 123456")
        for name, email, _, _, _ in faculties_data:
            print(f"  Faculty: {email} / 123456  ({name})")

    except Exception as e:
        print(f"Failed to seed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
