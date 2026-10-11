import pytest
from sqlalchemy.orm import Session
from app.models.domain import (
    User, FacultyProfile, Section, Subject, CurriculumOffering,
    SubjectAllocation, AllocationComponent, AllocationRoleEnum,
    AllocationStatusEnum
)
from app.services.workload_service import WorkloadService
from app.database.connection import SessionLocal

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_mandatory_java_reconciliation(db_session: Session):
    """
    Mandatory Java Reconciliation Test:
    Required = 14 (7 per section for 2 sections)
    SECTION A:
      Incharge-1 (Divya): 3T + 2P = 5
      Incharge-2 (Chithra): 0T + 2P = 2
      Total = 7
    SECTION B:
      Incharge-1 (Meenakshi): 3T + 2P = 5
      Incharge-2 (Kanchana): 0T + 2P = 2
      Total = 7
    OVERALL: 14 allocated, 14 required, Difference = 0 -> RECONCILED
    """
    from app.models.domain import Department, Institution, User, RoleEnum
    import uuid
    
    unique_suffix = str(uuid.uuid4())[:8]
    inst = Institution(name=f"Test Inst {unique_suffix}", code=f"TI{unique_suffix}")
    db_session.add(inst)
    db_session.commit()
    
    dept = Department(name=f"Test Dept {unique_suffix}", institution_id=inst.id)
    db_session.add(dept)
    db_session.commit()
    
    users = []
    for i in range(1, 5):
        u = User(email=f"u{i}_{unique_suffix}@test.com", hashed_password="hash", role=RoleEnum.FACULTY, department_id=dept.id)
        db_session.add(u)
        users.append(u)
    db_session.commit()
    
    # 1. Setup mock data
    # Create faculty
    f_divya = FacultyProfile(user_id=users[0].id, name="Mrs M. Divya", designation="Assistant Professor", erp_id="1")
    f_chithra = FacultyProfile(user_id=users[1].id, name="Dr S. Chithra", designation="Assistant Professor", erp_id="2")
    f_meenakshi = FacultyProfile(user_id=users[2].id, name="Dr S. Meenakshi", designation="Assistant Professor", erp_id="3")
    f_kanchana = FacultyProfile(user_id=users[3].id, name="Dr D. Kanchana", designation="Assistant Professor", erp_id="4")
    db_session.add_all([f_divya, f_chithra, f_meenakshi, f_kanchana])
    
    # Create sections
    sec_a = Section(name="A", student_strength=60, is_active=True)
    sec_b = Section(name="B", student_strength=60, is_active=True)
    db_session.add_all([sec_a, sec_b])
    
    # Create Java Subject (3T + 4P? Wait, the required is 14 overall for 2 sections.
    # So required per section is 7. That means Java requires 3 Theory + 4 Practical per section?
    # No, wait. 3 Theory + 2 Practical = 5, 0 Theory + 2 Practical = 2. Total = 7.
    # Ah, the subject requires 3 Theory + 4 Practical = 7. Let's set it as 3 Theory, 4 Practical.
    java = Subject(
        course_code="JAVA101",
        course_name="Java Programming",
        category="CORE",
        theory_hours=3,
        practical_hours=4,
        credits=5
    )
    db_session.add(java)
    db_session.commit()
    
    # 2. Setup allocations
    workspace_id = "test_workspace_java"
    
    # Section A Allocation
    alloc_a = SubjectAllocation(
        workspace_id=workspace_id,
        section_id=sec_a.id,
        subject_id=java.id,
        status=AllocationStatusEnum.DRAFT
    )
    db_session.add(alloc_a)
    db_session.flush()
    
    comp_a1 = AllocationComponent(
        allocation_id=alloc_a.id,
        faculty_id=f_divya.id,
        role=AllocationRoleEnum.INCHARGE_1,
        theory_hours=3,
        practical_hours=2
    )
    comp_a2 = AllocationComponent(
        allocation_id=alloc_a.id,
        faculty_id=f_chithra.id,
        role=AllocationRoleEnum.INCHARGE_2,
        theory_hours=0,
        practical_hours=2
    )
    db_session.add_all([comp_a1, comp_a2])
    
    # Section B Allocation
    alloc_b = SubjectAllocation(
        workspace_id=workspace_id,
        section_id=sec_b.id,
        subject_id=java.id,
        status=AllocationStatusEnum.DRAFT
    )
    db_session.add(alloc_b)
    db_session.flush()
    
    comp_b1 = AllocationComponent(
        allocation_id=alloc_b.id,
        faculty_id=f_meenakshi.id,
        role=AllocationRoleEnum.INCHARGE_1,
        theory_hours=3,
        practical_hours=2
    )
    comp_b2 = AllocationComponent(
        allocation_id=alloc_b.id,
        faculty_id=f_kanchana.id,
        role=AllocationRoleEnum.INCHARGE_2,
        theory_hours=0,
        practical_hours=2
    )
    db_session.add_all([comp_b1, comp_b2])
    db_session.commit()
    
    # 3. Run reconciliation logic
    workload_service = WorkloadService()
    reconciliation = workload_service.calculate_subject_reconciliation(db_session, java.id, workspace_id)
    
    assert reconciliation["subject_id"] == java.id
    assert reconciliation["sections_count"] == 2
    assert reconciliation["required_theory"] == 6  # 3 * 2
    assert reconciliation["required_practical"] == 8  # 4 * 2
    assert reconciliation["required_total"] == 14
    
    assert reconciliation["allocated_theory"] == 6 # (3+0) + (3+0)
    assert reconciliation["allocated_practical"] == 8 # (2+2) + (2+2)
    assert reconciliation["allocated_total"] == 14
    
    assert reconciliation["difference"] == 0
    assert reconciliation["status"] == "RECONCILED"
    
    # Verify faculty workload credited
    faculty_workloads = workload_service.get_faculty_workload(db_session, department_id=None, workspace_id=workspace_id)
    
    def get_w(fid):
        return next((fw for fw in faculty_workloads if fw["faculty_id"] == fid), None)
        
    w_divya = get_w(f_divya.id)
    assert w_divya["teaching_workload"] == 5
    
    w_chithra = get_w(f_chithra.id)
    assert w_chithra["teaching_workload"] == 2
    
    w_meenakshi = get_w(f_meenakshi.id)
    assert w_meenakshi["teaching_workload"] == 5
    
    w_kanchana = get_w(f_kanchana.id)
    assert w_kanchana["teaching_workload"] == 2
    
    assert sum(fw["teaching_workload"] for fw in [w_divya, w_chithra, w_meenakshi, w_kanchana]) == 14
