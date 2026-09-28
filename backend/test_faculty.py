import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
import app.routers.auth as auth_router

# Mock verify_password to run cleanly in test harness
auth_router.verify_password = lambda *a, **kw: True
client = TestClient(app)

def test_faculty_submission_and_hod_persistence():
    """Verify faculty subject preferences submission and persistence in HOD dashboard."""
    # 1. Login as Faculty (Dr. R. Agasthiyan)
    fac_login = client.post("/api/auth/login", data={"username": "agasthiyan@srm.edu", "password": "password123"})
    assert fac_login.status_code == 200, f"Faculty login failed: {fac_login.text}"
    fac_token = fac_login.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # 2. Query ODD Semesters
    res_sem = client.get("/api/faculty/my-semesters?semester_type=ODD", headers=fac_headers)
    assert res_sem.status_code == 200
    semesters = res_sem.json()
    assert len(semesters) > 0

    sem1 = next((s for s in semesters if s["semester_number"] == 1), None)
    assert sem1 is not None, "Semester 1 not found for MCA faculty"
    core = next((s for s in sem1["subjects"] if s["category"].upper() == "CORE"), None)
    elec = next((s for s in sem1["subjects"] if "ELECTIVE" in s["category"].upper()), None)
    assert core is not None and elec is not None, "Core or Elective subject missing in sem 1 offerings"

    # 3. Submit Preferences
    submit_payload = {
        "semester_number": 1,
        "programme_id": sem1["programme_id"],
        "semester_type": "ODD",
        "subject_ids": [core["id"], elec["id"]]
    }
    res_sub = client.post("/api/faculty/preferences/submit", json=submit_payload, headers=fac_headers)
    assert res_sub.status_code == 200, f"Submission failed: {res_sub.text}"

    # 4. Verify Faculty Query Reflects Submission
    res_my = client.get("/api/faculty/my-semesters?semester_type=ODD", headers=fac_headers)
    my_sem1 = next(s for s in res_my.json() if s["semester_number"] == 1)
    assert my_sem1["is_submitted"] is True
    assert set(my_sem1["selected_subject_ids"]) == {core["id"], elec["id"]}

    # 5. Login as HOD (MCA & MCA GEN AI)
    hod_login = client.post("/api/auth/login", data={"username": "hod_mcamcagenai@srm.edu", "password": "password123"})
    assert hod_login.status_code == 200, f"HOD login failed: {hod_login.text}"
    hod_token = hod_login.json()["access_token"]
    hod_headers = {"Authorization": f"Bearer {hod_token}"}

    # 6. Verify HOD Faculty List (ODD filter)
    res_hod_odd = client.get("/api/faculty/hod?semester_type=ODD", headers=hod_headers)
    assert res_hod_odd.status_code == 200
    f_item = next((f for f in res_hod_odd.json() if "Agasthiyan" in f["name"]), None)
    assert f_item is not None, "Dr. R. Agasthiyan missing from HOD faculty list"
    assert f_item["preference_status"] in ["Submitted", "Approved by HOD"]

    # 7. Check Detail View
    ag_id = f_item["faculty_id"]
    res_detail = client.get(f"/api/faculty/detail/{ag_id}", headers=hod_headers)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    pref_ids = [p["subject_id"] for p in detail.get("preferences", [])]
    assert core["id"] in pref_ids and elec["id"] in pref_ids

    # 8. Simulate Logout & Login Again (Session Persistence)
    hod_relogin = client.post("/api/auth/login", data={"username": "hod_mcamcagenai@srm.edu", "password": "password123"})
    new_hod_token = hod_relogin.json()["access_token"]
    new_hod_headers = {"Authorization": f"Bearer {new_hod_token}"}

    res_hod_odd2 = client.get("/api/faculty/hod?semester_type=ODD", headers=new_hod_headers)
    f_item2 = next((f for f in res_hod_odd2.json() if "Agasthiyan" in f["name"]), None)
    assert f_item2 is not None
    assert f_item2["preference_status"] in ["Submitted", "Approved by HOD"]

    detail2 = client.get(f"/api/faculty/detail/{ag_id}", headers=new_hod_headers).json()
    assert len(detail2.get("preferences", [])) >= 2

    # 9. Verify EVEN Semester Isolation
    res_hod_even = client.get("/api/faculty/hod?semester_type=EVEN", headers=new_hod_headers)
    assert res_hod_even.status_code == 200
    f_even = next((f for f in res_hod_even.json() if "Agasthiyan" in f["name"]), None)
    assert f_even is not None
    assert f_even["preference_status"] == "Not Submitted"

def test_allocation_and_status_update():
    """Verify allocating subjects updates preference status to Approved by HOD and allocation to Allocated."""
    hod_login = client.post("/api/auth/login", data={"username": "hod_mcamcagenai@srm.edu", "password": "password123"})
    hod_token = hod_login.json()["access_token"]
    hod_headers = {"Authorization": f"Bearer {hod_token}"}

    res_hod_odd = client.get("/api/faculty/hod?semester_type=ODD", headers=hod_headers)
    f_item = next(f for f in res_hod_odd.json() if "Agasthiyan" in f["name"])
    ag_id = f_item["faculty_id"]

    detail = client.get(f"/api/faculty/detail/{ag_id}", headers=hod_headers).json()
    first_pref = detail["preferences"][0]

    alloc_payload = {
        "allocations": [
            {
                "subject_id": first_pref["subject_id"],
                "semester_id": 1,
                "theory_hours": 3,
                "lab_hours": 0,
                "section": "A",
                "role": "Incharge-1",
                "approval": "APPROVED"
            }
        ]
    }
    save_res = client.post(f"/api/faculty/{ag_id}/allocations", json=alloc_payload, headers=hod_headers)
    assert save_res.status_code == 200, f"Save allocations failed: {save_res.text}"

    # Verify status in HOD list
    updated_list = client.get("/api/faculty/hod?semester_type=ODD", headers=hod_headers).json()
    ag_updated = next(f for f in updated_list if f["faculty_id"] == ag_id)
    assert ag_updated["preference_status"] == "Approved by HOD"
    assert ag_updated["allocation_status"] == "Allocated"

if __name__ == "__main__":
    test_faculty_submission_and_hod_persistence()
    test_allocation_and_status_update()
    print("ALL TESTS IN test_faculty.py PASSED SUCCESSFULLY!")
