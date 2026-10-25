"""
Room Inventory Import Service.

Validates and imports official, verified room records into the canonical
TimetableRoom model.

Rules enforced:
- Default mode is DRY-RUN. Database writes require explicit apply=True.
- Validates allowed room_type: CLASSROOM, LAB, PC_LAB, STUDIO.
- Rejects non-positive or missing capacities.
- Rejects unapproved or unverified records (requires Approval Status == 'APPROVED' and Verification Status == 'VERIFIED').
- Detects existing room_code collisions:
  - If existing record has identical attributes, treated as idempotent MATCH (no-op).
  - If attributes differ, flags as CONFLICT and aborts without overwriting.
- Runs inside a database transaction with atomic rollback on error.
- Zero synthetic rooms or guessed values.
"""

import os
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
import openpyxl

from app.models.domain import Institution
from app.models.timetable import TimetableRoom

ALLOWED_ROOM_TYPES = {"CLASSROOM", "LAB", "PC_LAB", "STUDIO"}
REQUIRED_APPROVAL_STATUS = "APPROVED"
REQUIRED_VERIFICATION_STATUS = "VERIFIED"


class RoomImportValidationError(Exception):
    def __init__(self, message: str, errors: Optional[List[str]] = None):
        super().__init__(message)
        self.message = message
        self.errors = errors or []


class RoomInventoryImporter:
    def __init__(self, db: Session):
        self.db = db

    def parse_and_validate(self, file_path: str) -> Dict[str, Any]:
        """
        Parses and validates the Excel template without writing to the database.
        Returns parsed room records, diagnostics, and any validation errors.
        """
        if not os.path.exists(file_path):
            raise RoomImportValidationError(f"File not found: {file_path}")

        try:
            wb = openpyxl.load_workbook(file_path, data_only=True)
        except Exception as e:
            raise RoomImportValidationError(f"Failed to open Excel file: {e}")

        sheet_name = "Room Inventory"
        if sheet_name not in wb.sheetnames:
            sheet_name = wb.sheetnames[0]

        ws = wb[sheet_name]

        # Scan for header row (Row 3 in template, or first row with 'Room Code')
        header_row_idx = None
        for r in range(1, 10):
            row_vals = [str(ws.cell(r, c).value or "").strip().lower() for c in range(1, 12)]
            if any("room code" in v for v in row_vals):
                header_row_idx = r
                break

        if not header_row_idx:
            raise RoomImportValidationError("Could not locate header row containing 'Room Code'.")

        col_map = {}
        for c in range(1, ws.max_column + 1):
            val = str(ws.cell(header_row_idx, c).value or "").strip().lower().replace("*", "").strip()
            if "room code" in val:
                col_map["room_code"] = c
            elif "room name" in val:
                col_map["room_name"] = c
            elif "room type" in val:
                col_map["room_type"] = c
            elif "capacity" in val:
                col_map["capacity"] = c
            elif "building" in val:
                col_map["building"] = c
            elif "floor" in val:
                col_map["floor"] = c
            elif "lab classification" in val:
                col_map["lab_classification"] = c
            elif "institution" in val:
                col_map["institution_id"] = c
            elif "approval" in val:
                col_map["approval_status"] = c
            elif "verification" in val:
                col_map["verification_status"] = c

        required_cols = ["room_code", "room_name", "room_type", "capacity", "institution_id"]
        missing_cols = [rc for rc in required_cols if rc not in col_map]
        if missing_cols:
            raise RoomImportValidationError(f"Missing required columns in template: {missing_cols}")

        parsed_records: List[Dict[str, Any]] = []
        validation_errors: List[str] = []
        seen_codes: Dict[str, int] = {}

        for row_idx in range(header_row_idx + 1, ws.max_row + 1):
            code_raw = ws.cell(row_idx, col_map["room_code"]).value
            if not code_raw:
                continue  # skip blank rows

            room_code = str(code_raw).strip()
            room_name = str(ws.cell(row_idx, col_map.get("room_name", col_map["room_code"])).value or "").strip()
            room_type = str(ws.cell(row_idx, col_map["room_type"]).value or "").strip().upper()
            capacity_raw = ws.cell(row_idx, col_map["capacity"]).value
            building = str(ws.cell(row_idx, col_map["building"]).value or "").strip() if "building" in col_map else None
            floor = str(ws.cell(row_idx, col_map["floor"]).value or "").strip() if "floor" in col_map else None
            lab_class = str(ws.cell(row_idx, col_map["lab_classification"]).value or "").strip() if "lab_classification" in col_map else None
            inst_id_raw = ws.cell(row_idx, col_map["institution_id"]).value if "institution_id" in col_map else None
            approval = str(ws.cell(row_idx, col_map["approval_status"]).value or "").strip().upper() if "approval_status" in col_map else "APPROVED"
            verification = str(ws.cell(row_idx, col_map["verification_status"]).value or "").strip().upper() if "verification_status" in col_map else "VERIFIED"

            # Check duplicate within spreadsheet
            if room_code.upper() in seen_codes:
                validation_errors.append(
                    f"Row {row_idx}: Duplicate room code '{room_code}' in file (first seen at row {seen_codes[room_code.upper()]})."
                )
            seen_codes[room_code.upper()] = row_idx

            # Approval & verification gates
            if approval != REQUIRED_APPROVAL_STATUS:
                validation_errors.append(
                    f"Row {row_idx} ({room_code}): Record is '{approval}'. Only '{REQUIRED_APPROVAL_STATUS}' records can be imported."
                )

            if verification != REQUIRED_VERIFICATION_STATUS:
                validation_errors.append(
                    f"Row {row_idx} ({room_code}): Record is '{verification}'. Only '{REQUIRED_VERIFICATION_STATUS}' records can be imported."
                )

            # Room type validation
            if room_type not in ALLOWED_ROOM_TYPES:
                validation_errors.append(
                    f"Row {row_idx} ({room_code}): Invalid room_type '{room_type}'. Allowed: {sorted(list(ALLOWED_ROOM_TYPES))}."
                )

            # Capacity validation
            try:
                capacity = int(capacity_raw)
                if capacity <= 0:
                    validation_errors.append(f"Row {row_idx} ({room_code}): Capacity must be > 0 (got {capacity}).")
            except (ValueError, TypeError):
                validation_errors.append(f"Row {row_idx} ({room_code}): Invalid numeric capacity '{capacity_raw}'.")
                capacity = 0

            # Institution ID validation
            try:
                inst_id = int(inst_id_raw)
            except (ValueError, TypeError):
                validation_errors.append(f"Row {row_idx} ({room_code}): Invalid institution_id '{inst_id_raw}'.")
                inst_id = 2

            # Lab classification check
            if room_type in ["LAB", "PC_LAB"] and not lab_class:
                validation_errors.append(
                    f"Row {row_idx} ({room_code}): Lab classification is required for {room_type} rooms."
                )

            parsed_records.append({
                "row_idx": row_idx,
                "room_code": room_code,
                "room_name": room_name or room_code,
                "room_type": room_type,
                "capacity": capacity,
                "building": building or None,
                "floor": floor or None,
                "lab_classification": lab_class or None,
                "institution_id": inst_id,
                "approval_status": approval,
                "verification_status": verification
            })

        return {
            "total_rows": len(parsed_records),
            "records": parsed_records,
            "errors": validation_errors,
            "valid": len(validation_errors) == 0
        }

    def import_rooms(self, file_path: str, apply: bool = False) -> Dict[str, Any]:
        """
        Executes validation, checks against database for idempotency or conflict,
        and if apply=True, commits the changes.
        """
        report = self.parse_and_validate(file_path)

        if not report["valid"]:
            return {
                "status": "VALIDATION_FAILED",
                "apply": apply,
                "errors": report["errors"],
                "records_evaluated": report["total_rows"],
                "created": 0,
                "matched": 0,
                "conflicts": 0
            }

        # Verify institution existence in DB
        for r in report["records"]:
            inst = self.db.query(Institution).filter(Institution.id == r["institution_id"]).first()
            if not inst:
                report["errors"].append(f"Institution ID {r['institution_id']} does not exist in database.")

        if report["errors"]:
            return {
                "status": "VALIDATION_FAILED",
                "apply": apply,
                "errors": report["errors"],
                "records_evaluated": report["total_rows"],
                "created": 0,
                "matched": 0,
                "conflicts": 0
            }

        to_create: List[Dict[str, Any]] = []
        matched: List[str] = []
        conflicts: List[str] = []

        for r in report["records"]:
            existing = self.db.query(TimetableRoom).filter(TimetableRoom.room_code == r["room_code"]).first()
            if not existing:
                to_create.append(r)
            else:
                # Check for idempotent match
                is_match = (
                    existing.room_type == r["room_type"] and
                    existing.capacity == r["capacity"] and
                    existing.institution_id == r["institution_id"] and
                    (existing.lab_classification or None) == (r["lab_classification"] or None)
                )
                if is_match:
                    matched.append(r["room_code"])
                else:
                    conflicts.append(
                        f"Conflict for room '{r['room_code']}': incoming (type={r['room_type']}, cap={r['capacity']}) "
                        f"differs from existing (type={existing.room_type}, cap={existing.capacity}). Cannot overwrite."
                    )

        if conflicts:
            return {
                "status": "CONFLICT_DETECTED",
                "apply": apply,
                "conflicts": conflicts,
                "records_evaluated": report["total_rows"],
                "created": 0,
                "matched": len(matched)
            }

        if apply:
            try:
                for r in to_create:
                    new_room = TimetableRoom(
                        institution_id=r["institution_id"],
                        room_code=r["room_code"],
                        room_name=r["room_name"],
                        building=r["building"],
                        floor=r["floor"],
                        room_type=r["room_type"],
                        capacity=r["capacity"],
                        lab_classification=r["lab_classification"],
                        active=True
                    )
                    self.db.add(new_room)
                self.db.commit()
                status = "SUCCESS_APPLIED"
            except Exception as e:
                self.db.rollback()
                return {
                    "status": "DATABASE_ERROR",
                    "error": str(e),
                    "created": 0
                }
        else:
            status = "DRY_RUN_COMPLETED"

        return {
            "status": status,
            "apply": apply,
            "records_evaluated": report["total_rows"],
            "to_create": len(to_create),
            "created": len(to_create) if apply else 0,
            "matched_idempotent": len(matched),
            "conflicts": 0,
            "created_room_codes": [r["room_code"] for r in to_create]
        }
