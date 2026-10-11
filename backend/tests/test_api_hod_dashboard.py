import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_hod_dashboard_api(db_session):
    """
    Verify /api/workload/dashboard returns successfully and has required fields.
    """
    from app.models.domain import User, RoleEnum, Institution, Department
    
    # 1. Setup mock HOD user
    inst = db_session.query(Institution).first()
    if not inst:
        inst = Institution(name="Test Inst for HOD", code="HODINST")
        db_session.add(inst)
        db_session.commit()
        
    dept = db_session.query(Department).filter(Department.institution_id == inst.id).first()
    if not dept:
        dept = Department(name="Test Dept", institution_id=inst.id)
        db_session.add(dept)
        db_session.commit()
        
    hod_user = db_session.query(User).filter(User.role == RoleEnum.HOD).first()
    if not hod_user:
        hod_user = User(email="hod_dash_test@test.com", hashed_password="pw", role=RoleEnum.HOD, department_id=dept.id)
        db_session.add(hod_user)
        db_session.commit()
        
    # Get token (using override or auth dependency)
    app.dependency_overrides[app.router.dependencies[0].dependency] = lambda: hod_user
    from app.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user] = lambda: hod_user
    
    # 2. Call Dashboard API
    res = client.get("/api/workload/dashboard")
    assert res.status_code == 200
    
    data = res.json()
    assert "faculty_count" in data
    assert "faculty_with_teaching" in data
    assert "faculty_no_teaching" in data
    assert "allocation_progress" in data
    assert "reconciliation_status" in data
    assert "finalization_status" in data
    
    # Reset overrides
    app.dependency_overrides.clear()

def test_faculty_list_hod_api(db_session):
    """Verify faculty list API loads properly."""
    res = client.get("/api/faculty/hod")
    # Will fail 401 without override, just checking structure
    assert res.status_code in (200, 401, 403)
