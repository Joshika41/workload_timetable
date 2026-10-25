"""
Tests for Semester Eligibility Service and Shift 1 Section Seed Script (Phase 8).
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.domain import (
    Base,
    Institution,
    Department,
    Programme,
    AcademicYear,
    Semester,
    AcademicWorkspace,
    Section,
    Subject,
    CurriculumOffering,
    WorkspaceWorkflowStateEnum
)
from app.services.semester_eligibility_service import (
    evaluate_semester_eligibility,
    get_programme_semester_count
)
from scripts.seed_shift1_sections import plan_section_seed, execute_seed


@pytest.fixture
def memory_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed core test setup
    inst = Institution(id=2, code="FLABS", name="Flabs")
    db.add(inst)
    
    dept_cs = Department(id=1, institution_id=2, name="Computer Science")
    dept_ca = Department(id=5, institution_id=2, name="Postgraduate Department of Computer Applications")
    db.add_all([dept_cs, dept_ca])

    # Programmes: 6-sem UG (B.Sc CS) and 4-sem PG (MCA Regular) and 4-sem PG (M.Sc CS)
    p_bsc = Programme(id=1, department_id=1, name="B.Sc Computer Science (Hons)", programme_type="Undergraduate")
    p_mca = Programme(id=6, department_id=5, name="MCA", programme_type="Postgraduate")
    p_msc = Programme(id=2, department_id=1, name="M.Sc Computer Science", programme_type="Postgraduate")
    db.add_all([p_bsc, p_mca, p_msc])

    # Subjects for MCA Semesters
    s1 = Subject(id=101, course_code="PCA25C01J", course_name="Java Programming", theory_hours=3, practical_hours=2, category="CORE")
    s2 = Subject(id=102, course_code="PCA25C02T", course_name="Data Structures", theory_hours=4, practical_hours=0, category="CORE")
    # Project-only subject for MCA Sem 4
    s_proj = Subject(id=104, course_code="PCA25P02L", course_name="Project Work", theory_hours=0, practical_hours=20, category="OTHER")
    # Mixed subject for 6-sem UG Sem 6
    s_ug_proj = Subject(id=206, course_code="UCS24P61L", course_name="Final Year Project", theory_hours=0, practical_hours=12, category="CORE")
    s_ug_theory = Subject(id=207, course_code="UCS24601T", course_name="Cloud Computing", theory_hours=4, practical_hours=0, category="CORE")
    db.add_all([s1, s2, s_proj, s_ug_proj, s_ug_theory])

    # Academic Year
    ay = AcademicYear(id=1, name="2026-2027")
    db.add(ay)

    # Offerings for MCA
    o1 = CurriculumOffering(id=1, programme_id=6, academic_year_id=1, subject_id=101, programme_year=1, semester=1, semester_type="ODD")
    o2 = CurriculumOffering(id=2, programme_id=6, academic_year_id=1, subject_id=102, programme_year=1, semester=2, semester_type="EVEN")
    o3 = CurriculumOffering(id=3, programme_id=6, academic_year_id=1, subject_id=101, programme_year=2, semester=3, semester_type="ODD")
    o4 = CurriculumOffering(id=4, programme_id=6, academic_year_id=1, subject_id=104, programme_year=2, semester=4, semester_type="EVEN")  # Project only
    db.add_all([o1, o2, o3, o4])

    # Offerings for B.Sc CS (6 semesters)
    for sem in range(1, 6):
        yr = (sem + 1) // 2
        st = "ODD" if sem % 2 != 0 else "EVEN"
        db.add(CurriculumOffering(id=10 + sem, programme_id=1, academic_year_id=1, subject_id=102, programme_year=yr, semester=sem, semester_type=st))
    db.add(CurriculumOffering(id=16, programme_id=1, academic_year_id=1, subject_id=206, programme_year=3, semester=6, semester_type="EVEN"))
    db.add(CurriculumOffering(id=17, programme_id=1, academic_year_id=1, subject_id=207, programme_year=3, semester=6, semester_type="EVEN"))

    # Academic Workspaces for B.Sc CS (6 workspaces)
    for sem in range(1, 7):
        yr = (sem + 1) // 2
        db.add(AcademicWorkspace(
            id=f"ws_bsc_sem{sem}",
            department_id=1,
            programme_id=1,
            academic_year_id=1,
            semester_id=sem,
            programme_year=yr,
            workflow_state=WorkspaceWorkflowStateEnum.PREFERENCES
        ))

    # Academic Workspaces for MCA (4 workspaces)
    for sem in range(1, 5):
        yr = (sem + 1) // 2
        db.add(AcademicWorkspace(
            id=f"ws_mca_sem{sem}",
            department_id=5,
            programme_id=6,
            academic_year_id=1,
            semester_id=sem,
            programme_year=yr,
            workflow_state=WorkspaceWorkflowStateEnum.PREFERENCES
        ))

    db.commit()
    yield db
    db.close()


class TestSemesterEligibility:
    def test_six_semester_odd_even_cycle(self, memory_db):
        """B.Sc CS (6-sem) odd cycle admits Sem 1, 3, 5; rejects 2, 4, 6."""
        res_sem1 = evaluate_semester_eligibility(1, 1, "ODD", memory_db)
        assert res_sem1["eligible"] is True
        assert res_sem1["status"] == "ELIGIBLE"

        res_sem2 = evaluate_semester_eligibility(1, 2, "ODD", memory_db)
        assert res_sem2["eligible"] is False
        assert res_sem2["status"] == "CYCLE_MISMATCH"

        res_sem3 = evaluate_semester_eligibility(1, 3, "ODD", memory_db)
        assert res_sem3["eligible"] is True

        res_sem5 = evaluate_semester_eligibility(1, 5, "ODD", memory_db)
        assert res_sem5["eligible"] is True

        res_sem6 = evaluate_semester_eligibility(1, 6, "EVEN", memory_db)
        assert res_sem6["eligible"] is True

    def test_six_semester_never_excluded_by_project_rule(self, memory_db):
        """6-semester programmes must NEVER be excluded by the 4-semester project-only rule."""
        res_sem6 = evaluate_semester_eligibility(1, 6, "EVEN", memory_db)
        assert res_sem6["eligible"] is True
        assert res_sem6["is_project_only"] is False

    def test_four_semester_general_project_only_exclusion(self, memory_db):
        """4-semester programmes (MCA Sem 4) with project work are excluded from timetable generation."""
        res_sem4 = evaluate_semester_eligibility(6, 4, "EVEN", memory_db)
        assert res_sem4["eligible"] is False
        assert res_sem4["is_project_only"] is True
        assert res_sem4["status"] == "EXCLUDED_PROJECT_ONLY"

    def test_four_semester_odd_cycle(self, memory_db):
        """MCA Sem 1 and Sem 3 are eligible in ODD cycle."""
        res_sem1 = evaluate_semester_eligibility(6, 1, "ODD", memory_db)
        assert res_sem1["eligible"] is True

        res_sem3 = evaluate_semester_eligibility(6, 3, "ODD", memory_db)
        assert res_sem3["eligible"] is True

    def test_ambiguous_data_flagged(self, memory_db):
        """Semester with no offerings is flagged without guessing."""
        res_unoffered = evaluate_semester_eligibility(2, 1, "ODD", memory_db)
        assert res_unoffered["eligible"] is False
        assert "AMBIGUOUS" in res_unoffered["status"] or "NO_OFFERINGS" in res_unoffered["status"]


class TestShift1SectionSeed:
    def test_section_seed_plan_dry_run_isolation(self, memory_db):
        """Tests that plan_section_seed identifies correct counts without writing to DB."""
        plan = plan_section_seed(memory_db)
        assert plan["bsc_cs"]["department"] == "Computer Science (ID 1)"
        assert plan["mca_regular"]["department"] == "Postgraduate Department of Computer Applications (ID 5)"

        # Check planned inserts
        assert len(plan["bsc_cs"]["planned_inserts"]) == 20  # 2 in Sem1, 2 in Sem2, 4 in Sem3, 4 in Sem4, 4 in Sem5, 4 in Sem6
        assert len(plan["mca_regular"]["planned_inserts"]) == 8  # 2 in Sem1, 2 in Sem2, 2 in Sem3, 2 in Sem4

        # Verify no rows written yet
        assert memory_db.query(Section).count() == 0

    def test_section_seed_idempotency_and_no_shift2(self, memory_db):
        """Executes seed once, then verifies running again plans 0 new inserts."""
        plan = plan_section_seed(memory_db)
        execute_seed(memory_db, plan)

        total_sections = memory_db.query(Section).count()
        assert total_sections == 28  # 20 BSC + 8 MCA

        # Verify all are Shift 1 section names (no I C, II E, III E, III F)
        sec_names = set(s.name for s in memory_db.query(Section).all())
        assert sec_names == {"A", "B", "C", "D"}

        # Running plan again should find 28 reused, 0 planned inserts
        plan2 = plan_section_seed(memory_db)
        assert len(plan2["bsc_cs"]["planned_inserts"]) == 0
        assert len(plan2["mca_regular"]["planned_inserts"]) == 0
        assert len(plan2["bsc_cs"]["existing_valid_reused"]) == 20
        assert len(plan2["mca_regular"]["existing_valid_reused"]) == 8
