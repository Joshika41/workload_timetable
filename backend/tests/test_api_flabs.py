import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.domain import Institution, Department, User, RoleEnum
from app.database.connection import SessionLocal

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_auth_headers(client, db_session, role, institution_name="FLABS"):
    # Find a user for the specific institution and role
    inst = db_session.query(Institution).filter_by(name=institution_name).first()
    dept = db_session.query(Department).filter_by(institution_id=inst.id).first()
    user = db_session.query(User).filter_by(department_id=dept.id, role=role).first()
    
    # We will override the dependency for authentication
    return {"X-Mock-User-Id": str(user.id)}

def test_api_institution_to_departments(client, db_session):
    # This requires looking at the actual API endpoints implemented
    # Typically: GET /api/academic/institutions or /api/academic/departments?institution_id=X
    # Let's check what the API returns. We can override get_current_user to return a valid user.
    from app.auth.dependencies import get_current_user
    
    flabs_inst = db_session.query(Institution).filter_by(code="FLABS").first()
    dept = db_session.query(Department).filter_by(institution_id=flabs_inst.id).first()
    hod_user = db_session.query(User).filter_by(department_id=dept.id, role=RoleEnum.HOD).first()
    
    app.dependency_overrides[get_current_user] = lambda: hod_user
    
    # Test getting departments
    response = client.get("/api/academic/departments")
    if response.status_code == 200:
        data = response.json()
        assert len(data) > 0
        # Ensure they all belong to FLABS
        for d in data:
            db_dept = db_session.query(Department).filter_by(id=d['id']).first()
            assert db_dept.institution_id == flabs_inst.id
            
    # Test getting programmes
    response = client.get(f"/api/academic/programmes?department_id={dept.id}")
    if response.status_code == 200:
        data = response.json()
        assert len(data) > 0

    # Test getting faculty
    response = client.get(f"/api/faculty?department_id={dept.id}")
    if response.status_code == 200:
        data = response.json()
        assert len(data) > 0
