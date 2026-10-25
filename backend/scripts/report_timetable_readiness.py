#!/usr/bin/env python
"""
Read-Only Timetable Readiness Report CLI.

Evaluates workspaces against generation prerequisites without mutating any data
or invoking the solver.

Usage:
  python backend/scripts/report_timetable_readiness.py [--workspace-id <ws_id>] [--institution-id <id>]
"""

import sys
import os
import argparse
import json

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database.connection import SessionLocal
from app.services.timetable_readiness_service import (
    evaluate_workspace_timetable_readiness,
    generate_institutional_timetable_readiness_report
)


def main():
    parser = argparse.ArgumentParser(description="Generate read-only timetable readiness report.")
    parser.add_argument("--workspace-id", help="Specific workspace ID to evaluate.")
    parser.add_argument("--institution-id", type=int, default=2, help="Institution ID (default: 2 for FLABS).")
    parser.add_argument("--json", action="store_true", help="Output report in JSON format.")

    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.workspace_id:
            report = evaluate_workspace_timetable_readiness(args.workspace_id, db)
            if args.json:
                print(json.dumps(report, indent=2))
                return

            print("=" * 70)
            print(f"TIMETABLE READINESS REPORT: Workspace '{args.workspace_id}'")
            print("=" * 70)
            print(f"Status: {report['status']}")
            print(f"Workflow State: {report['workflow_state']}")
            print(f"Approved Allocations: {report['allocations_approved']} (Theory: {report['theory_components']}, Lab: {report['lab_components']})")
            print(f"Sections: {report['sections_count']} (Max Strength: {report['max_section_strength']})")
            print(f"Periods: {report['periods_count']}")
            print(f"Available Classrooms: {report['available_classrooms']}, Labs: {report['available_labs']}")

            if report["blockers"]:
                print("\nGeneration Blockers:")
                for b in report["blockers"]:
                    print(f"  [X] {b}")

            if report["warnings"]:
                print("\nPolicy Warnings:")
                for w in report["warnings"]:
                    print(f"  [!] {w}")

        else:
            rep = generate_institutional_timetable_readiness_report(db, institution_id=args.institution_id)
            if args.json:
                print(json.dumps(rep, indent=2))
                return

            print("=" * 70)
            print(f"INSTITUTIONAL TIMETABLE READINESS REPORT (Institution ID: {args.institution_id})")
            print("=" * 70)
            sm = rep["summary"]
            print(f"Total Workspaces Evaluated: {sm['TOTAL']}")
            print(f"  - Ready for Preview:          {sm['READY_FOR_PREVIEW']}")
            print(f"  - Requires Policy Decision:   {sm['REQUIRES_POLICY_DECISION']}")
            print(f"  - Blocked:                    {sm['BLOCKED']}")
            print("-" * 70)

            # Print first 10 blocked workspaces as sample
            blocked_workspaces = [w for w in rep["workspaces"] if w["status"] == "BLOCKED"]
            print(f"\nSample Blocked Workspaces ({len(blocked_workspaces)} total):")
            for w in blocked_workspaces[:10]:
                print(f"\nWorkspace: {w['workspace_id']} | State: {w['workflow_state']}")
                for b in w["blockers"][:3]:
                    print(f"  - {b}")
                if len(w["blockers"]) > 3:
                    print(f"  - ... and {len(w['blockers']) - 3} more blockers")

    finally:
        db.close()


if __name__ == "__main__":
    main()
