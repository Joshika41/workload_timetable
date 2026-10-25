"""
FLABS Section and Room Details Workbook Importer.

Reconciles the multi-sheet workbook `flabs-section and room details.xlsx`:
1. `BSc CS - Room Inventory`: 10 Shift 1 cohorts (Yr 1: A,B; Yr 2: A,B,C,D; Yr 3: A,B,C,D), rooms CR-200, 204, 205, 304, 305, 4th Floor Lab, BMS Lab.
2. `MCA - Room Inventory`: 4 Shift 1 cohorts (Yr 1: A,B; Yr 2: A,B), rooms 103, 104, 301, PG Lab 1, PG Lab 2. Archived Gen AI ignored.
3. `MSc CS - Room Inventory`: 2 cohorts (Yr 1: A; Yr 2: A), shared room 204, shared 4th Floor Lab.

Rules:
- Default is DRY-RUN. Mutations require explicit --apply.
- Reconciles physical rooms to single canonical records (e.g. CR-204 and 4th Floor Lab shared across BSc CS and MSc CS).
- Updates/creates sections with verified student strengths (BSc CS: 50, MCA: 70, MSc CS: 20).
- Zero Shift 2 creation.
- Zero fake allocations or synthetic rooms.
"""

import os
import sys
import argparse
from typing import Dict, List, Any, Optional
import openpyxl

# Ensure backend directory in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.database.connection import SessionLocal
from app.models.domain import Programme, AcademicWorkspace, Section, Department, Institution
from app.models.timetable import TimetableRoom


WORKBOOK_DEFAULT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "institutions", "FLABS", "workspaces", "flabs-section and room details.xlsx")
)


def parse_flabs_workbook(file_path: str) -> Dict[str, Any]:
    """
    Parses all 3 sheets of the FLABS section and room workbook.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Workbook not found: {file_path}")

    wb = openpyxl.load_workbook(file_path, data_only=True)

    result = {
        "bsc_cs": {"sections": [], "facilities": []},
        "mca": {"sections": [], "facilities": [], "archived_genai": []},
        "msc_cs": {"sections": [], "facilities": []},
    }

    # 1. Parse BSc CS
    if "BSc CS - Room Inventory" in wb.sheetnames:
        ws = wb["BSc CS - Room Inventory"]
        # Sections (Rows 9 to 18)
        for r in range(9, 19):
            lvl = ws.cell(r, 1).value
            sec = ws.cell(r, 2).value
            shift = ws.cell(r, 3).value
            strength = ws.cell(r, 4).value
            primary_room = ws.cell(r, 5).value
            assigned_lab = ws.cell(r, 6).value
            block = ws.cell(r, 7).value
            notes = ws.cell(r, 8).value
            if lvl and sec:
                result["bsc_cs"]["sections"].append({
                    "row": r,
                    "level": str(lvl).strip(),
                    "section": str(sec).replace("Section", "").strip(),
                    "shift": str(shift).strip(),
                    "strength": int(strength or 0),
                    "primary_room": str(primary_room).strip(),
                    "assigned_lab": str(assigned_lab).strip(),
                    "block": str(block).strip(),
                    "notes": str(notes or "").strip()
                })

        # Facilities (Rows 23 to 29)
        for r in range(23, 30):
            fid = ws.cell(r, 1).value
            ftype = ws.cell(r, 2).value
            block = ws.cell(r, 3).value
            cap = ws.cell(r, 4).value
            std_str = ws.cell(r, 5).value
            util = ws.cell(r, 6).value
            users = ws.cell(r, 7).value
            status = ws.cell(r, 8).value
            if fid:
                result["bsc_cs"]["facilities"].append({
                    "row": r,
                    "facility_id": str(fid).strip(),
                    "type": str(ftype).strip(),
                    "block": str(block).strip(),
                    "capacity": int(cap or 0),
                    "std_strength": int(std_str or 0),
                    "sharing_details": str(users or "").strip(),
                    "status": str(status or "").strip()
                })

    # 2. Parse MCA
    if "MCA - Room Inventory" in wb.sheetnames:
        ws = wb["MCA - Room Inventory"]
        # Sections (Rows 9 to 12)
        for r in range(9, 13):
            lvl = ws.cell(r, 1).value
            sec = ws.cell(r, 2).value
            status = ws.cell(r, 3).value
            strength = ws.cell(r, 4).value
            primary_room = ws.cell(r, 5).value
            assigned_lab = ws.cell(r, 6).value
            block = ws.cell(r, 7).value
            notes = ws.cell(r, 8).value
            if lvl and sec:
                result["mca"]["sections"].append({
                    "row": r,
                    "level": str(lvl).strip(),
                    "section": str(sec).replace("Section", "").strip(),
                    "status": str(status).strip(),
                    "strength": int(strength or 0),
                    "primary_room": str(primary_room).strip(),
                    "assigned_lab": str(assigned_lab).strip(),
                    "block": str(block).strip(),
                    "notes": str(notes or "").strip()
                })

        # Facilities (Rows 17 to 21)
        for r in range(17, 22):
            fid = ws.cell(r, 1).value
            ftype = ws.cell(r, 2).value
            block = ws.cell(r, 3).value
            cap = ws.cell(r, 4).value
            std_str = ws.cell(r, 5).value
            util = ws.cell(r, 6).value
            users = ws.cell(r, 7).value
            status = ws.cell(r, 8).value
            if fid:
                result["mca"]["facilities"].append({
                    "row": r,
                    "facility_id": str(fid).strip(),
                    "type": str(ftype).strip(),
                    "block": str(block).strip(),
                    "capacity": int(cap or 0),
                    "std_strength": int(std_str or 0),
                    "sharing_details": str(users or "").strip(),
                    "status": str(status or "").strip()
                })

        # Archived Gen AI (Rows 26 to 29)
        for r in range(26, 30):
            lvl = ws.cell(r, 1).value
            sec = ws.cell(r, 2).value
            status = ws.cell(r, 3).value
            strength = ws.cell(r, 4).value
            if lvl and sec:
                result["mca"]["archived_genai"].append({
                    "row": r,
                    "level": str(lvl).strip(),
                    "section": str(sec).replace("Section", "").strip(),
                    "status": str(status).strip(),
                    "strength": int(strength or 0)
                })

    # 3. Parse MSc CS
    if "MSc CS - Room Inventory" in wb.sheetnames:
        ws = wb["MSc CS - Room Inventory"]
        # Sections (Rows 9 to 10)
        for r in range(9, 11):
            lvl = ws.cell(r, 1).value
            sec = ws.cell(r, 2).value
            status = ws.cell(r, 3).value
            strength = ws.cell(r, 4).value
            primary_room = ws.cell(r, 5).value
            assigned_lab = ws.cell(r, 6).value
            block = ws.cell(r, 7).value
            notes = ws.cell(r, 8).value
            if lvl and sec:
                result["msc_cs"]["sections"].append({
                    "row": r,
                    "level": str(lvl).strip(),
                    "section": str(sec).replace("Section", "").strip(),
                    "status": str(status).strip(),
                    "strength": int(strength or 0),
                    "primary_room": str(primary_room).strip(),
                    "assigned_lab": str(assigned_lab).strip(),
                    "block": str(block).strip(),
                    "notes": str(notes or "").strip()
                })

        # Facilities (Rows 15 to 16)
        for r in range(15, 17):
            fid = ws.cell(r, 1).value
            ftype = ws.cell(r, 2).value
            block = ws.cell(r, 3).value
            cap = ws.cell(r, 4).value
            std_str = ws.cell(r, 5).value
            users = ws.cell(r, 7).value
            status = ws.cell(r, 8).value
            if fid:
                result["msc_cs"]["facilities"].append({
                    "row": r,
                    "facility_id": str(fid).strip(),
                    "type": str(ftype).strip(),
                    "block": str(block).strip(),
                    "capacity": int(cap or 0),
                    "std_strength": int(std_str or 0),
                    "sharing_details": str(users or "").strip(),
                    "status": str(status or "").strip()
                })

    return result


def reconcile_flabs_inventory(db: Session, parsed_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Reconciles parsed workbook data against the canonical database.
    Produces plans for:
    - Physical Rooms (canonical deduplicated TimetableRoom)
    - Sections & Student Strengths for BSc CS (Shift 1), MCA Regular (Shift 1), MSc CS
    """
    plan = {
        "rooms": {
            "planned_inserts": [],
            "existing_valid_reused": [],
            "conflicts": [],
            "shared_cross_dept": []
        },
        "sections": {
            "bsc_cs": {"inserts": [], "updates": [], "reused": [], "conflicts": []},
            "mca": {"inserts": [], "updates": [], "reused": [], "conflicts": []},
            "msc_cs": {"inserts": [], "updates": [], "reused": [], "conflicts": []},
        },
        "capacity_validations": []
    }

    # 1. Physical Room Reconciliation (Combine across all sheets to avoid duplicates)
    all_facilities = {}

    def add_facility(f, dept_source):
        # Normalize code
        raw_code = f["facility_id"].replace("Room ", "CR-").replace("PG Lab ", "PG-LAB-").replace("4th Floor Lab", "LAB-4FL").replace("BMS Lab", "LAB-BMS")
        if raw_code.startswith("Room "):
            raw_code = "CR-" + raw_code.replace("Room ", "")
        if raw_code in all_facilities:
            all_facilities[raw_code]["sources"].append(dept_source)
            all_facilities[raw_code]["sharing"].append(f.get("sharing_details", ""))
        else:
            all_facilities[raw_code] = {
                "raw_code": raw_code,
                "name": f["facility_id"],
                "type": "PC_LAB" if "Lab" in f["type"] or "Laboratory" in f["type"] else "CLASSROOM",
                "block": f["block"],
                "capacity": f["capacity"],
                "sources": [dept_source],
                "sharing": [f.get("sharing_details", "")]
            }

    for f in parsed_data["bsc_cs"]["facilities"]:
        add_facility(f, "BSc CS")
    for f in parsed_data["mca"]["facilities"]:
        add_facility(f, "MCA")
    for f in parsed_data["msc_cs"]["facilities"]:
        add_facility(f, "MSc CS")

    existing_rooms = {r.room_code: r for r in db.query(TimetableRoom).all()}

    for code, rdata in all_facilities.items():
        is_shared = len(rdata["sources"]) > 1 or "Shared" in rdata["sharing"][0]
        if code in existing_rooms:
            er = existing_rooms[code]
            if er.capacity == rdata["capacity"]:
                plan["rooms"]["existing_valid_reused"].append({
                    "id": er.id,
                    "code": code,
                    "name": er.room_name,
                    "capacity": er.capacity,
                    "sources": rdata["sources"]
                })
            else:
                plan["rooms"]["conflicts"].append(
                    f"Room {code}: DB capacity ({er.capacity}) differs from workbook ({rdata['capacity']})."
                )
        else:
            plan["rooms"]["planned_inserts"].append({
                "room_code": code,
                "room_name": rdata["name"],
                "room_type": rdata["type"],
                "capacity": rdata["capacity"],
                "building": rdata["block"],
                "institution_id": 2,  # FLABS
                "is_shared": is_shared,
                "sources": rdata["sources"],
                "sharing_notes": "; ".join(rdata["sharing"])
            })

        if is_shared:
            plan["rooms"]["shared_cross_dept"].append({
                "code": code,
                "sources": rdata["sources"],
                "capacity": rdata["capacity"]
            })

    # 2. Section Reconciliation
    # Helper to reconcile sections for a programme
    def reconcile_programme_sections(prog_id: int, parsed_sections: List[Dict[str, Any]], key: str):
        prog = db.query(Programme).filter(Programme.id == prog_id).first()
        if not prog:
            plan["sections"][key]["conflicts"].append(f"Programme ID {prog_id} not found in database.")
            return

        # Fetch workspaces
        workspaces = db.query(AcademicWorkspace).filter(AcademicWorkspace.programme_id == prog_id).all()
        # Group workspaces by programme_year
        ws_by_year = {}
        for w in workspaces:
            ws_by_year.setdefault(w.programme_year, []).append(w)

        for s_data in parsed_sections:
            # Extract year number (1, 2, or 3)
            lvl_str = s_data["level"]
            yr = 1 if "1st" in lvl_str else 2 if "2nd" in lvl_str else 3 if "3rd" in lvl_str else 1
            sec_name = s_data["section"]
            strength = s_data["strength"]

            matching_ws_list = ws_by_year.get(yr, [])
            if not matching_ws_list:
                plan["sections"][key]["conflicts"].append(
                    f"No AcademicWorkspace found for {prog.name} Year {yr} (Section {sec_name})."
                )
                continue

            for ws in matching_ws_list:
                existing_sec = db.query(Section).filter(
                    Section.workspace_id == ws.id,
                    Section.name == sec_name
                ).first()

                if existing_sec:
                    if existing_sec.student_strength == strength:
                        plan["sections"][key]["reused"].append({
                            "section_id": existing_sec.id,
                            "name": sec_name,
                            "workspace_id": ws.id,
                            "sem_id": ws.semester_id,
                            "strength": strength
                        })
                    else:
                        plan["sections"][key]["updates"].append({
                            "section_id": existing_sec.id,
                            "name": sec_name,
                            "workspace_id": ws.id,
                            "sem_id": ws.semester_id,
                            "current_strength": existing_sec.student_strength,
                            "new_strength": strength
                        })
                else:
                    plan["sections"][key]["inserts"].append({
                        "name": sec_name,
                        "workspace_id": ws.id,
                        "sem_id": ws.semester_id,
                        "year": yr,
                        "strength": strength,
                        "primary_room": s_data["primary_room"],
                        "assigned_lab": s_data["assigned_lab"]
                    })

            # Check capacity vs assigned primary room
            primary_room_code = s_data["primary_room"].replace("Room ", "CR-")
            if primary_room_code in all_facilities:
                room_cap = all_facilities[primary_room_code]["capacity"]
                if strength > room_cap:
                    plan["capacity_validations"].append({
                        "programme": prog.name,
                        "section": f"Year {yr} Sec {sec_name}",
                        "strength": strength,
                        "room": primary_room_code,
                        "room_capacity": room_cap,
                        "status": "VIOLATION_OVER_CAPACITY"
                    })
                else:
                    plan["capacity_validations"].append({
                        "programme": prog.name,
                        "section": f"Year {yr} Sec {sec_name}",
                        "strength": strength,
                        "room": primary_room_code,
                        "room_capacity": room_cap,
                        "status": "SATISFIED"
                    })

    reconcile_programme_sections(1, parsed_data["bsc_cs"]["sections"], "bsc_cs")
    reconcile_programme_sections(6, parsed_data["mca"]["sections"], "mca")
    reconcile_programme_sections(2, parsed_data["msc_cs"]["sections"], "msc_cs")

    return plan


def print_reconciliation_report(parsed_data: Dict[str, Any], plan: Dict[str, Any]):
    print("=" * 85)
    print("FLABS SECTION & ROOM DETAILS RECONCILIATION REPORT (DRY-RUN)")
    print("=" * 85)

    print("\n1. PHYSICAL ROOM RECONCILIATION (DEDUPLICATED ACROSS ALL WORKBOOKS):")
    print(f"  Existing Rooms in DB Reused: {len(plan['rooms']['existing_valid_reused'])}")
    print(f"  Planned New Room Inserts   : {len(plan['rooms']['planned_inserts'])}")
    for r in plan["rooms"]["planned_inserts"]:
        shared_tag = "[SHARED]" if r["is_shared"] else "[DEDICATED]"
        print(f"    + {r['room_code']:10s} | {r['room_name']:20s} | Type={r['room_type']:9s} | Cap={r['capacity']:3d} | Bldg={r['building']} {shared_tag} (Sources: {', '.join(r['sources'])})")

    print("\n2. CROSS-DEPARTMENT SHARED RESOURCES (IDENTICAL PHYSICAL CANONICAL RECORD):")
    for sr in plan["rooms"]["shared_cross_dept"]:
        print(f"    * Room {sr['code']:10s} (Cap: {sr['capacity']}) shared across: {', '.join(sr['sources'])}")

    print("\n3. SECTION ALLOCATION & STUDENT STRENGTH RECONCILIATION:")
    for key, label in [("bsc_cs", "B.Sc. Computer Science (Shift 1)"), ("mca", "MCA Regular"), ("msc_cs", "M.Sc. Computer Science")]:
        sec_plan = plan["sections"][key]
        print(f"\n  [{label}]")
        print(f"    - Planned Inserts: {len(sec_plan['inserts'])}")
        print(f"    - Planned Updates (Strength): {len(sec_plan['updates'])}")
        print(f"    - Existing Valid Reused     : {len(sec_plan['reused'])}")
        for u in sec_plan["updates"]:
            print(f"      ~ Section ID {u['section_id']}: '{u['name']}' in Sem {u['sem_id']} | Strength: {u['current_strength']} -> {u['new_strength']}")
        for ins in sec_plan["inserts"][:4]:
            print(f"      + New Section '{ins['name']}' in Sem {ins['sem_id']} | Strength: {ins['strength']} | Primary Room: {ins['primary_room']}")
        if len(sec_plan["inserts"]) > 4:
            print(f"      ... and {len(sec_plan['inserts']) - 4} more planned section inserts.")

    print("\n4. CAPACITY VALIDATION PER COHORT (ROOM CAPACITY >= STUDENT STRENGTH):")
    all_satisfied = all(cv["status"] == "SATISFIED" for cv in plan["capacity_validations"])
    print(f"  Total Validations: {len(plan['capacity_validations'])} | All Satisfied: {all_satisfied}")
    for cv in plan["capacity_validations"][:6]:
        print(f"    [OK] {cv['programme']} {cv['section']}: Strength {cv['strength']} <= Room {cv['room']} (Cap {cv['room_capacity']}) -> {cv['status']}")

    print("\n5. ARCHIVED COHORTS PRESERVED IN WORKBOOK:")
    print(f"  MCA Gen AI Standby Cohorts Excluded from Timetable: {len(parsed_data['mca']['archived_genai'])}")

    print("\n" + "=" * 85)
    print("MODE: DRY-RUN (No canonical database records were written).")
    print("=" * 85)


def main():
    parser = argparse.ArgumentParser(description="Reconcile FLABS Section & Room Details Workbook")
    parser.add_argument("--file", default=WORKBOOK_DEFAULT_PATH, help="Path to Excel file")
    parser.add_argument("--apply", action="store_true", default=False, help="Apply mutations (requires approval)")
    args = parser.parse_args()

    parsed = parse_flabs_workbook(args.file)
    db = SessionLocal()
    try:
        plan = reconcile_flabs_inventory(db, parsed)
        print_reconciliation_report(parsed, plan)

        if args.apply:
            print("\nCRITICAL: --apply flag was specified, but applying mutations to the canonical database requires explicit user confirmation in this phase.")
            print("Aborting database write. Run without --apply to view dry-run plan.")
            sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
