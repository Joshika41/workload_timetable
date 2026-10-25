#!/usr/bin/env python
"""
CLI Tool for Official Room Inventory Import.

Usage:
  python backend/scripts/import_official_room_inventory.py <path_to_excel> [--apply]

Default is DRY-RUN mode. Database writes require explicit --apply flag.
"""

import sys
import os
import argparse

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.connection import SessionLocal
from app.services.room_inventory_importer import RoomInventoryImporter


def main():
    parser = argparse.ArgumentParser(description="Import official room inventory from Excel template.")
    parser.add_argument("file_path", help="Path to the room inventory Excel template (.xlsx)")
    parser.add_argument("--apply", action="store_true", help="Apply changes to the database. Without this, runs dry-run.")

    args = parser.parse_args()

    print("=" * 70)
    print("OFFICIAL ROOM INVENTORY IMPORT")
    print(f"File: {args.file_path}")
    print(f"Mode: {'APPLY (Database Write)' if args.apply else 'DRY RUN (Preview Only)'}")
    print("=" * 70)

    db = SessionLocal()
    try:
        importer = RoomInventoryImporter(db)
        result = importer.import_rooms(args.file_path, apply=args.apply)

        print(f"\nStatus: {result.get('status')}")
        print(f"Records Evaluated: {result.get('records_evaluated', 0)}")
        print(f"To Create: {result.get('to_create', 0)}")
        print(f"Created in DB: {result.get('created', 0)}")
        print(f"Matched Idempotent: {result.get('matched_idempotent', result.get('matched', 0))}")

        if result.get("errors"):
            print("\nValidation Errors:")
            for err in result["errors"]:
                print(f"  [ERROR] {err}")

        if result.get("conflicts"):
            print("\nConflicts with Existing Database Records:")
            for conf in result["conflicts"]:
                print(f"  [CONFLICT] {conf}")

        if result.get("created_room_codes"):
            print("\nCreated Room Codes:")
            for code in result["created_room_codes"]:
                print(f"  + {code}")

        if not args.apply and result.get("status") == "DRY_RUN_COMPLETED":
            print("\n[NOTE] Dry-run passed without errors. Run with --apply to commit to the database.")

    finally:
        db.close()


if __name__ == "__main__":
    main()
