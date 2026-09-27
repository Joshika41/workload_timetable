import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup test database
TEST_DB_URL = "sqlite:///./test_isolation.db"
os.environ["DATABASE_URL"] = TEST_DB_URL

from app.main import app
from app.database.connection import get_db
from app.models.domain import (
    Base, Institution, Department, Programme, AcademicYear, Subject, CurriculumOffering,
    Section, User, FacultyProfile, RoleEnum, SemesterTypeEnum, SubjectAllocation, AllocationStatusEnum
)
from app.core.workspace import encode_workspace_id, WorkspaceContext
from app.auth.dependencies import get_current_user

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency override
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Seed Data
    inst = Institution(name="Test Inst")
    db.add(inst)
    db.commit()
    
    dept1 = Department(institution_id=inst.id, name="Dept 1")
    dept2 = Department(institution_id=inst.id, name="Dept 2")
    db.add_all([dept1, dept2])
    db.commit()
    
    prog1 = Programme(department_id=dept1.id, name="Prog 1", programme_type="PG")
    prog2 = Programme(department_id=dept2.id, name="Prog 2", programme_type="UG")
    db.add_all([prog1, prog2])
    db.commit()
    
    ay = AcademicYear(name="2026-2027")
    db.add(ay)
    db.commit()
    
    sub1 = Subject(course_code="SUB1", course_name="Subject 1", theory_hours=3, practical_hours=2, total_hours=5)
    sub2 = Subject(course_code="SUB2", course_name="Subject 2", theory_hours=4, practical_hours=0, total_hours=4)
    db.add_all([sub1, sub2])
    db.commit()
    
    co1 = CurriculumOffering(programme_id=prog1.id, academic_year_id=ay.id, subject_id=sub1.id, programme_year=1, semester=1, semester_type=SemesterTypeEnum.ODD)
    co2 = CurriculumOffering(programme_id=prog2.id, academic_year_id=ay.id, subject_id=sub2.id, programme_year=1, semester=1, semester_type=SemesterTypeEnum.ODD)
    db.add_all([co1, co2])
    db.commit()
    
    sec1a = Section(curriculum_offering_id=co1.id, name="A")
    sec1b = Section(curriculum_offering_id=co1.id, name="B")
    sec2a = Section(curriculum_offering_id=co2.id, name="A")
    db.add_all([sec1a, sec1b, sec2a])
    db.commit()
    
    # Allocations
    alloc1 = SubjectAllocation(section_id=sec1a.id, status=AllocationStatusEnum.UNALLOCATED)
    alloc2 = SubjectAllocation(section_id=sec1b.id, status=AllocationStatusEnum.UNALLOCATED)
    alloc3 = SubjectAllocation(section_id=sec2a.id, status=AllocationStatusEnum.UNALLOCATED)
    db.add_all([alloc1, alloc2, alloc3])
    db.commit()
    
    user1 = User(email="hod1@test.com", hashed_password="pw", role=RoleEnum.HOD, department_id=dept1.id)
    user2 = User(email="hod2@test.com", hashed_password="pw", role=RoleEnum.HOD, department_id=dept2.id)
    db.add_all([user1, user2])
    db.commit()
    
    fp1 = FacultyProfile(user_id=user1.id, erp_id="F1", name="HOD 1", designation="Prof")
    fp2 = FacultyProfile(user_id=user2.id, erp_id="F2", name="HOD 2", designation="Prof")
    db.add_all([fp1, fp2])
    db.commit()
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

def test_workspace_isolation(test_db, client):
    # Get users
    user1 = test_db.query(User).filter_by(email="hod1@test.com").first()
    user2 = test_db.query(User).filter_by(email="hod2@test.com").first()
    
    dept1 = test_db.query(Department).filter_by(name="Dept 1").first()
    dept2 = test_db.query(Department).filter_by(name="Dept 2").first()
    prog1 = test_db.query(Programme).filter_by(name="Prog 1").first()
    prog2 = test_db.query(Programme).filter_by(name="Prog 2").first()
    ay = test_db.query(AcademicYear).first()
    
    # Encode Workspaces
    ws1_ctx = WorkspaceContext(department_id=dept1.id, programme_id=prog1.id, programme_year=1, academic_year_id=ay.id, semester=1)
    ws2_ctx = WorkspaceContext(department_id=dept2.id, programme_id=prog2.id, programme_year=1, academic_year_id=ay.id, semester=1)
    ws1_id = encode_workspace_id(ws1_ctx)
    ws2_id = encode_workspace_id(ws2_ctx)

    # 1. HOD from Dept 1 requests WS2 -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: user1
    response = client.get(f"/api/allocations?workspace_id={ws2_id}")
    assert response.status_code == 403
    
    # 2. Workspace A subjects
    response = client.get(f"/api/subjects?workspace_id={ws1_id}")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["course_code"] == "SUB1"
    
    # 3. Workspace B subjects
    app.dependency_overrides[get_current_user] = lambda: user2
    response = client.get(f"/api/subjects?workspace_id={ws2_id}")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["course_code"] == "SUB2"
    
    # 4. Workspace A class matrix
    app.dependency_overrides[get_current_user] = lambda: user1
    response = client.get(f"/api/workload/class-matrix?workspace_id={ws1_id}")
    assert response.status_code == 200
    matrix = response.json()
    assert len(matrix) == 2 # 2 sections in WS1 (A and B)
    assert any(m["section_name"] == "A" for m in matrix)
    assert any(m["section_name"] == "B" for m in matrix)
    
    # 5. Workspace B class matrix
    app.dependency_overrides[get_current_user] = lambda: user2
    response = client.get(f"/api/workload/class-matrix?workspace_id={ws2_id}")
    assert response.status_code == 200
    matrix = response.json()
    assert len(matrix) == 1 # 1 section in WS2 (A)
    assert matrix[0]["section_name"] == "A"
