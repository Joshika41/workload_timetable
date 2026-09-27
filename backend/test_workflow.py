import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

from unittest import mock
import app.routers.auth as auth_router

# Mock verify_password to bypass passlib/bcrypt bugs on Python 3.12+
def mock_verify(*args, **kwargs):
    return True
auth_router.verify_password = mock_verify

def test_full_workflow():
    # 1. Login as Admin/HOD
    login_data_admin = {"username": "hod@srm.edu", "password": "password123"}
    response_admin = client.post("/api/auth/login", data=login_data_admin)
    assert response_admin.status_code == 200, f"HOD login failed: {response_admin.text}"
    admin_token = response_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    # 2. Login as Faculty
    login_data = {"username": "drx@srm.edu", "password": "password123"}
    response = client.post("/api/auth/login", data=login_data)
    assert response.status_code == 200, f"Faculty login failed: {response.text}"
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get Academic Workspaces
    response = client.get("/api/academic-workspaces", headers=headers)
    assert response.status_code == 200, f"Failed academic workspaces: {response.text}"

    # 4. Get Subjects
    response = client.get("/api/subjects", headers=headers)
    assert response.status_code == 200
    subjects = response.json()
    assert len(subjects) > 0

    # 5. Submit Preferences
    submit_req = {
        "academic_year_id": 1,
        "semester_type": "ODD",
        "preferences": [
            {"subject_id": subjects[0]["id"], "rank": 1}
        ]
    }
    response = client.post("/api/faculty/preferences", json=submit_req, headers=headers)
    if response.status_code == 400 and "already submitted" in response.text:
        # Ignore if already submitted
        pass
    else:
        assert response.status_code == 200, f"Submit prefs failed: {response.text}"

    # 6. Admin Get Preferences
    response = client.get("/api/coordinator/preferences", headers=admin_headers)
    assert response.status_code == 200
    prefs = response.json()
    assert len(prefs) > 0
    pref_item_id = prefs[0]["items"][0]["id"]

    # 7. Admin Approve Preference
    response = client.patch(f"/api/coordinator/preferences/{pref_item_id}", json={"decision": "APPROVED"}, headers=admin_headers)
    assert response.status_code == 200

    # 8. Allocate Subject
    alloc_req = {
        "section_id": 1,
        "components": [
            {
                "faculty_id": prefs[0]["faculty_id"],
                "role": "MAIN",
                "theory_hours": subjects[0]["theory_hours"],
                "practical_hours": subjects[0]["practical_hours"]
            }
        ]
    }
    response = client.post("/api/allocations", json=alloc_req, headers=admin_headers)
    assert response.status_code == 200, f"Allocation failed: {response.text}"

    # 9. Get Workloads
    response = client.get("/api/workload/faculty", headers=admin_headers)
    assert response.status_code == 200
    assert len(response.json()) > 0

