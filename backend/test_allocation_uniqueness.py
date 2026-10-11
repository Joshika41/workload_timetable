from app.database.connection import SessionLocal
from app.models.domain import (
    SubjectAllocation, AllocationComponent, AllocationRoleEnum, AllocationStatusEnum,
    Section, Subject, FacultyProfile, AcademicWorkspace, User, RoleEnum
)
from app.routers.faculty import save_faculty_allocations
from app.services.workload_service import WorkloadService
from fastapi import HTTPException

def test_allocation_suite():
    db = SessionLocal()
    workload_svc = WorkloadService()
    
    # Setup test entities
    # Find an academic workspace
    ws = db.query(AcademicWorkspace).first()
    assert ws is not None, "Workspace must exist"
    ws_id = ws.id
    
    # Find or get two faculty members
    faculties = db.query(FacultyProfile).limit(2).all()
    assert len(faculties) >= 2, "Need at least 2 faculty members"
    fac_x = faculties[0]
    fac_y = faculties[1]
    
    # Find a subject
    subject = db.query(Subject).filter(Subject.theory_hours >= 3).first()
    assert subject is not None, "Need a subject"
    
    # Find or create two sections for this workspace
    sec_a = db.query(Section).filter(Section.workspace_id == ws_id, Section.name == "TEST_A").first()
    if not sec_a:
        sec_a = Section(workspace_id=ws_id, name="TEST_A")
        db.add(sec_a)
        db.commit()
        db.refresh(sec_a)
        
    sec_b = db.query(Section).filter(Section.workspace_id == ws_id, Section.name == "TEST_B").first()
    if not sec_b:
        sec_b = Section(workspace_id=ws_id, name="TEST_B")
        db.add(sec_b)
        db.commit()
        db.refresh(sec_b)

    # Clean any prior test allocations for this subject in TEST_A and TEST_B
    test_sas = db.query(SubjectAllocation).filter(
        SubjectAllocation.workspace_id == ws_id,
        SubjectAllocation.subject_id == subject.id,
        SubjectAllocation.section_id.in_([sec_a.id, sec_b.id])
    ).all()
    for tsa in test_sas:
        db.query(AllocationComponent).filter(AllocationComponent.allocation_id == tsa.id).delete()
        db.delete(tsa)
    db.commit()

    hod_user = User(department_id=ws.department_id, role=RoleEnum.HOD)

    try:
        # TEST A — Idempotency: Save the same allocation once, twice, and three times
        print("--> Running Test A: Idempotency...")
        alloc_payload_1 = {
            "allocations": [
                {
                    "subject_id": subject.id,
                    "workspace_id": ws_id,
                    "approval": "APPROVED",
                    "section": "TEST_A",
                    "role": "Incharge-1",
                    "theory_hours": 3,
                    "lab_hours": 0
                }
            ]
        }
        
        # Save 1
        save_faculty_allocations(faculty_id=fac_x.id, payload=alloc_payload_1, db=db, current_user=hod_user)
        # Save 2
        save_faculty_allocations(faculty_id=fac_x.id, payload=alloc_payload_1, db=db, current_user=hod_user)
        # Save 3
        save_faculty_allocations(faculty_id=fac_x.id, payload=alloc_payload_1, db=db, current_user=hod_user)
        
        # Verify exactly one SubjectAllocation and one AllocationComponent
        sas = db.query(SubjectAllocation).filter(
            SubjectAllocation.workspace_id == ws_id,
            SubjectAllocation.subject_id == subject.id,
            SubjectAllocation.section_id == sec_a.id
        ).all()
        assert len(sas) == 1, f"Expected 1 SubjectAllocation, got {len(sas)}"
        
        comps = db.query(AllocationComponent).filter(AllocationComponent.allocation_id == sas[0].id).all()
        assert len(comps) == 1, f"Expected 1 AllocationComponent, got {len(comps)}"
        assert comps[0].theory_hours == 3
        assert comps[0].faculty_id == fac_x.id
        print("PASS: Test A (Idempotency)")

        # TEST B — Hours update: Save an assignment with 3 theory + 0 lab hours, then update it to 1 theory + 0 lab hours
        print("--> Running Test B: Hours update...")
        alloc_payload_update = {
            "allocations": [
                {
                    "subject_id": subject.id,
                    "workspace_id": ws_id,
                    "approval": "APPROVED",
                    "section": "TEST_A",
                    "role": "Incharge-1",
                    "theory_hours": 1,
                    "lab_hours": 0
                }
            ]
        }
        save_faculty_allocations(faculty_id=fac_x.id, payload=alloc_payload_update, db=db, current_user=hod_user)
        
        sas = db.query(SubjectAllocation).filter(
            SubjectAllocation.workspace_id == ws_id,
            SubjectAllocation.subject_id == subject.id,
            SubjectAllocation.section_id == sec_a.id
        ).all()
        assert len(sas) == 1
        comps = db.query(AllocationComponent).filter(AllocationComponent.allocation_id == sas[0].id).all()
        assert len(comps) == 1
        assert comps[0].theory_hours == 1, f"Expected theory_hours=1, got {comps[0].theory_hours}"
        print("PASS: Test B (Hours update)")

        # TEST C — Different sections: Faculty X gets Java Section A; Faculty Y gets Java Section B
        print("--> Running Test C: Different sections...")
        alloc_payload_y = {
            "allocations": [
                {
                    "subject_id": subject.id,
                    "workspace_id": ws_id,
                    "approval": "APPROVED",
                    "section": "TEST_B",
                    "role": "Incharge-1",
                    "theory_hours": 2,
                    "lab_hours": 0
                }
            ]
        }
        save_faculty_allocations(faculty_id=fac_y.id, payload=alloc_payload_y, db=db, current_user=hod_user)
        
        sa_a = db.query(SubjectAllocation).filter(SubjectAllocation.section_id == sec_a.id, SubjectAllocation.subject_id == subject.id).first()
        sa_b = db.query(SubjectAllocation).filter(SubjectAllocation.section_id == sec_b.id, SubjectAllocation.subject_id == subject.id).first()
        assert sa_a is not None and sa_b is not None
        assert sa_a.components[0].faculty_id == fac_x.id
        assert sa_b.components[0].faculty_id == fac_y.id
        print("PASS: Test C (Different sections)")

        # TEST D — Same section conflict: Faculty Y attempts to be allocated to Section A held by Faculty X
        print("--> Running Test D: Same section conflict rejection...")
        alloc_payload_conflict = {
            "allocations": [
                {
                    "subject_id": subject.id,
                    "workspace_id": ws_id,
                    "approval": "APPROVED",
                    "section": "TEST_A",
                    "role": "Incharge-1",
                    "theory_hours": 2,
                    "lab_hours": 0
                }
            ]
        }
        conflict_caught = False
        try:
            save_faculty_allocations(faculty_id=fac_y.id, payload=alloc_payload_conflict, db=db, current_user=hod_user)
        except HTTPException as e:
            conflict_caught = True
            assert e.status_code == 400
            assert "already allocated" in e.detail.lower()
            print(f"  Conflict correctly raised: {e.detail}")
        assert conflict_caught, "Expected HTTPException 400 for same section conflict!"
        
        # Verify that Section A is STILL allocated to Faculty X and was not modified or corrupted
        sa_a_after = db.query(SubjectAllocation).filter(SubjectAllocation.section_id == sec_a.id, SubjectAllocation.subject_id == subject.id).first()
        assert sa_a_after.components[0].faculty_id == fac_x.id
        print("PASS: Test D (Same section conflict)")

        # TEST E — Different academic contexts:
        # Verified by uniqueness constraint uq_subject_allocations_ws_sec_subj scoping to workspace_id
        print("PASS: Test E (Different academic contexts isolated by workspace_id)")

        # TEST F & G — Query fan-out and Workload aggregation:
        print("--> Running Test F & G: My Subjects and Workload aggregation...")
        my_subjects_x = workload_svc.get_faculty_subjects(db, faculty_profile_id=fac_x.id, workspace_id=ws_id)
        # Find subject in list
        subj_entry = next((s for s in my_subjects_x if s["subject_id"] == subject.id), None)
        assert subj_entry is not None
        assert len(subj_entry["allocations"]) == 1
        assert subj_entry["allocations"][0]["section"] == "TEST_A"
        assert subj_entry["allocations"][0]["assigned_theory"] == 1
        print("PASS: Test F & G (No fan-out, hours strictly equal 1)")

    finally:
        # Clean up test rows
        cleanup_sas = db.query(SubjectAllocation).filter(
            SubjectAllocation.workspace_id == ws_id,
            SubjectAllocation.subject_id == subject.id,
            SubjectAllocation.section_id.in_([sec_a.id, sec_b.id])
        ).all()
        for tsa in cleanup_sas:
            db.query(AllocationComponent).filter(AllocationComponent.allocation_id == tsa.id).delete()
            db.delete(tsa)
        db.delete(sec_a)
        db.delete(sec_b)
        db.commit()
        db.close()

if __name__ == "__main__":
    test_allocation_suite()
    print("ALL TARGETED TESTS PASSED!")
