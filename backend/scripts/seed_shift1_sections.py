"""
Seed Shift 1 Sections Script (B.Sc. Computer Science & MCA Regular).

Strict rules:
- Defaults to DRY-RUN mode. Requires explicit --apply to commit mutations.
- Confirmed Shift 1 sections only:
  - B.Sc. CS (Prog ID 1, Dept ID 1, Flabs):
    - Year 1 (Sem 1 & 2): I A, I B (sections named "A", "B")
    - Year 2 (Sem 3 & 4): II A, II B, II C, II D (sections named "A", "B", "C", "D")
    - Year 3 (Sem 5 & 6): III A, III B, III C, III D (sections named "A", "B", "C", "D")
    - Excludes Shift 2 sections: I C, II E, III E, III F.
  - MCA Regular (Prog ID 6, Dept ID 5, Flabs):
    - Year 1 (Sem 1 & 2): MCA I A, MCA I B (sections named "A", "B")
    - Year 2 (Sem 3 & 4): MCA II A, MCA II B (sections named "A", "B")
    - Excludes MCA Gen AI (Prog ID 7).
- Preserves existing sections (reuses valid records, never duplicates).
- Does NOT invent or populate student strengths (retains 0 or existing).
- Does NOT create faculty allocations, workload versions, or timetable records.
- Does NOT create Shift 2 records or calendars.
"""

import sys
import os
import argparse
from typing import Dict, List, Any

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.domain import Institution, Department, Programme, Semester, AcademicWorkspace, Section


# Expected Shift 1 section names per year
BSC_CS_SHIFT1_SECTIONS = {
    1: ["A", "B"],            # Year 1 (I A, I B) - I C is Shift 2 (omitted)
    2: ["A", "B", "C", "D"],  # Year 2 (II A - II D) - II E is Shift 2 (omitted)
    3: ["A", "B", "C", "D"],  # Year 3 (III A - III D) - III E, III F are Shift 2 (omitted)
}

MCA_REGULAR_SHIFT1_SECTIONS = {
    1: ["A", "B"],            # Year 1 (MCA I A, MCA I B)
    2: ["A", "B"],            # Year 2 (MCA II A, MCA II B)
}


def plan_section_seed(db: Session) -> Dict[str, Any]:
    """
    Evaluates current database state and produces a deterministic seed plan.
    Read-only audit of planned actions.
    """
    plan = {
        "bsc_cs": {
            "department": None,
            "programme": None,
            "workspaces_evaluated": [],
            "planned_inserts": [],
            "existing_valid_reused": [],
            "conflicts": [],
            "shift2_omitted": ["I C", "II E", "III E", "III F"]
        },
        "mca_regular": {
            "department": None,
            "programme": None,
            "workspaces_evaluated": [],
            "planned_inserts": [],
            "existing_valid_reused": [],
            "conflicts": [],
            "genai_excluded": "MCA GEN AI (Prog ID 7)"
        }
    }

    # 1. Resolve B.Sc Computer Science (Prog ID 1)
    prog_bsc = db.query(Programme).filter(Programme.id == 1).first()
    if not prog_bsc:
        plan["bsc_cs"]["conflicts"].append("Programme ID 1 (B.Sc Computer Science) not found in DB.")
    else:
        dept_bsc = prog_bsc.department
        plan["bsc_cs"]["department"] = f"{dept_bsc.name} (ID {dept_bsc.id})"
        plan["bsc_cs"]["programme"] = f"{prog_bsc.name} (ID {prog_bsc.id})"

        # Workspaces for Prog 1
        workspaces_bsc = (
            db.query(AcademicWorkspace)
            .filter(AcademicWorkspace.programme_id == 1)
            .order_by(AcademicWorkspace.programme_year.asc(), AcademicWorkspace.semester_id.asc())
            .all()
        )

        for ws in workspaces_bsc:
            yr = ws.programme_year
            sem_id = ws.semester_id
            plan["bsc_cs"]["workspaces_evaluated"].append({
                "workspace_id": ws.id,
                "year": yr,
                "semester_id": sem_id
            })

            expected_sections = BSC_CS_SHIFT1_SECTIONS.get(yr, [])
            existing_sections = db.query(Section).filter(Section.workspace_id == ws.id).all()
            existing_names = {s.name.strip(): s for s in existing_sections}

            for sec_name in expected_sections:
                if sec_name in existing_names:
                    s_obj = existing_names[sec_name]
                    plan["bsc_cs"]["existing_valid_reused"].append({
                        "section_id": s_obj.id,
                        "name": s_obj.name,
                        "workspace_id": ws.id,
                        "programme": prog_bsc.name,
                        "semester_id": sem_id,
                        "year": yr,
                        "shift": "Shift 1"
                    })
                else:
                    plan["bsc_cs"]["planned_inserts"].append({
                        "name": sec_name,
                        "workspace_id": ws.id,
                        "programme": prog_bsc.name,
                        "semester_id": sem_id,
                        "year": yr,
                        "shift": "Shift 1"
                    })

    # 2. Resolve MCA Regular (Prog ID 6, Dept ID 5)
    prog_mca = db.query(Programme).filter(Programme.id == 6).first()
    if not prog_mca:
        plan["mca_regular"]["conflicts"].append("Programme ID 6 (MCA) not found in DB.")
    else:
        dept_mca = prog_mca.department
        plan["mca_regular"]["department"] = f"{dept_mca.name} (ID {dept_mca.id})"
        plan["mca_regular"]["programme"] = f"{prog_mca.name} (ID {prog_mca.id})"

        workspaces_mca = (
            db.query(AcademicWorkspace)
            .filter(AcademicWorkspace.programme_id == 6)
            .order_by(AcademicWorkspace.programme_year.asc(), AcademicWorkspace.semester_id.asc())
            .all()
        )

        for ws in workspaces_mca:
            yr = ws.programme_year
            sem_id = ws.semester_id
            plan["mca_regular"]["workspaces_evaluated"].append({
                "workspace_id": ws.id,
                "year": yr,
                "semester_id": sem_id
            })

            expected_sections = MCA_REGULAR_SHIFT1_SECTIONS.get(yr, [])
            existing_sections = db.query(Section).filter(Section.workspace_id == ws.id).all()
            existing_names = {s.name.strip(): s for s in existing_sections}

            for sec_name in expected_sections:
                if sec_name in existing_names:
                    s_obj = existing_names[sec_name]
                    plan["mca_regular"]["existing_valid_reused"].append({
                        "section_id": s_obj.id,
                        "name": s_obj.name,
                        "workspace_id": ws.id,
                        "programme": prog_mca.name,
                        "semester_id": sem_id,
                        "year": yr,
                        "shift": "Shift 1"
                    })
                else:
                    plan["mca_regular"]["planned_inserts"].append({
                        "name": sec_name,
                        "workspace_id": ws.id,
                        "programme": prog_mca.name,
                        "semester_id": sem_id,
                        "year": yr,
                        "shift": "Shift 1"
                    })

    return plan


def print_plan_report(plan: Dict[str, Any]):
    print("=" * 80)
    print("SHIFT 1 SECTION SEED PLAN (DRY-RUN)")
    print("=" * 80)

    # B.Sc CS
    bsc = plan["bsc_cs"]
    print("\n[PROGRAMME 1] B.Sc. Computer Science (Hons)")
    print(f"  Department : {bsc['department']}")
    print(f"  Programme  : {bsc['programme']}")
    print(f"  Workspaces Evaluated: {len(bsc['workspaces_evaluated'])}")
    print(f"  Shift 2 Sections Omitted (Out of scope): {', '.join(bsc['shift2_omitted'])}")
    print(f"  Existing Valid Sections Reused: {len(bsc['existing_valid_reused'])}")
    for s in bsc["existing_valid_reused"]:
        print(f"    - Section ID {s['section_id']}: '{s['name']}' in Sem {s['semester_id']} (Yr {s['year']})")
    print(f"  Planned New Sections to Insert: {len(bsc['planned_inserts'])}")
    for s in bsc["planned_inserts"]:
        print(f"    + Planned Section: '{s['name']}' in Sem {s['semester_id']} (Yr {s['year']}) -> {s['shift']}")

    # MCA
    mca = plan["mca_regular"]
    print("\n[PROGRAMME 2] MCA (Master of Computer Applications - Regular)")
    print(f"  Department : {mca['department']}")
    print(f"  Programme  : {mca['programme']}")
    print(f"  Excluded   : {mca['genai_excluded']}")
    print(f"  Workspaces Evaluated: {len(mca['workspaces_evaluated'])}")
    print(f"  Existing Valid Sections Reused: {len(mca['existing_valid_reused'])}")
    for s in mca["existing_valid_reused"]:
        print(f"    - Section ID {s['section_id']}: '{s['name']}' in Sem {s['semester_id']} (Yr {s['year']})")
    print(f"  Planned New Sections to Insert: {len(mca['planned_inserts'])}")
    for s in mca["planned_inserts"]:
        print(f"    + Planned Section: '{s['name']}' in Sem {s['semester_id']} (Yr {s['year']}) -> {s['shift']}")

    print("\n" + "=" * 80)
    total_planned = len(bsc["planned_inserts"]) + len(mca["planned_inserts"])
    total_reused = len(bsc["existing_valid_reused"]) + len(mca["existing_valid_reused"])
    print(f"SUMMARY: {total_planned} planned inserts, {total_reused} existing valid reused.")
    print("MODE: DRY-RUN (No database writes performed).")
    print("=" * 80)


def execute_seed(db: Session, plan: Dict[str, Any]):
    """
    Executes section insertion only when explicitly approved via --apply.
    Rolls back transaction on any integrity error.
    """
    total_inserted = 0
    try:
        # B.Sc CS inserts
        for item in plan["bsc_cs"]["planned_inserts"]:
            new_sec = Section(
                workspace_id=item["workspace_id"],
                name=item["name"],
                student_strength=0,
                is_active=True
            )
            db.add(new_sec)
            total_inserted += 1

        # MCA inserts
        for item in plan["mca_regular"]["planned_inserts"]:
            new_sec = Section(
                workspace_id=item["workspace_id"],
                name=item["name"],
                student_strength=0,
                is_active=True
            )
            db.add(new_sec)
            total_inserted += 1

        db.commit()
        print(f"SUCCESS: Successfully inserted {total_inserted} Shift 1 sections into database.")
    except Exception as e:
        db.rollback()
        print(f"ERROR: Integrity error during section insertion. Transaction rolled back. Details: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Seed Shift 1 Sections for B.Sc CS and MCA Regular")
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Execute database writes. Defaults to False (dry-run mode)."
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        plan = plan_section_seed(db)
        print_plan_report(plan)

        if args.apply:
            print("\nWARNING: --apply specified. Executing database insertion...")
            execute_seed(db, plan)
        else:
            print("\nDRY-RUN COMPLETE. To apply changes after review, run with --apply.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
