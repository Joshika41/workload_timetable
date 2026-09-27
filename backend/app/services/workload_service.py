from sqlalchemy.orm import Session
from app.models.domain import (
    User, FacultyProfile, SubjectAllocation, AllocationComponent,
    Section, AllocationRoleEnum, AllocationStatusEnum
)

class WorkloadService:
    def get_faculty_workload(self, db: Session, department_id: int, workspace_id: str = None, finalized_only: bool = True):
        """Compute faculty workload from allocation records."""
        faculties = (
            db.query(FacultyProfile)
            .join(User, User.id == FacultyProfile.user_id)
            .filter(User.department_id == department_id)
            .all()
        )

        result = []
        for f in faculties:
            query = (
                db.query(AllocationComponent)
                .join(SubjectAllocation, SubjectAllocation.id == AllocationComponent.allocation_id)
                .filter(AllocationComponent.faculty_id == f.id)
            )
            if workspace_id:
                query = query.filter(SubjectAllocation.workspace_id == workspace_id)
                
            if finalized_only:
                query = query.filter(SubjectAllocation.status == AllocationStatusEnum.FINALIZED)

            comps = query.all()
            theory = sum(c.theory_hours for c in comps)
            practical = sum(c.practical_hours for c in comps)
            total = theory + practical

            # Gather subject assignments
            assignments = []
            for c in comps:
                alloc = c.allocation
                assignments.append({
                    "subject_code": alloc.subject.course_code,
                    "subject_name": alloc.subject.course_name,
                    "section": alloc.section.name if alloc.section else "",
                    "role": c.role.value,
                    "theory_hours": c.theory_hours,
                    "practical_hours": c.practical_hours,
                })

            result.append({
                "faculty_id": f.id,
                "faculty_name": f.name,
                "erp_id": f.erp_id,
                "designation": f.designation,
                "total_theory_hours": theory,
                "total_practical_hours": practical,
                "total_teaching_hours": total,
                "status": "Finalized" if total > 0 else "No Allocation",
                "assignments": assignments,
            })
        return result

    def get_class_matrix(self, db: Session, workspace_id: str):
        """Class-wise matrix: all sections x all subjects, derived from FINALIZED allocations."""
        # Get all workspace sections
        sections = db.query(Section).filter(Section.workspace_id == workspace_id).all()
        # Deduplicate section names
        seen_names = {}
        unique_sections = []
        for s in sections:
            if s.name not in seen_names:
                seen_names[s.name] = s
                unique_sections.append(s)

        # Get all finalized allocations for this workspace
        allocations = (
            db.query(SubjectAllocation)
            .filter(
                SubjectAllocation.workspace_id == workspace_id,
                SubjectAllocation.status == AllocationStatusEnum.FINALIZED
            )
            .all()
        )

        # Build matrix: section_name -> list of subject allocations
        result = []
        for alloc in allocations:
            main_faculty = []
            asst_faculty = []
            for c in alloc.components:
                if c.role == AllocationRoleEnum.INCHARGE_1:
                    main_faculty.append({
                        "name": c.faculty.name,
                        "theory_hours": c.theory_hours,
                        "practical_hours": c.practical_hours,
                    })
                else:
                    asst_faculty.append({
                        "name": c.faculty.name,
                        "theory_hours": c.theory_hours,
                        "practical_hours": c.practical_hours,
                    })

            result.append({
                "section_id": alloc.section_id,
                "section_name": alloc.section.name,
                "subject_id": alloc.subject_id,
                "subject_code": alloc.subject.course_code,
                "subject_name": alloc.subject.course_name,
                "category": alloc.subject.category,
                "theory": alloc.subject.theory_hours,
                "practical": alloc.subject.practical_hours,
                "total": alloc.subject.total_hours,
                "main_faculty": main_faculty,
                "assistant_faculty": asst_faculty,
                "status": alloc.status.value,
            })

        return result

    def get_faculty_subjects(self, db: Session, faculty_profile_id: int, workspace_id: str):
        """Return finalized allocations for a specific faculty member."""
        comps = (
            db.query(AllocationComponent)
            .join(SubjectAllocation, SubjectAllocation.id == AllocationComponent.allocation_id)
            .filter(
                AllocationComponent.faculty_id == faculty_profile_id,
                SubjectAllocation.workspace_id == workspace_id,
                SubjectAllocation.status == AllocationStatusEnum.FINALIZED,
            )
            .all()
        )
        result = []
        for c in comps:
            alloc = c.allocation
            result.append({
                "allocation_id": alloc.id,
                "subject_code": alloc.subject.course_code,
                "subject_name": alloc.subject.course_name,
                "section": alloc.section.name,
                "role": c.role.value,
                "theory_hours": c.theory_hours,
                "practical_hours": c.practical_hours,
                "status": alloc.status.value,
            })
        return result
