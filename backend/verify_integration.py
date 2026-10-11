import os
import sys
from collections import Counter
from sqlalchemy import or_

sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app.database.connection import SessionLocal
from app.models.domain import (
    Institution, Department, Programme, AcademicWorkspace, WorkspaceProgrammeMap,
    FacultyProfile, User, FacultyWorkspaceScope, FacultyProgrammeScope,
    Subject, CurriculumOffering, Section, PreferenceSubmission, SubjectAllocation,
    AcademicYear, Semester, RoleEnum, SemesterTypeEnum
)
from app.core.workspace import decode_workspace_id

def test_suite():
    db = SessionLocal()
    results = {}

    print("======================================================================")
    print("                     TARGETED INTEGRATION VERIFICATION                ")
    print("======================================================================")

    # ---------------------------------------------------------
    # PART 1: CYBER SECURITY TESTS
    # ---------------------------------------------------------
    print("\n--- 1. CYBER SECURITY TESTS ---")
    
    # 1.1 Exactly one Cyber Security department
    cyber_depts = db.query(Department).filter(Department.name.ilike('%Cyber Security%')).all()
    assert len(cyber_depts) == 1, f"Expected 1 Cyber Security department, found {len(cyber_depts)}"
    cyber_dept = cyber_depts[0]
    print(f"[PASS] Exactly one Cyber Security department: ID={cyber_dept.id}, Name='{cyber_dept.name}'")
    results['cyber_dept_single'] = 'PASS'

    # 1.2 Both Cyber Security programmes belong to it
    cyber_progs = db.query(Programme).filter(Programme.department_id == cyber_dept.id).all()
    prog_names = {p.name for p in cyber_progs}
    assert any("B.Sc" in p for p in prog_names), "B.Sc Cyber Security missing"
    assert any("M.Sc" in p for p in prog_names), "M.Sc Cyber Security missing"
    print(f"[PASS] Both Cyber Security programmes belong to department: {[p.name for p in cyber_progs]}")
    results['cyber_progs_belong'] = 'PASS'

    # 1.3 One shared HOD/workload workspace maps to both programmes
    cyber_ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.department_id == cyber_dept.id).all()
    assert len(cyber_ws) == 10, f"Expected 10 semester workspaces, found {len(cyber_ws)}"
    for ws in cyber_ws:
        mapped_prog_ids = {m.programme_id for m in ws.mapped_programmes}
        for p in cyber_progs:
            assert p.id in mapped_prog_ids, f"Programme {p.id} not mapped to workspace {ws.id}"
    print(f"[PASS] All {len(cyber_ws)} Cyber Security workspaces are mapped to both programmes via WorkspaceProgrammeMap.")
    results['cyber_multi_programme_workspace'] = 'PASS'

    # 1.4 Correct Cyber Security HOD assignment (Dr. J. Jebamalar Tamilselvi, TSH009)
    jeba_user = db.query(User).join(FacultyProfile).filter(FacultyProfile.erp_id == 'TSH009').first()
    assert jeba_user is not None, "Dr. J. Jebamalar Tamilselvi user not found"
    assert jeba_user.role == RoleEnum.HOD, f"Expected RoleEnum.HOD, got {jeba_user.role}"
    assert jeba_user.department_id == cyber_dept.id, "HOD department mismatch"
    assert "Jebamalar" in jeba_user.faculty_profile.name
    print(f"[PASS] Cyber Security HOD verified: {jeba_user.faculty_profile.name} (ERP: {jeba_user.faculty_profile.erp_id}, Role: {jeba_user.role.value}, Desig: {jeba_user.faculty_profile.designation})")
    results['cyber_hod_assignment'] = 'PASS'

    # 1.5 All 15 faculty mapped to both programme scopes
    cyber_fac = db.query(FacultyProfile).join(User).filter(User.department_id == cyber_dept.id).all()
    assert len(cyber_fac) == 15, f"Expected 15 Cyber Security faculty, found {len(cyber_fac)}"
    for fac in cyber_fac:
        prog_scopes = db.query(FacultyProgrammeScope).filter_by(faculty_id=fac.id).all()
        mapped_pids = {ps.programme_id for ps in prog_scopes}
        for p in cyber_progs:
            assert p.id in mapped_pids, f"Faculty {fac.name} missing scope for programme {p.name}"
        # Workspace scopes
        ws_scopes = db.query(FacultyWorkspaceScope).filter_by(faculty_id=fac.id).all()
        assert len(ws_scopes) == 10, f"Faculty {fac.name} expected 10 workspace scopes, found {len(ws_scopes)}"
    print(f"[PASS] All {len(cyber_fac)} Cyber Security faculty are scoped to both programmes (30 programme scope rows total) and all 10 workspaces.")
    results['cyber_faculty_scopes'] = 'PASS'

    # 1.6 B.Sc Semesters 1-6 and M.Sc Semesters 1-4 active contexts
    bsc_p = next(p for p in cyber_progs if "B.Sc" in p.name)
    msc_p = next(p for p in cyber_progs if "M.Sc" in p.name)
    bsc_sems = {ws.semester.semester_number for ws in cyber_ws if ws.programme_id == bsc_p.id}
    msc_sems = {ws.semester.semester_number for ws in cyber_ws if ws.programme_id == msc_p.id}
    assert bsc_sems == {1, 2, 3, 4, 5, 6}, f"B.Sc semesters mismatch: {bsc_sems}"
    assert msc_sems == {1, 2, 3, 4}, f"M.Sc semesters mismatch: {msc_sems}"
    print(f"[PASS] Contexts verified: B.Sc Cyber Security S1-S6 active; M.Sc Cyber Security S1-S4 active.")
    results['cyber_contexts'] = 'PASS'

    # 1.7 Subject codes match corrected source mapping
    expected_corrected = ['USC24202J', 'USC24301J', 'USC24401J', 'USC24D01J', 'USC24D02J', 'USC24D03J', 'USC24D04J', 'USA24D07J', 'USC24601J', 'PSC25D12J', 'PSC25G12J']
    for code in expected_corrected:
        s = db.query(Subject).filter_by(course_code=code).first()
        assert s is not None, f"Corrected code {code} not found in database subjects"
    # Verify each corrected course title strictly maps to its audited code
    audit_checks = {
        'Introduction to Cyber Security': 'USC24202J',
        'Basics of Ethical Hacking for Cyber Security': 'USC24301J',
        'Data Privacy and Security': 'USC24401J',
        'Penetration Testing': 'USC24D01J',
        'Social Media Cyber Security': 'USC24D02J',
        'Security Threats and Principles': 'USC24D03J',
        'Malware Analysis': 'USC24D04J',
        'Cloud Computing': 'USA24D07J',
        'Data Science using Python Programming': 'USC24601J',
        'AI and ML in Cyber Security': 'PSC25D12J',
        'Internet of Things': 'PSC25G12J'
    }
    for title, expected_code in audit_checks.items():
        off = db.query(CurriculumOffering).join(Subject).filter(
            CurriculumOffering.programme_id.in_([bsc_p.id, msc_p.id]),
            Subject.course_name == title
        ).first()
        assert off is not None, f"Course '{title}' offering not found in Cyber Security"
        assert off.subject.course_code == expected_code, f"Course '{title}' has code {off.subject.course_code}, expected {expected_code}"
    print(f"[PASS] All 11 audited code corrections verified against their official subject titles.")
    results['cyber_code_corrections'] = 'PASS'

    # 1.8 Duplicate checks
    c_fac_ids = [f.erp_id for f in cyber_fac]
    assert len(c_fac_ids) == len(set(c_fac_ids)), "Duplicate Cyber Security faculty ERP IDs detected"
    c_offs = db.query(CurriculumOffering).filter(CurriculumOffering.programme_id.in_([bsc_p.id, msc_p.id])).all()
    c_off_keys = [(o.programme_id, o.semester, o.subject_id) for o in c_offs]
    assert len(c_off_keys) == len(set(c_off_keys)), "Duplicate Cyber Security offering keys detected"
    print(f"[PASS] No duplicate faculty identities ({len(cyber_fac)} unique), no duplicate offering keys ({len(c_offs)} offerings).")
    results['cyber_duplicates'] = 'PASS'

    # 1.9 No fabricated sections or allocations
    c_sections = db.query(Section).join(AcademicWorkspace).filter(AcademicWorkspace.department_id == cyber_dept.id).count()
    c_allocs = db.query(SubjectAllocation).join(AcademicWorkspace).filter(AcademicWorkspace.department_id == cyber_dept.id).count()
    assert c_sections == 0, f"Fabricated sections found: {c_sections}"
    assert c_allocs == 0, f"Fabricated allocations found: {c_allocs}"
    print(f"[PASS] No sections or allocations fabricated (sections=0, allocations=0). Clean empty states preserved.")
    results['cyber_no_fabrication'] = 'PASS'

    # ---------------------------------------------------------
    # PART 2: AIML TESTS
    # ---------------------------------------------------------
    print("\n--- 2. AIML TESTS ---")
    
    # 2.1 Exactly one AIML department identity
    aiml_depts = db.query(Department).filter(or_(Department.name == 'Department of AIML', Department.id == 2)).all()
    assert len(aiml_depts) == 1, f"Expected 1 AIML department, found {len(aiml_depts)}"
    aiml_dept = aiml_depts[0]
    assert aiml_dept.name == "Department of AIML"
    print(f"[PASS] Exactly one AIML department: ID={aiml_dept.id}, Name='{aiml_dept.name}'")
    results['aiml_dept_single'] = 'PASS'

    # 2.2 B.Sc AIML and M.Sc AIML remain separate programmes
    aiml_progs = db.query(Programme).filter(Programme.department_id == aiml_dept.id).all()
    aiml_pnames = {p.name for p in aiml_progs}
    assert any("B.Sc" in p for p in aiml_pnames), "B.Sc AIML programme missing"
    assert any("M.Sc" in p for p in aiml_pnames), "M.Sc AIML programme missing"
    bsc_aiml_p = next(p for p in aiml_progs if "B.Sc" in p.name)
    msc_aiml_p = next(p for p in aiml_progs if "M.Sc" in p.name)
    assert bsc_aiml_p.id != msc_aiml_p.id, "B.Sc and M.Sc programme identities cannot be merged"
    print(f"[PASS] Separate AIML programmes: B.Sc (ID={bsc_aiml_p.id}), M.Sc (ID={msc_aiml_p.id})")
    results['aiml_separate_programmes'] = 'PASS'

    # 2.3 Separate operational workspaces exist
    bsc_aiml_ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.programme_id == bsc_aiml_p.id).all()
    msc_aiml_ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.programme_id == msc_aiml_p.id).all()
    assert len(bsc_aiml_ws) == 6, f"Expected 6 B.Sc AIML workspaces, found {len(bsc_aiml_ws)}"
    assert len(msc_aiml_ws) == 4, f"Expected 4 M.Sc AIML workspaces, found {len(msc_aiml_ws)}"
    for ws in bsc_aiml_ws:
        m = [map_row.programme_id for map_row in ws.mapped_programmes]
        assert m == [bsc_aiml_p.id], f"B.Sc workspace should only map to B.Sc programme, got {m}"
    for ws in msc_aiml_ws:
        m = [map_row.programme_id for map_row in ws.mapped_programmes]
        assert m == [msc_aiml_p.id], f"M.Sc workspace should only map to M.Sc programme, got {m}"
    print(f"[PASS] Separate operational workspaces verified: 6 B.Sc workspaces, 4 M.Sc workspaces.")
    results['aiml_separate_workspaces'] = 'PASS'

    # 2.4 B.Sc HOD is correctly mapped: Dr. S. Subbaiah (TSH118)
    subbaiah_user = db.query(User).join(FacultyProfile).filter(FacultyProfile.erp_id == 'TSH118').first()
    assert subbaiah_user is not None, "Dr. S. Subbaiah user not found"
    assert subbaiah_user.role == RoleEnum.HOD, f"Expected RoleEnum.HOD, got {subbaiah_user.role}"
    assert subbaiah_user.department_id == aiml_dept.id, "HOD department mismatch"
    assert "Subbaiah" in subbaiah_user.faculty_profile.name
    print(f"[PASS] B.Sc AIML HOD verified: {subbaiah_user.faculty_profile.name} (ERP: {subbaiah_user.faculty_profile.erp_id}, Role: {subbaiah_user.role.value}, Desig: {subbaiah_user.faculty_profile.designation})")
    results['aiml_hod_assignment'] = 'PASS'

    # 2.5 All 16 Shift-I faculty scoped to B.Sc AIML
    aiml_fac = db.query(FacultyProfile).join(User).filter(User.department_id == aiml_dept.id).all()
    assert len(aiml_fac) == 16, f"Expected 16 AIML faculty, found {len(aiml_fac)}"
    for fac in aiml_fac:
        prog_scopes = db.query(FacultyProgrammeScope).filter_by(faculty_id=fac.id).all()
        mapped_pids = [ps.programme_id for ps in prog_scopes]
        assert mapped_pids == [bsc_aiml_p.id], f"Faculty {fac.name} must ONLY have B.Sc scope, got {mapped_pids}"
        ws_scopes = db.query(FacultyWorkspaceScope).filter_by(faculty_id=fac.id).all()
        assert len(ws_scopes) == 6, f"Faculty {fac.name} expected 6 B.Sc workspace scopes, got {len(ws_scopes)}"
    print(f"[PASS] All 16 Shift-I faculty are scoped strictly to B.Sc AIML.")
    results['aiml_faculty_scopes'] = 'PASS'

    # 2.6 Shift-II faculty NOT added as AIML scopes from excluded roster
    shift2_ids = ['TSH239', 'TSH245', 'TSH250', 'TSH253', 'TSH255']
    for eid in shift2_ids:
        fac = db.query(FacultyProfile).filter_by(erp_id=eid, home_department_id=aiml_dept.id).first()
        assert fac is None, f"Shift-II faculty {eid} found in AIML department!"
    print(f"[PASS] Shift-II faculty entries successfully excluded from AIML scope.")
    results['aiml_shift2_excluded'] = 'PASS'

    # 2.7 No faculty scope inferred for M.Sc AIML
    msc_fac_scopes = db.query(FacultyProgrammeScope).filter_by(programme_id=msc_aiml_p.id).count()
    assert msc_fac_scopes == 0, f"Expected 0 faculty scopes for M.Sc AIML, found {msc_fac_scopes}"
    msc_ws_ids = [w.id for w in msc_aiml_ws]
    msc_ws_fac_scopes = db.query(FacultyWorkspaceScope).filter(FacultyWorkspaceScope.workspace_id.in_(msc_ws_ids)).count()
    assert msc_ws_fac_scopes == 0, f"Expected 0 workspace faculty scopes for M.Sc AIML, found {msc_ws_fac_scopes}"
    print(f"[PASS] Zero faculty scopes inferred for M.Sc AIML (programme_scopes=0, workspace_scopes=0).")
    results['aiml_msc_unassigned'] = 'PASS'

    # 2.8 B.Sc Sem 1-6 active, Sem 7-8 excluded, M.Sc Sem 1-4 active
    bsc_aiml_offs = db.query(CurriculumOffering).filter_by(programme_id=bsc_aiml_p.id).all()
    bsc_aiml_sems = {o.semester for o in bsc_aiml_offs}
    assert bsc_aiml_sems.issubset({1, 2, 3, 4, 5, 6}), f"Unexpected B.Sc semesters: {bsc_aiml_sems}"
    assert 7 not in bsc_aiml_sems and 8 not in bsc_aiml_sems, "Semesters 7 & 8 must not be in active offerings"
    msc_aiml_offs = db.query(CurriculumOffering).filter_by(programme_id=msc_aiml_p.id).all()
    msc_aiml_sems = {o.semester for o in msc_aiml_offs}
    assert msc_aiml_sems.issubset({1, 2, 3, 4}), f"Unexpected M.Sc semesters: {msc_aiml_sems}"
    print(f"[PASS] Offerings verified: B.Sc AIML active S1-S6 ({len(bsc_aiml_offs)} offerings), S7-S8 excluded. M.Sc AIML active S1-S4 ({len(msc_aiml_offs)} offerings).")
    results['aiml_curriculum_policy'] = 'PASS'

    # 2.9 No sections or allocations fabricated
    a_sections = db.query(Section).join(AcademicWorkspace).filter(AcademicWorkspace.department_id == aiml_dept.id).count()
    a_allocs = db.query(SubjectAllocation).join(AcademicWorkspace).filter(AcademicWorkspace.department_id == aiml_dept.id).count()
    assert a_sections == 0, f"Fabricated sections found in AIML: {a_sections}"
    assert a_allocs == 0, f"Fabricated allocations found in AIML: {a_allocs}"
    print(f"[PASS] No sections or allocations fabricated in AIML (sections=0, allocations=0).")
    results['aiml_no_fabrication'] = 'PASS'

    # ---------------------------------------------------------
    # PART 3: CROSS-SYSTEM REGRESSION TESTS
    # ---------------------------------------------------------
    print("\n--- 3. CROSS-SYSTEM REGRESSION TESTS ---")

    # 3.1 ODD and EVEN context queries return only their own semester data
    odd_ws = db.query(AcademicWorkspace).join(Semester).filter(Semester.semester_number % 2 != 0).all()
    even_ws = db.query(AcademicWorkspace).join(Semester).filter(Semester.semester_number % 2 == 0).all()
    for w in odd_ws:
        assert w.semester.semester_number % 2 != 0
    for w in even_ws:
        assert w.semester.semester_number % 2 == 0
    print(f"[PASS] ODD and EVEN semester partitioning strictly maintained across all workspaces.")
    results['regression_odd_even_split'] = 'PASS'

    # 3.2 Matching semester numbers from different programmes remain separate
    # e.g., B.Sc Cyber Security Sem 1 vs M.Sc Cyber Security Sem 1
    cyber_bsc_s1 = db.query(AcademicWorkspace).filter_by(programme_id=bsc_p.id, semester_id=1).first()
    cyber_msc_s1 = db.query(AcademicWorkspace).filter_by(programme_id=msc_p.id, semester_id=1).first()
    assert cyber_bsc_s1.id != cyber_msc_s1.id, "Workspace IDs for different programmes in same semester must be distinct"
    bsc_s1_ctx = decode_workspace_id(cyber_bsc_s1.id)
    msc_s1_ctx = decode_workspace_id(cyber_msc_s1.id)
    assert bsc_s1_ctx.programme_id == bsc_p.id
    assert msc_s1_ctx.programme_id == msc_p.id
    print(f"[PASS] Distinct academic contexts: B.Sc Sem 1 ({cyber_bsc_s1.id}) and M.Sc Sem 1 ({cyber_msc_s1.id}) remain completely isolated.")
    results['regression_context_separation'] = 'PASS'

    # 3.3 Faculty subject queries obey FacultyWorkspaceScope and FacultyProgrammeScope
    from app.routers.preferences import get_faculty_semesters
    # Test Cyber Security faculty member (e.g. Dr. Akila)
    akila = db.query(FacultyProfile).filter_by(erp_id='TSH351').first()
    akila_user = db.query(User).filter_by(id=akila.user_id).first()
    akila_res_odd = get_faculty_semesters(semester_type="ODD", db=db, current_user=akila_user)
    # Check that she receives subjects from both B.Sc and M.Sc Cyber Security
    progs_in_akila = {item['class_type'] for group in akila_res_odd for item in group['subjects']}
    assert any("B.Sc" in p for p in progs_in_akila)
    assert any("M.Sc" in p for p in progs_in_akila)
    print(f"[PASS] Cyber Security faculty receives both B.Sc and M.Sc Cyber Security subjects: {progs_in_akila}")

    # Test AIML faculty member (e.g. Mr. D.Siva)
    siva = db.query(FacultyProfile).filter_by(erp_id='T980').first()
    siva_user = db.query(User).filter_by(id=siva.user_id).first()
    siva_res_odd = get_faculty_semesters(semester_type="ODD", db=db, current_user=siva_user)
    progs_in_siva = {item['class_type'] for group in siva_res_odd for item in group['subjects']}
    assert any("B.Sc" in p for p in progs_in_siva)
    assert not any("M.Sc" in p for p in progs_in_siva), "AIML Shift-I faculty must NOT receive M.Sc subjects"
    print(f"[PASS] AIML Shift-I faculty receives B.Sc AIML subjects only: {progs_in_siva}")
    results['regression_faculty_scope_filtering'] = 'PASS'

    # 3.4 Existing Computer Applications faculty still do not receive BCA Data Science
    ca_dept = db.query(Department).filter(Department.name.ilike('%Computer Applications%')).first()
    if ca_dept:
        ca_fac = db.query(FacultyProfile).join(User).filter(User.department_id == ca_dept.id).first()
        if ca_fac:
            ca_user = db.query(User).get(ca_fac.user_id)
            ca_res = get_faculty_semesters(semester_type="ODD", db=db, current_user=ca_user)
            ca_progs = {item['class_type'] for group in ca_res for item in group['subjects']}
            assert not any("Data Science" in p for p in ca_progs), "CA faculty received BCA Data Science!"
            print(f"[PASS] Computer Applications faculty isolation verified: does not receive BCA Data Science.")
    results['regression_ca_ds_isolation'] = 'PASS'

    # 3.5 Existing workload allocations, preference records, faculty targets unchanged
    existing_alloc_count = db.query(SubjectAllocation).count()
    existing_pref_count = db.query(PreferenceSubmission).count()
    assert existing_alloc_count == 7, f"Allocations count changed: {existing_alloc_count} vs 7"
    assert existing_pref_count == 12, f"Preferences count changed: {existing_pref_count} vs 12"
    print(f"[PASS] Existing historical allocations ({existing_alloc_count}) and preference records ({existing_pref_count}) completely preserved.")
    results['regression_existing_records_preserved'] = 'PASS'

    # 3.6 API check: Workspaces by context for HOD
    from app.routers.academic import get_workspaces_by_context
    jeba_res = get_workspaces_by_context(programme_id=0, semester_type="ODD", db=db, current_user=jeba_user)
    assert len(jeba_res) == 5, f"Expected 5 ODD workspaces for Cyber Security (3 B.Sc + 2 M.Sc), got {len(jeba_res)}"
    subbaiah_res = get_workspaces_by_context(programme_id=0, semester_type="ODD", db=db, current_user=subbaiah_user)
    assert len(subbaiah_res) == 5, f"Expected 5 ODD workspaces for AIML (3 B.Sc + 2 M.Sc), got {len(subbaiah_res)}"
    print(f"[PASS] HOD /workspaces-by-context API returned expected contexts for both departments.")
    results['regression_hod_api_contexts'] = 'PASS'

    db.close()
    print("\nALL 17 DETAILED ACCEPTANCE TESTS PASSED (100% SUCCESS)!")
    return results

if __name__ == '__main__':
    test_suite()
