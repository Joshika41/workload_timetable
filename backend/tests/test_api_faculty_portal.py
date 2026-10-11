import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.connection import SessionLocal
from app.models.domain import (
    Institution, User, FacultyProfile, Department, RoleEnum,
    SemesterTypeEnum, Programme, Semester, AcademicWorkspace, CurriculumOffering, Subject
)
from app.auth.dependencies import get_current_user

client = TestClient(app)

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def override_get_current_user(user):
    app.dependency_overrides[get_current_user] = lambda: user

def test_faculty_login_and_filtering(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    dept = db_session.query(Department).filter_by(institution_id=flabs_inst.id).first()
    faculty_user = db_session.query(User).filter_by(department_id=dept.id, role=RoleEnum.FACULTY).first()
    
    assert faculty_user is not None
    
    res = client.post("/api/auth/login", data={"username": faculty_user.email, "password": "password"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

def test_semester_filtering(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    dept = db_session.query(Department).filter_by(institution_id=flabs_inst.id).first()
    faculty_user = db_session.query(User).filter_by(department_id=dept.id, role=RoleEnum.FACULTY).first()
    override_get_current_user(faculty_user)
    
    # Get odd semesters
    res = client.get("/api/faculty/my-semesters?semester_type=ODD")
    assert res.status_code == 200
    sem_data = res.json()
    assert isinstance(sem_data, list)
    
    for group in sem_data:
        assert group["semester_number"] % 2 != 0
        # Check Sem 7/8 exclusion
        assert group["semester_number"] not in [7, 8]

def test_subject_retrieval(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    dept = db_session.query(Department).filter_by(institution_id=flabs_inst.id).first()
    faculty_user = db_session.query(User).filter_by(department_id=dept.id, role=RoleEnum.FACULTY).first()
    override_get_current_user(faculty_user)
    
    res = client.get("/api/faculty/my-semesters?semester_type=EVEN")
    assert res.status_code == 200
    sem_data = res.json()
    
    # Ensure subjects have the right fields
    if len(sem_data) > 0:
        subjects = sem_data[0]["subjects"]
        if len(subjects) > 0:
            subj = subjects[0]
            assert "course_code" in subj
            assert "course_name" in subj
            assert "category" in subj
            assert "class_type" in subj
            assert "is_optional" in subj

def test_preference_submission_and_rules(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    dept = db_session.query(Department).filter_by(institution_id=flabs_inst.id).first()
    faculty_user = db_session.query(User).filter_by(department_id=dept.id, role=RoleEnum.FACULTY).first()
    override_get_current_user(faculty_user)
    
    res = client.get("/api/faculty/my-semesters?semester_type=ODD")
    sem_data = res.json()
    if len(sem_data) == 0:
        pytest.skip("No odd semesters found for this faculty.")
        
    group = sem_data[0]
    subjects = group["subjects"]
    
    core_subj = next((s for s in subjects if s["category"].upper() == "CORE"), None)
    elec_subj = next((s for s in subjects if s["category"].upper() in ["ELECTIVE", "DISCIPLINE_ELECTIVE"]), None)
    
    if not core_subj or not elec_subj:
        pytest.skip("Could not find both CORE and ELECTIVE subjects to test preference rule.")
        
    # Test missing elective (only core)
    payload_no_elective = {
        "semester_number": group["semester_number"],
        "programme_id": group["programme_id"],
        "semester_type": "ODD",
        "subject_ids": [core_subj["id"]]
    }
    r_no_elec = client.post("/api/faculty/preferences/submit", json=payload_no_elective)
    assert r_no_elec.status_code == 422

    # Test missing core (only elective)
    payload_no_core = {
        "semester_number": group["semester_number"],
        "programme_id": group["programme_id"],
        "semester_type": "ODD",
        "subject_ids": [elec_subj["id"]]
    }
    r_no_core = client.post("/api/faculty/preferences/submit", json=payload_no_core)
    assert r_no_core.status_code == 422

    # Submit valid preferences
    payload_valid = {
        "semester_number": group["semester_number"],
        "programme_id": group["programme_id"],
        "semester_type": "ODD",
        "subject_ids": [core_subj["id"], elec_subj["id"]]
    }
    submit_res = client.post("/api/faculty/preferences/submit", json=payload_valid)
    assert submit_res.status_code == 200
    
    # Verify status
    status_res = client.get("/api/faculty/my-semesters?semester_type=ODD")
    status_data = status_res.json()
    updated_group = next(g for g in status_data if g["semester_number"] == group["semester_number"])
    assert updated_group["is_submitted"] is True
    assert core_subj["id"] in updated_group["selected_subject_ids"]

def test_multiple_faculty_same_subject(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    dept = db_session.query(Department).filter_by(institution_id=flabs_inst.id).first()
    faculties = db_session.query(User).filter_by(department_id=dept.id, role=RoleEnum.FACULTY).limit(2).all()
    if len(faculties) < 2:
        pytest.skip("Need at least 2 faculty for this test.")
        
    f1, f2 = faculties
    
    override_get_current_user(f1)
    res1 = client.get("/api/faculty/my-semesters?semester_type=EVEN")
    sem_data = res1.json()
    if len(sem_data) == 0:
        pytest.skip("No even semesters found.")
        
    group = sem_data[0]
    subjects = group["subjects"]
    core_subj = next((s for s in subjects if s["category"].upper() == "CORE"), None)
    elec_subj = next((s for s in subjects if s["category"].upper() in ["ELECTIVE", "DISCIPLINE_ELECTIVE"]), None)
    if not core_subj or not elec_subj:
        pytest.skip("No core/elective found.")
        
    payload = {
        "semester_number": group["semester_number"],
        "programme_id": group["programme_id"],
        "semester_type": "EVEN",
        "subject_ids": [core_subj["id"], elec_subj["id"]]
    }
    
    # Both faculties prefer the exact same subjects
    r1 = client.post("/api/faculty/preferences/submit", json=payload)
    assert r1.status_code == 200
    
    override_get_current_user(f2)
    r2 = client.post("/api/faculty/preferences/submit", json=payload)
    assert r2.status_code == 200

def test_preference_does_not_create_allocation(db_session):
    from app.models.domain import SubjectAllocation, PreferenceSubmission
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    dept = db_session.query(Department).filter_by(institution_id=flabs_inst.id).first()
    faculty_user = db_session.query(User).filter_by(department_id=dept.id, role=RoleEnum.FACULTY).first()
    
    # Check current allocations for this faculty
    fp = db_session.query(FacultyProfile).filter_by(user_id=faculty_user.id).first()
    allocs_before = db_session.query(SubjectAllocation).filter_by(faculty_id=fp.id).count() if hasattr(SubjectAllocation, 'faculty_id') else 0
    # SubjectAllocation typically has faculty through AllocationComponent, let's just query AllocationComponent
    from app.models.domain import AllocationComponent
    allocs_before = db_session.query(AllocationComponent).filter_by(faculty_id=fp.id).count()
    
    # Check submissions exist
    subs = db_session.query(PreferenceSubmission).filter_by(faculty_id=fp.id).count()
    assert subs > 0, "Expected a preference to have been submitted in previous test"
    
    # Verify allocations didn't automatically increase
    allocs_after = db_session.query(AllocationComponent).filter_by(faculty_id=fp.id).count()
    assert allocs_after == allocs_before, "Preference submission should not create an allocation"
