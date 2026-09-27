import httpx
import json

base_url = "http://localhost:8000"

def run_e2e_test():
    print("Starting E2E Workflow Test...")
    with httpx.Client(base_url=base_url) as client:
        # 1. Login HOD to get initial state and prep
        r = client.post("/api/auth/login", data={"username": "hod_mcamcagenai@srm.edu", "password": "123456"})
        assert r.status_code == 200, f"HOD login failed: {r.text}"
        hod_token = r.json()["access_token"]
        hod_headers = {"Authorization": f"Bearer {hod_token}"}
        
        # Un-finalize everything for tests
        r = client.post("/api/workload/reopen/department", headers=hod_headers)
        
        # 2. Login Faculty
        r = client.post("/api/auth/login", data={"username": "meenakshi@srm.edu", "password": "123456"})
        assert r.status_code == 200, f"Faculty login failed: {r.text}"
        fac_json = r.json()
        fac_token = fac_json["access_token"]
        fac_headers = {"Authorization": f"Bearer {fac_token}"}
        faculty_id = fac_json["faculty_profile_id"]
        
        # 3. Get workspaces and subjects for Faculty
        r = client.get("/api/academic-workspaces", headers=fac_headers)
        workspaces = r.json()
        assert len(workspaces) > 0, "No workspaces found for faculty"
        ws_id = workspaces[0]["workspace_id"]
        
        r = client.get(f"/api/subjects?workspace_id={ws_id}", headers=fac_headers)
        subjects = r.json()
        core_sub = next(s for s in subjects if s["category"] == "CORE")
        elec_sub = next(s for s in subjects if s["category"] == "ELECTIVE")
        
        # Submit preference
        pref_payload = {
            "workspace_id": ws_id,
            "preferences": [
                {
                    "subject_id": core_sub["id"],
                    "rank": 1
                },
                {
                    "subject_id": elec_sub["id"],
                    "rank": 2
                }
            ]
        }
        r = client.post("/api/faculty/preferences", json=pref_payload, headers=fac_headers)
        assert r.status_code == 200, f"Preference submission failed: {r.text}"
        
        # 4. HOD logs in and allocates
        r = client.get(f"/api/faculty/detail/{faculty_id}", headers=hod_headers)
        assert r.status_code == 200, f"Faculty detail fetch failed: {r.text}"
        fac_detail = r.json()
        valid_sections = fac_detail["preferences"][0]["sections"]
        target_section = valid_sections[0] if valid_sections else "A"
        
        alloc_payload = {
            "allocations": [
                {
                    "subject_id": core_sub["id"],
                    "approval": "APPROVED",
                    "section": target_section,
                    "role": "Incharge-1",
                    "theory_hours": 3,
                    "lab_hours": 2
                }
            ]
        }
        r = client.post(f"/api/faculty/{faculty_id}/allocations", json=alloc_payload, headers=hod_headers)
        assert r.status_code == 200, f"HOD allocation failed: {r.text}"
        
        # 5. HOD Finalizes Department
        r = client.post("/api/workload/finalize/department", headers=hod_headers)
        assert r.status_code == 200, f"Finalization failed: {r.text}"
        
        # 6. Check Faculty Workload (Workload matrix/viewer)
        r = client.get(f"/api/workload/faculty?workspace_id={ws_id}", headers=hod_headers)
        assert r.status_code == 200, f"Workload fetch failed: {r.text}"
        faculty_wl = next(f for f in r.json() if f["faculty_id"] == faculty_id)
        assert faculty_wl["status"] == "Finalized", "Faculty workload is not Finalized!"
        assert faculty_wl["total_teaching_hours"] == 5, f"Hours don't tally! Expected 5, got {faculty_wl['total_teaching_hours']}"
        
        # 7. Download PDF
        r = client.get("/api/workload/export.pdf", headers=hod_headers)
        assert r.status_code == 200, f"PDF export failed: {r.text}"
        assert r.headers["content-type"] == "application/pdf"
        
        print("E2E Test completed successfully!")

if __name__ == "__main__":
    run_e2e_test()
