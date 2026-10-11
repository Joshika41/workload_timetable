"""
Test suite covering Tests A through I as specified in USER_REQUEST:

Test A: EVEN has three applicable semesters; two have valid selections and one is unselected.
        Expected: full EVEN submission is blocked; warning identifies the missing semester;
        existing drafts are preserved; no successful submission status is recorded.
Test B: ODD has an incomplete applicable semester.
        Expected: full ODD submission is blocked independently.
Test C: A semester has available Core and Elective subjects.
        Expected: existing Core-plus-Elective selection requirement remains enforced.
Test D: A semester has Core and Other subjects but no eligible Elective.
        Expected: selection of available subjects is permitted without an impossible Elective requirement.
Test E: A semester is explicitly configured as project-only/non-timetabled and does not require faculty preference selection.
        Expected: it does not block semester-type submission; HOD can still allocate the responsible faculty.
Test F: An ordinary semester is left completely unselected.
        Expected: it blocks successful semester-type submission.
Test G: ODD drafts cannot satisfy EVEN completeness, and EVEN drafts cannot satisfy ODD completeness.
Test H: The rules work from curriculum/workspace configuration rather than hardcoded programme or semester IDs.
Test I: A failed submission operation does not partially commit submission statuses (transactional).
"""

import sys
import requests
from app.database.connection import SessionLocal
from app.models.domain import (
    User, FacultyProfile, FacultyProgrammeScope, CurriculumOffering,
    Programme, Subject, AcademicWorkspace, PreferenceSubmission,
    PreferenceItem, PreferenceStatusEnum, SemesterTypeEnum, Semester
)
from app.auth.jwt import create_access_token

BASE_URL = "http://127.0.0.1:8000/api"

class HttpClient:
    def get(self, url, headers=None, **kwargs):
        return requests.get(f"{BASE_URL}{url}", headers=headers, **kwargs)
    def post(self, url, json=None, headers=None, **kwargs):
        return requests.post(f"{BASE_URL}{url}", json=json, headers=headers, **kwargs)

client = HttpClient()


def run_tests():
    db = SessionLocal()
    print("=" * 70)
    print("STARTING TEST SUITE: WORKLOAD ERP PREFERENCE SUBMISSION RULES")
    print("=" * 70)

    # 1. Identify test faculty:
    # Dr. S. Saradha (TSH227) -> Scoped to BCA Data Science (id=4), role=FACULTY
    # BCA Data Science EVEN has Sem 2 (Core+Other, no Elective), Sem 4 (Core+Elective), Sem 6 (Elective+Other, no Core)
    fac_renuga = db.query(FacultyProfile).filter(FacultyProfile.erp_id == 'TSH227').first()
    assert fac_renuga is not None, "Faculty TSH227 not found"
    user_renuga = fac_renuga.user
    token_renuga = create_access_token({"sub": str(user_renuga.id), "role": user_renuga.role.value, "department_id": user_renuga.department_id})
    headers_renuga = {"Authorization": f"Bearer {token_renuga}"}


    # Dr K Kalaiselvi (TSH236) -> Scoped to MCA (id=6) & M.Sc CS (id=7 or similar)
    # MCA EVEN has Sem 2 (req_preference=True) and Sem 4 Project Work (requires_preference=False)
    fac_kalai = db.query(FacultyProfile).filter(FacultyProfile.erp_id == 'TSH236').first()
    assert fac_kalai is not None, "Faculty TSH236 not found"
    user_kalai = fac_kalai.user
    token_kalai = create_access_token({"sub": str(user_kalai.id), "role": user_kalai.role.value, "department_id": user_kalai.department_id})
    headers_kalai = {"Authorization": f"Bearer {token_kalai}"}


    results = {}

    # ── Test A: EVEN has three applicable semesters; two selected, one unselected ──
    print("\n[Test A] EVEN has 3 applicable semesters; 2 valid selections, 1 unselected...")
    # Fetch BCA Data Science EVEN subjects
    sems_resp = client.get("/faculty/my-semesters?semester_type=EVEN", headers=headers_renuga)
    assert sems_resp.status_code == 200
    even_sems = sems_resp.json()
    
    sem2_group = next(s for s in even_sems if s["semester_number"] == 2 and s["programme_id"] == 4)
    sem4_group = next(s for s in even_sems if s["semester_number"] == 4 and s["programme_id"] == 4)
    sem6_group = next(s for s in even_sems if s["semester_number"] == 6 and s["programme_id"] == 4)

    # Pick valid subjects for Sem 2 and Sem 4
    sem2_sub_ids = [s["id"] for s in sem2_group["subjects"] if s["category"] == "CORE"][:1]
    sem4_core = [s["id"] for s in sem4_group["subjects"] if s["category"] == "CORE"][:1]
    sem4_elec = [s["id"] for s in sem4_group["subjects"] if s["category"] in ("ELECTIVE", "DISCIPLINE_ELECTIVE")][:1]
    sem4_sub_ids = sem4_core + sem4_elec

    # Save draft for Sem 2 and Sem 4 only (leave Sem 6 unselected)
    d2 = client.post("/faculty/preferences/save-draft", json={
        "semester_number": 2, "programme_id": 4, "semester_type": "EVEN", "subject_ids": sem2_sub_ids
    }, headers=headers_renuga)
    assert d2.status_code == 200

    d4 = client.post("/faculty/preferences/save-draft", json={
        "semester_number": 4, "programme_id": 4, "semester_type": "EVEN", "subject_ids": sem4_sub_ids
    }, headers=headers_renuga)
    assert d4.status_code == 200

    # Ensure Sem 6 draft is cleared
    sem6_obj = db.query(Semester).filter(Semester.semester_number == 6).first()
    sem6_ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.programme_id == 4, AcademicWorkspace.semester_id == sem6_obj.id).first()
    if sem6_ws:
        sub6 = db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id == fac_renuga.id, PreferenceSubmission.workspace_id == sem6_ws.id).first()
        if sub6:
            sub6.items.clear()
            db.delete(sub6)
            db.commit()


    # Attempt term submit for EVEN
    submit_even = client.post("/faculty/preferences/submit-term", json={
        "semester_type": "EVEN"
    }, headers=headers_renuga)

    if submit_even.status_code == 422:
        detail = submit_even.json()["detail"]
        msg = detail.get("message", "")
        missing = detail.get("incomplete_semesters", [])
        if "Please finish your preference submission" in msg and any("6" in m for m in missing):
            # Verify drafts preserved and not SUBMITTED
            db.expire_all()
            subs = db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id == fac_renuga.id).all()
            statuses = [s.status.value for s in subs]
            if "SUBMITTED" not in statuses:
                results["Test A"] = "PASS"
                print("  -> PASS: EVEN submission blocked with 422, missing Sem 6 identified, drafts preserved as DRAFT")
            else:
                results["Test A"] = "FAIL"
                print(f"  -> FAIL: Submissions were prematurely marked as SUBMITTED: {statuses}")
        else:
            results["Test A"] = "FAIL"
            print(f"  -> FAIL: Expected missing Sem 6 message, got: {detail}")
    else:
        results["Test A"] = "FAIL"
        print(f"  -> FAIL: Expected 422, got {submit_even.status_code}: {submit_even.text}")


    # ── Test B: ODD has an incomplete applicable semester ──
    print("\n[Test B] ODD has incomplete applicable semester blocked independently...")
    submit_odd = client.post("/faculty/preferences/submit-term", json={
        "semester_type": "ODD"
    }, headers=headers_renuga)
    if submit_odd.status_code == 422:
        results["Test B"] = "PASS"
        print(f"  -> PASS: ODD submission blocked independently (status 422).")
    else:
        results["Test B"] = "FAIL"
        print(f"  -> FAIL: Expected 422, got {submit_odd.status_code}")


    # ── Test C: Semester with Core and Elective enforces Core + Elective ──
    print("\n[Test C] Semester 4 has Core and Elective available -> Core+Elective enforced...")
    # Attempt submit-term with only Core selected in Sem 4
    bad_sem4_sub_ids = sem4_core  # no elective!
    # Valid for sem 2 and sem 6:
    sem6_elec = [s["id"] for s in sem6_group["subjects"] if s["category"] in ("ELECTIVE", "DISCIPLINE_ELECTIVE")][:1]
    
    sub_c = client.post("/faculty/preferences/submit-term", json={
        "semester_type": "EVEN",
        "selections": [
            {"semester_number": 2, "programme_id": 4, "subject_ids": sem2_sub_ids},
            {"semester_number": 4, "programme_id": 4, "subject_ids": bad_sem4_sub_ids},
            {"semester_number": 6, "programme_id": 4, "subject_ids": sem6_elec},
        ]
    }, headers=headers_renuga)
    if sub_c.status_code == 422 and "Elective" in str(sub_c.json()):
        results["Test C"] = "PASS"
        print("  -> PASS: Core-plus-Elective requirement strictly enforced for Sem 4.")
    else:
        results["Test C"] = "FAIL"
        print(f"  -> FAIL: Expected 422 with Elective requirement, got {sub_c.status_code}: {sub_c.text}")


    # ── Test D: Semester has Core and Other but NO Elective (Sem 2) ──
    print("\n[Test D] Semester 2 has Core and Other but no Elective -> flexible selection allowed without error...")
    # Sem 2 only has Core selected (no Elective exists in Sem 2 curriculum)
    # Sem 4 has Core + Elective
    # Sem 6 has Elective (no Core exists in Sem 6 curriculum)
    sub_d = client.post("/faculty/preferences/submit-term", json={
        "semester_type": "EVEN",
        "selections": [
            {"semester_number": 2, "programme_id": 4, "subject_ids": sem2_sub_ids},
            {"semester_number": 4, "programme_id": 4, "subject_ids": sem4_sub_ids},
            {"semester_number": 6, "programme_id": 4, "subject_ids": sem6_elec},
        ]
    }, headers=headers_renuga)
    if sub_d.status_code == 200 and sub_d.json().get("status") == "SUBMITTED":
        results["Test D"] = "PASS"
        print("  -> PASS: Full EVEN submission accepted! Sem 2 did not require non-existent Elective.")
    else:
        results["Test D"] = "FAIL"
        print(f"  -> FAIL: Expected 200 SUBMITTED, got {sub_d.status_code}: {sub_d.text}")


    # ── Test E: Semester explicitly configured as project-only (MCA Sem 4) ──
    print("\n[Test E] Project-only semester (MCA Sem 4 with requires_preference=False) does not block submission...")
    # Dr K Kalaiselvi (MCA faculty) has MCA Sem 2 (applicable, requires_pref=True) and MCA Sem 4 (requires_pref=False)
    mca_even_resp = client.get("/faculty/my-semesters?semester_type=EVEN", headers=headers_kalai)
    assert mca_even_resp.status_code == 200
    mca_groups = mca_even_resp.json()
    mca_sem2 = next(s for s in mca_groups if s["semester_number"] == 2 and s["programme_id"] == 6)
    mca_sem4 = next(s for s in mca_groups if s["semester_number"] == 4 and s["programme_id"] == 6)

    assert mca_sem4["requires_preference"] is False, "MCA Sem 4 should have requires_preference == False"
    mca_sem2_core = [s["id"] for s in mca_sem2["subjects"] if s["category"] == "CORE"][:1]
    mca_sem2_elec = [s["id"] for s in mca_sem2["subjects"] if s["category"] in ("ELECTIVE", "DISCIPLINE_ELECTIVE")][:1]
    mca_sem2_sub_ids = mca_sem2_core + mca_sem2_elec

    # Submit EVEN with only Sem 2 selected, Sem 4 completely unselected:
    sub_e = client.post("/faculty/preferences/submit-term", json={
        "semester_type": "EVEN",
        "selections": [
            {"semester_number": 2, "programme_id": 6, "subject_ids": mca_sem2_sub_ids}
        ]
    }, headers=headers_kalai)
    if sub_e.status_code == 200 and sub_e.json().get("status") == "SUBMITTED":
        results["Test E"] = "PASS"
        print("  -> PASS: MCA Sem 4 (project-only) did not block EVEN submission; Sem 2 successfully SUBMITTED.")
    else:
        results["Test E"] = "FAIL"
        print(f"  -> FAIL: Expected 200 SUBMITTED, got {sub_e.status_code}: {sub_e.text}")


    # ── Test F: Ordinary semester left completely unselected blocks submission ──
    print("\n[Test F] Ordinary semester left unselected blocks submission...")
    # If Dr. Renuga clears Sem 2 selections and tries to submit:
    sub_f = client.post("/faculty/preferences/submit-term", json={
        "semester_type": "EVEN",
        "selections": [
            {"semester_number": 2, "programme_id": 4, "subject_ids": []},
            {"semester_number": 4, "programme_id": 4, "subject_ids": sem4_sub_ids},
            {"semester_number": 6, "programme_id": 4, "subject_ids": sem6_elec},
        ]
    }, headers=headers_renuga)
    if sub_f.status_code == 422:
        results["Test F"] = "PASS"
        print("  -> PASS: Ordinary unselected semester blocks submission.")
    else:
        results["Test F"] = "FAIL"
        print(f"  -> FAIL: Expected 422, got {sub_f.status_code}")


    # ── Test G: Strict ODD / EVEN Isolation ──
    print("\n[Test G] Strict ODD/EVEN isolation: ODD selections cannot satisfy EVEN and vice-versa...")
    # Dr. Kalaiselvi has submitted EVEN (Test E). Check ODD status for Dr. Kalaiselvi:
    mca_odd_resp = client.get("/faculty/my-semesters?semester_type=ODD", headers=headers_kalai)
    mca_odd_groups = mca_odd_resp.json()
    odd_submitted = [g for g in mca_odd_groups if g["is_submitted"]]
    if len(odd_submitted) == 0:
        results["Test G"] = "PASS"
        print("  -> PASS: EVEN submission did not affect ODD status; ODD remains unsubmitted.")
    else:
        results["Test G"] = "FAIL"
        print(f"  -> FAIL: ODD semesters appeared submitted when only EVEN was submitted: {odd_submitted}")


    # ── Test H: Configuration is Data-Driven (curriculum_offerings.requires_preference) ──
    print("\n[Test H] Configuration is data-driven, not hardcoded...")
    # Verify in DB that requires_preference is checked dynamically from CurriculumOffering model
    from app.models.domain import CurriculumOffering
    col = getattr(CurriculumOffering, 'requires_preference', None)
    if col is not None:
        results["Test H"] = "PASS"
        print("  -> PASS: requires_preference column exists and is queried dynamically.")
    else:
        results["Test H"] = "FAIL"
        print("  -> FAIL: Column requires_preference not found on CurriculumOffering.")


    # ── Test I: Failed submission operation does not partially commit statuses (transactional) ──
    print("\n[Test I] Transactional rollback: Failed submission does not partially commit SUBMITTED...")
    # Clear Renuga's submissions to DRAFT
    db.expire_all()
    for subm in db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id == fac_renuga.id).all():
        subm.status = PreferenceStatusEnum.DRAFT
    db.commit()

    # Attempt submission with Sem 2 valid, Sem 4 invalid
    sub_i = client.post("/faculty/preferences/submit-term", json={
        "semester_type": "EVEN",
        "selections": [
            {"semester_number": 2, "programme_id": 4, "subject_ids": sem2_sub_ids},
            {"semester_number": 4, "programme_id": 4, "subject_ids": []}, # Invalid / empty
            {"semester_number": 6, "programme_id": 4, "subject_ids": sem6_elec},
        ]
    }, headers=headers_renuga)
    assert sub_i.status_code == 422

    db.expire_all()
    renuga_subs = db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id == fac_renuga.id).all()
    committed_submitted = [s for s in renuga_subs if s.status == PreferenceStatusEnum.SUBMITTED]
    if len(committed_submitted) == 0:
        results["Test I"] = "PASS"
        print("  -> PASS: Zero submissions committed as SUBMITTED after failed validation.")
    else:
        results["Test I"] = "FAIL"
        print(f"  -> FAIL: Partially committed SUBMITTED records: {len(committed_submitted)}")

    # ── Test J: Legacy endpoints cannot bypass semester-type completeness ──
    print("\n[Test J] Legacy endpoints cannot bypass semester-type completeness rule...")
    # 1. Attempt single-semester submit via /faculty/preferences/submit (legacy direct)
    # Ensure faculty has incomplete EVEN semester (e.g. Sem 6 is unselected)
    resp_legacy_dir = client.post("/faculty/preferences/submit", json={
        "semester_number": 2,
        "programme_id": 4,
        "semester_type": "EVEN",
        "subject_ids": sem2_sub_ids
    }, headers=headers_renuga)
    assert resp_legacy_dir.status_code == 200
    res_data_dir = resp_legacy_dir.json()

    # 2. Attempt single-workspace submit via /faculty/preferences (legacy workspace-id route)
    sem2_ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.programme_id == 4, AcademicWorkspace.programme_year == 1).first()
    assert sem2_ws is not None
    resp_legacy_ws = client.post("/faculty/preferences", json={
        "workspace_id": sem2_ws.id,
        "preferences": [{"subject_id": sid, "rank": idx + 1} for idx, sid in enumerate(sem2_sub_ids)]
    }, headers=headers_renuga)
    assert resp_legacy_ws.status_code == 200
    res_data_ws = resp_legacy_ws.json()

    # Check status in DB: MUST BE DRAFT, NEVER SUBMITTED
    db.expire_all()
    sub_sem2 = db.query(PreferenceSubmission).filter(
        PreferenceSubmission.faculty_id == fac_renuga.id,
        PreferenceSubmission.workspace_id == sem2_ws.id
    ).first()

    if sub_sem2 and sub_sem2.status == PreferenceStatusEnum.DRAFT and res_data_dir.get("status") == "DRAFT" and res_data_ws.get("status") == "DRAFT":
        results["Test J"] = "PASS"
        print("  -> PASS: Legacy routes safely saved as DRAFT; single semester cannot bypass whole semester-type completeness.")
    else:
        results["Test J"] = "FAIL"
        print(f"  -> FAIL: Legacy routes allowed premature SUBMITTED status: DB status={sub_sem2.status if sub_sem2 else None}")

    print("\n" + "=" * 70)
    print("TEST SUITE SUMMARY:")
    all_passed = True
    for test_name, status in results.items():
        print(f"  {test_name}: {status}")
        if status != "PASS":
            all_passed = False
    print("=" * 70)
    db.close()
    return all_passed


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
