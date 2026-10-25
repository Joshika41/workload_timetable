"""
Semester Eligibility Service.

Implements canonical rules for academic semester eligibility in timetable generation:
1. Six-semester programmes (e.g. B.Sc, BCA):
   - Odd cycle: Semesters 1, 3, 5
   - Even cycle: Semesters 2, 4, 6
   - Project-only exclusion NEVER applies to six-semester programmes.
2. Four-semester programmes (e.g. MCA, M.Sc):
   - Odd cycle: Semesters 1, 3
   - Even cycle: Semesters 2, 4
   - General project-only exclusion: If curriculum data confirms that a semester contains
     exclusively project work or non-timetabled academic activities (total timetabled hours == 0
     or all offerings are project/internship), it is excluded from timetable generation.
3. Ambiguity & Safety:
   - If curriculum data has zero offerings or is ambiguous, the semester is flagged for review.
   - Workload reporting and academic records remain intact even when a semester is excluded from timetable generation.
"""

from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.models.domain import Programme, CurriculumOffering, Subject, AcademicWorkspace


def get_programme_semester_count(programme: Programme, db: Session) -> int:
    """
    Determines verified semester count from curriculum offerings or programme type.
    """
    # 1. Inspect actual curriculum offerings
    offerings = db.query(CurriculumOffering).filter(CurriculumOffering.programme_id == programme.id).all()
    if offerings:
        max_sem = max((o.semester for o in offerings if o.semester is not None), default=0)
        if max_sem in [4, 6, 8]:
            return max_sem

    # 2. Inspect programme type heuristic
    ptype = (programme.programme_type or "").upper()
    if "PG" in ptype or "POSTGRADUATE" in ptype:
        return 4
    if "UG" in ptype or "UNDERGRADUATE" in ptype:
        return 6

    # 3. Default safe minimum
    return 6


def evaluate_semester_eligibility(
    programme_id: int,
    semester_number: int,
    cycle: str,  # 'ODD' or 'EVEN'
    db: Session
) -> Dict[str, Any]:
    """
    Evaluates whether a specific programme semester is eligible for timetable generation
    in the requested academic cycle (ODD or EVEN).
    """
    cycle_upper = cycle.upper()
    if cycle_upper not in ["ODD", "EVEN"]:
        return {
            "eligible": False,
            "reason": f"Invalid academic cycle '{cycle}'. Must be 'ODD' or 'EVEN'.",
            "is_project_only": False,
            "status": "INVALID_CYCLE"
        }

    prog = db.query(Programme).filter(Programme.id == programme_id).first()
    if not prog:
        return {
            "eligible": False,
            "reason": f"Programme with ID {programme_id} not found.",
            "is_project_only": False,
            "status": "PROGRAMME_NOT_FOUND"
        }

    total_semesters = get_programme_semester_count(prog, db)

    # 1. Check Cycle Match
    is_odd = (semester_number % 2 != 0)
    if cycle_upper == "ODD" and not is_odd:
        return {
            "eligible": False,
            "reason": f"Semester {semester_number} is an EVEN semester, not eligible in ODD cycle.",
            "is_project_only": False,
            "status": "CYCLE_MISMATCH"
        }
    if cycle_upper == "EVEN" and is_odd:
        return {
            "eligible": False,
            "reason": f"Semester {semester_number} is an ODD semester, not eligible in EVEN cycle.",
            "is_project_only": False,
            "status": "CYCLE_MISMATCH"
        }

    # 2. Check Semester Range
    if semester_number > total_semesters:
        return {
            "eligible": False,
            "reason": f"Semester {semester_number} exceeds total curriculum semesters ({total_semesters}) for programme '{prog.name}'.",
            "is_project_only": False,
            "status": "EXCEEDS_MAX_SEMESTER"
        }

    # 3. Six-Semester Programme Rules: Never exclude via project-only rule
    if total_semesters >= 6:
        # Check if offerings exist
        offerings = db.query(CurriculumOffering).filter(
            CurriculumOffering.programme_id == programme_id,
            CurriculumOffering.semester == semester_number
        ).all()
        if not offerings:
            return {
                "eligible": False,
                "reason": f"Semester {semester_number} has no curriculum offerings defined in database.",
                "is_project_only": False,
                "status": "NO_OFFERINGS"
            }
        return {
            "eligible": True,
            "reason": f"Semester {semester_number} is an eligible timetable semester for 6-semester programme '{prog.name}'.",
            "is_project_only": False,
            "status": "ELIGIBLE",
            "total_semesters": total_semesters
        }

    # 4. Four-Semester Programme Rules: General Project-Only Exclusion
    if total_semesters == 4:
        offerings = db.query(CurriculumOffering).filter(
            CurriculumOffering.programme_id == programme_id,
            CurriculumOffering.semester == semester_number
        ).all()

        if not offerings:
            return {
                "eligible": False,
                "reason": f"Semester {semester_number} has no curriculum offerings defined in database.",
                "is_project_only": False,
                "status": "AMBIGUOUS_NO_OFFERINGS"
            }

        # Inspect subjects to see if any have timetabled teaching hours
        timetabled_teaching_hours = 0
        all_project_or_internship = True

        for off in offerings:
            subj = db.query(Subject).filter(Subject.id == off.subject_id).first()
            if subj:
                l_hrs = getattr(subj, "theory_hours", 0) or 0
                p_hrs = getattr(subj, "practical_hours", 0) or 0
                c_name = (getattr(subj, "course_name", "") or "").upper()
                c_code = (getattr(subj, "course_code", "") or "").upper()

                # If it has lecture hours, it is a timetabled class
                if l_hrs > 0:
                    timetabled_teaching_hours += l_hrs
                    all_project_or_internship = False

                # If practical hours exist, check if it's a project/internship course
                if p_hrs > 0:
                    is_proj = ("PROJECT" in c_name or "INTERNSHIP" in c_name or "DISSERTATION" in c_name or "P0" in c_code or "P4" in c_code)
                    if not is_proj:
                        timetabled_teaching_hours += p_hrs
                        all_project_or_internship = False
            else:
                # Ambiguous subject record
                return {
                    "eligible": False,
                    "reason": f"Curriculum offering {off.id} links to non-existent Subject ID {off.subject_id}.",
                    "is_project_only": False,
                    "status": "AMBIGUOUS_DATA"
                }

        if all_project_or_internship or timetabled_teaching_hours == 0:
            return {
                "eligible": False,
                "reason": f"Semester {semester_number} of 4-semester programme '{prog.name}' is verified as project-only / non-timetabled academic activity.",
                "is_project_only": True,
                "status": "EXCLUDED_PROJECT_ONLY",
                "total_semesters": total_semesters
            }

        return {
            "eligible": True,
            "reason": f"Semester {semester_number} of 4-semester programme '{prog.name}' contains {timetabled_teaching_hours} timetabled teaching hours.",
            "is_project_only": False,
            "status": "ELIGIBLE",
            "total_semesters": total_semesters
        }

    return {
        "eligible": False,
        "reason": f"Unhandled programme configuration with {total_semesters} semesters.",
        "is_project_only": False,
        "status": "UNHANDLED_PROGRAMME"
    }
