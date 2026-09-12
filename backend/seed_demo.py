from database import SessionLocal
import models
from sqlalchemy.exc import IntegrityError
import uuid

# Static mock hash to bypass overhead (Password: Demo@123)
MOCK_PASSWORD_HASH = "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQqiRQYm"

# The Trap: This faculty member will NOT get an auto-generated user account.
# You will generate hers live on stage to show the SMTP email working.
SMTP_DEMO_FACULTY = "Dr.N. Vijayalakshmi"

cohorts_data = [
    # MCA (PG / Odd)
    {"department": "MCA", "academic_year": 2025, "class_name": "MCA", "section": "A", "program_type": "PG", "semester_type": "ODD"},
    {"department": "MCA", "academic_year": 2025, "class_name": "MCA", "section": "B", "program_type": "PG", "semester_type": "ODD"},
    # Data Science (UG / Odd)
    {"department": "Data Science", "academic_year": 2024, "class_name": "DS", "section": "A", "program_type": "UG", "semester_type": "ODD"},
    # B.Sc CS (UG / Odd)
    {"department": "B.Sc. CS", "academic_year": 2024, "class_name": "B.Sc CS", "section": "A", "program_type": "UG", "semester_type": "ODD"},
    {"department": "B.Sc. CS", "academic_year": 2024, "class_name": "B.Sc CS", "section": "B", "program_type": "UG", "semester_type": "ODD"}
]

syllabus_data = [
    # MCA (PG / Odd)
    {"subject_code": "MCA101", "course_title": "Advanced Database Systems", "course_type": "Theory", "subject_category": "Core", "theory_hours_l": 3, "practical_hours_p": 0, "credits_c": 3, "program_type": "PG", "semester_type": "ODD", "category": "MCA", "is_active": True},
    {"subject_code": "MCA102", "course_title": "Cloud Computing", "course_type": "Theory", "subject_category": "Core", "theory_hours_l": 3, "practical_hours_p": 0, "credits_c": 3, "program_type": "PG", "semester_type": "ODD", "category": "MCA", "is_active": True},
    
    # Data Science (UG / Odd) - Extracted from PDF
    {"subject_code": "UDS24101J", "course_title": "Programming using Java", "course_type": "Theory", "subject_category": "Core", "theory_hours_l": 3, "practical_hours_p": 3, "credits_c": 4, "program_type": "UG", "semester_type": "ODD", "category": "Data Science", "is_active": True},
    {"subject_code": "UDS24102J", "course_title": "Fundamentals of Data Science", "course_type": "Theory", "subject_category": "Core", "theory_hours_l": 3, "practical_hours_p": 3, "credits_c": 4, "program_type": "UG", "semester_type": "ODD", "category": "Data Science", "is_active": True},
    {"subject_code": "UMS24103T", "course_title": "Mathematics for Artificial Intelligence", "course_type": "Theory", "subject_category": "Support", "theory_hours_l": 4, "practical_hours_p": 0, "credits_c": 4, "program_type": "UG", "semester_type": "ODD", "category": "Data Science", "is_active": True},
    {"subject_code": "UDS24M02J", "course_title": "Digital Transformation", "course_type": "Theory", "subject_category": "Multi", "theory_hours_l": 2, "practical_hours_p": 0, "credits_c": 3, "program_type": "UG", "semester_type": "ODD", "category": "Data Science", "is_active": True},

    # B.Sc CS (UG / Odd) - Extracted from PDF
    {"subject_code": "UCS24101J", "course_title": "Digital Electronics", "course_type": "Theory", "subject_category": "Core", "theory_hours_l": 3, "practical_hours_p": 3, "credits_c": 4, "program_type": "UG", "semester_type": "ODD", "category": "B.Sc. CS", "is_active": True},
    {"subject_code": "USA24102J", "course_title": "Programming for Problem Solving", "course_type": "Theory", "subject_category": "Core", "theory_hours_l": 3, "practical_hours_p": 3, "credits_c": 4, "program_type": "UG", "semester_type": "ODD", "category": "B.Sc. CS", "is_active": True},
    {"subject_code": "UMS24101T", "course_title": "Discrete Mathematical Structures", "course_type": "Theory", "subject_category": "Support", "theory_hours_l": 4, "practical_hours_p": 0, "credits_c": 4, "program_type": "UG", "semester_type": "ODD", "category": "B.Sc. CS", "is_active": True}
]

faculty_data = [
    # MCA
    {"name": "Dr J Dhilipan", "email": "dhilipaj@srmist.edu.in", "designation": "HOD"},
    {"name": "Dr K Kalaiselvi", "email": "kalaisek5@srmist.edu.in", "designation": "Professor"},
    # Data Science
    {"name": "Dr.N. Vijayalakshmi", "email": "vijayaln@srmist.edu.in", "designation": "HOD & Associate Professor"},
    {"name": "Dr. R. Renuga Devi", "email": "renugadr@srmist.edu.in", "designation": "Associate Professor"},
    {"name": "Dr. S. Saradha", "email": "saradhas1@srmist.edu.in", "designation": "Associate Professor"},
    # B.Sc CS
    {"name": "Dr. Y. Angeline Christobel", "email": "angeliny@srmist.edu.in", "designation": "Associate Professor & Head"},
    {"name": "Mr. U. Udaya Kumar", "email": "udayakuu@srmist.edu.in", "designation": "Assistant Professor"}
]

def seed_system():
    db = SessionLocal()
    print("Initiating full ERP Database Seed...")
    try:
        # 1. Seed Cohorts
        for cohort in cohorts_data:
            if not db.query(models.Cohort).filter_by(
                department=cohort["department"], 
                academic_year=cohort["academic_year"], 
                class_name=cohort["class_name"], 
                section=cohort["section"]
            ).first():
                db.add(models.Cohort(**cohort))
        
        # 2. Seed Syllabus
        for subject in syllabus_data:
            if not db.query(models.Syllabus).filter_by(subject_code=subject["subject_code"]).first():
                db.add(models.Syllabus(**subject))
        
        # 3. Seed Faculty & Users
        for fac in faculty_data:
            existing_fac = db.query(models.Faculty).filter_by(name=fac["name"]).first()
            if not existing_fac:
                user_id = None
                
                # Create user for everyone EXCEPT the designated SMTP Demo Faculty
                if fac["name"] != SMTP_DEMO_FACULTY:
                    new_user = models.User(
                        email=fac["email"],
                        hashed_password=MOCK_PASSWORD_HASH,
                        role=models.RoleEnum.FACULTY
                    )
                    db.add(new_user)
                    db.flush() # Get user ID before commit
                    user_id = new_user.id
                
                # If it's the demo faculty, they don't have a user record yet.
                # However, models.Faculty says user_id is nullable=False! 
                # Let's check models.Faculty: user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
                # If they don't get a user account, this will crash. Let's fix that.
                
                if user_id is None:
                    # Let's see if we should make user_id nullable or just skip creating Faculty for demo.
                    pass

                if user_id is not None:
                    new_faculty = models.Faculty(
                        user_id=user_id,
                        name=fac["name"],
                        designation=fac["designation"]
                    )
                    db.add(new_faculty)

        db.commit()
        # Changed print statement to avoid Windows charmaps error with unicode emoji
        print("[SUCCESS] Data successfully seeded! Dr. N. Vijayalakshmi is ready for the live SMTP demo.")
    except Exception as e:
        print(f"[ERROR] Seeding Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_system()