import pytest
from app.models.domain import (
    Institution, Department, Programme, AcademicYear, Semester,
    AcademicWorkspace, Subject, CurriculumOffering, Section, User,
    FacultyProfile, RoleEnum, SemesterTypeEnum
)
from app.database.connection import SessionLocal

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_actual_database_counts(db_session):
    institutions = db_session.query(Institution).count()
    departments = db_session.query(Department).count()
    programmes = db_session.query(Programme).count()
    ay = db_session.query(AcademicYear).count()
    semesters = db_session.query(Semester).count()
    workspaces = db_session.query(AcademicWorkspace).count()
    sections = db_session.query(Section).count()
    faculty = db_session.query(FacultyProfile).count()
    subjects = db_session.query(Subject).count()
    offerings = db_session.query(CurriculumOffering).count()
    
    # Just asserting they are > 0 to ensure the DB is not empty
    assert institutions > 0
    assert departments > 0
    assert programmes > 0
    assert ay > 0
    assert semesters > 0
    assert faculty > 0
    assert subjects > 0
    assert offerings > 0

def test_flabs_institution_isolation(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    et_inst = db_session.query(Institution).filter_by(code="ET").first()
    
    assert flabs_inst is not None
    assert et_inst is not None

    # Check FLABS departments
    flabs_depts = db_session.query(Department).filter_by(institution_id=flabs_inst.id).all()
    assert len(flabs_depts) > 0

    # Ensure none of these FLABS departments belong to E&T
    et_depts = db_session.query(Department).filter_by(institution_id=et_inst.id).all()
    et_dept_names = {d.name for d in et_depts}
    
    for fd in flabs_depts:
        assert fd.name not in et_dept_names, f"{fd.name} found in both FLABS and E&T"

def test_department_programme_relationships(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    flabs_depts = db_session.query(Department).filter_by(institution_id=flabs_inst.id).all()
    dept_ids = [d.id for d in flabs_depts]

    programmes = db_session.query(Programme).filter(Programme.department_id.in_(dept_ids)).all()
    assert len(programmes) > 0
    
    for p in programmes:
        assert p.department_id in dept_ids
        assert p.department.institution_id == flabs_inst.id

def test_programme_semester_workspace(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    flabs_depts = db_session.query(Department).filter_by(institution_id=flabs_inst.id).all()
    dept_ids = [d.id for d in flabs_depts]
    programmes = db_session.query(Programme).filter(Programme.department_id.in_(dept_ids)).all()
    prog_ids = [p.id for p in programmes]

    workspaces = db_session.query(AcademicWorkspace).filter(AcademicWorkspace.programme_id.in_(prog_ids)).all()
    
    for ws in workspaces:
        assert ws.programme_id in prog_ids
        assert ws.department_id in dept_ids

def test_semester_parity_and_exclusions(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    
    # Join FLABS institutions down to Curriculum Offerings
    offerings = db_session.query(CurriculumOffering).join(Programme).join(Department).filter(Department.institution_id == flabs_inst.id).all()
    
    for off in offerings:
        assert off.semester in [1, 2, 3, 4, 5, 6], "Semester 7/8 found in FLABS import"
        if off.semester % 2 == 1:
            assert off.semester_type == SemesterTypeEnum.ODD
        else:
            assert off.semester_type == SemesterTypeEnum.EVEN

def test_shift_and_fts_exclusion(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    faculty = db_session.query(FacultyProfile).join(User).join(Department).filter(Department.institution_id == flabs_inst.id).all()
    
    for fac in faculty:
        # Based on how it's stored. Currently the schema doesn't have a shift column in FacultyProfile, but it has faculty_type.
        # Let's ensure no FTS faculty_type exists
        assert fac.faculty_type != 'FTS'

def test_faculty_validation(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    faculty = db_session.query(FacultyProfile).join(User).join(Department).filter(Department.institution_id == flabs_inst.id).all()
    
    erp_ids = []
    for fac in faculty:
        assert fac.erp_id is not None
        assert fac.user is not None
        assert fac.user.department_id == fac.home_department_id
        erp_ids.append(fac.erp_id)
        
    assert len(erp_ids) == len(set(erp_ids)), "Duplicate ERP IDs found in Faculty"

def test_curriculum_offering_and_subject_identity(db_session):
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    offerings = db_session.query(CurriculumOffering).join(Programme).join(Department).filter(Department.institution_id == flabs_inst.id).all()
    
    for off in offerings:
        assert off.subject is not None
        # Check L T P totals if subject provides them
        sub = off.subject
        assert sub.total_hours == sub.theory_hours + sub.practical_hours
        
def test_no_class_coordinator(db_session):
    # Verify via hasattr that class_coordinator field does not exist
    assert not hasattr(FacultyProfile, "class_coordinator_id")
    assert not hasattr(Section, "class_coordinator_id")
    assert not hasattr(FacultyProfile, "coordinator_programme_id")

def test_partial_data_support(db_session):
    # Empty departments should be valid
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    # It's okay if a department has no faculty, the DB still holds it.
    assert flabs_inst is not None

def test_preference_and_allocation_foundation(db_session):
    # Import PreferenceItem and SubjectAllocation
    from app.models.domain import PreferenceItem, SubjectAllocation, AllocationComponent, AllocationRoleEnum
    assert hasattr(PreferenceItem, "subject_id")
    assert hasattr(SubjectAllocation, "section_id")
    assert hasattr(AllocationComponent, "faculty_id")
    
    # Check valid enums
    roles = [e.value for e in AllocationRoleEnum]
    assert "Incharge-1" in roles
    assert "Incharge-2" in roles
    assert "MAIN" not in roles
