from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
from app.models.domain import (
    User, FacultyProfile, SubjectAllocation, AllocationComponent,
    Section, AllocationRoleEnum, AllocationStatusEnum
)

class WorkloadService:
    def get_faculty_workload(self, db: Session, department_id: int, workspace_id: str = None, finalized_only: bool = True):
        """Compute faculty workload from allocation records."""
        from app.services.faculty_service import FacultyService
        fac_service = FacultyService()

        faculties = (
            db.query(FacultyProfile)
            .join(User, User.id == FacultyProfile.user_id)
            .filter(User.department_id == department_id)
            .order_by(FacultyProfile.seniority_index.asc(), FacultyProfile.name.asc())
            .all()
        )
        
        faculty_ids = [f.id for f in faculties]

        comps_query = (
            db.query(AllocationComponent)
            .options(
                joinedload(AllocationComponent.allocation).joinedload(SubjectAllocation.subject),
                joinedload(AllocationComponent.allocation).joinedload(SubjectAllocation.section)
            )
            .join(SubjectAllocation, SubjectAllocation.id == AllocationComponent.allocation_id)
            .filter(AllocationComponent.faculty_id.in_(faculty_ids))
        )
        if workspace_id:
            comps_query = comps_query.filter(SubjectAllocation.workspace_id == workspace_id)
        if finalized_only:
            comps_query = comps_query.filter(SubjectAllocation.status == AllocationStatusEnum.FINALIZED)
            
        all_comps = comps_query.all()
        
        # Group components by faculty_id
        from collections import defaultdict
        comps_by_faculty = defaultdict(list)
        for c in all_comps:
            comps_by_faculty[c.faculty_id].append(c)

        result = []
        for f in faculties:
            comps = comps_by_faculty.get(f.id, [])
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

            target = fac_service.get_faculty_target_workload(db, f)
            capacity = fac_service.get_faculty_capacity(db, f, total)

            result.append({
                "faculty_id": f.id,
                "faculty_name": f.name,
                "erp_id": f.erp_id,
                "designation": f.designation,
                "total_theory_hours": theory,
                "total_practical_hours": practical,
                "total_teaching_hours": total,
                "campus_work_hours": f.campus_work_hours or 0,
                "target_workload": target,
                "remaining_capacity": capacity,
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
            incharge_1 = []
            incharge_2 = []
            for c in alloc.components:
                if c.role == AllocationRoleEnum.INCHARGE_1:
                    incharge_1.append({
                        "name": c.faculty.name,
                        "theory_hours": c.theory_hours,
                        "practical_hours": c.practical_hours,
                    })
                else:
                    incharge_2.append({
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
                "incharge_1": incharge_1,
                "incharge_2": incharge_2,
                "status": alloc.status.value,
            })

        return result

    def get_faculty_subjects(self, db: Session, faculty_profile_id: int, workspace_id: str = None):
        """Return unified subjects from preferences and allocations for a faculty member."""
        from app.models.domain import PreferenceSubmission, Subject, CurriculumOffering, Programme, AllocationComponent, SubjectAllocation
        
        # 1. Fetch preferences
        pref_query = db.query(PreferenceSubmission).filter(PreferenceSubmission.faculty_id == faculty_profile_id)
        if workspace_id:
            pref_query = pref_query.filter(PreferenceSubmission.workspace_id == workspace_id)
        subs = pref_query.all()
        
        # 2. Fetch all allocations for this faculty
        comp_query = (
            db.query(AllocationComponent)
            .join(SubjectAllocation, SubjectAllocation.id == AllocationComponent.allocation_id)
            .filter(AllocationComponent.faculty_id == faculty_profile_id)
        )
        if workspace_id:
            comp_query = comp_query.filter(SubjectAllocation.workspace_id == workspace_id)
        comps = comp_query.all()
        
        subjects_map = {} # subject_id -> dict
        
        # Add preferences first
        for sub in subs:
            for item in sub.items:
                subj = item.subject
                # Find programme / class type
                off = db.query(CurriculumOffering).filter(CurriculumOffering.subject_id == subj.id).first()
                prog_name = ""
                if off:
                    p = db.query(Programme).filter(Programme.id == off.programme_id).first()
                    prog_name = p.name if p else ""
                    
                subjects_map[subj.id] = {
                    "subject_id": subj.id,
                    "subject_code": subj.course_code,
                    "subject_name": subj.course_name,
                    "category": subj.category,
                    "class_type": prog_name,
                    "semester": off.semester if off else None,
                    "required_theory": subj.theory_hours or 0,
                    "required_practical": subj.practical_hours or 0,
                    "preference_status": item.decision.value if item.decision else "PENDING",
                    "allocation_status": "NOT_STARTED", # Will be overwritten if allocated
                    "allocations": []
                }
                
        # Add/Update from allocations
        for c in comps:
            alloc = c.allocation
            subj = alloc.subject
            if subj.id not in subjects_map:
                off = db.query(CurriculumOffering).filter(CurriculumOffering.subject_id == subj.id).first()
                prog_name = ""
                if off:
                    p = db.query(Programme).filter(Programme.id == off.programme_id).first()
                    prog_name = p.name if p else ""
                    
                subjects_map[subj.id] = {
                    "subject_id": subj.id,
                    "subject_code": subj.course_code,
                    "subject_name": subj.course_name,
                    "category": subj.category,
                    "class_type": prog_name,
                    "semester": off.semester if off else None,
                    "required_theory": subj.theory_hours or 0,
                    "required_practical": subj.practical_hours or 0,
                    "preference_status": "NOT_SELECTED",
                    "allocation_status": alloc.status.value,
                    "allocations": []
                }
                
            # Update allocation status
            subjects_map[subj.id]["allocation_status"] = alloc.status.value
            
            # Guard against duplicate allocation rows for the same section
            sec_name = alloc.section.name if alloc.section else ""
            existing_alloc_entry = next((a for a in subjects_map[subj.id]["allocations"] if a["section"] == sec_name), None)
            if not existing_alloc_entry:
                subjects_map[subj.id]["allocations"].append({
                    "allocation_id": alloc.id,
                    "section": sec_name,
                    "role": c.role.value,
                    "assigned_theory": c.theory_hours,
                    "assigned_practical": c.practical_hours,
                    "status": alloc.status.value
                })
            
        return list(subjects_map.values())

    def calculate_subject_reconciliation(self, db: Session, subject_id: int, workspace_id: str) -> dict:
        from app.models.domain import Subject, SubjectAllocation, AllocationComponent
        
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subject:
            return None
            
        allocations = db.query(SubjectAllocation).filter(
            SubjectAllocation.workspace_id == workspace_id,
            SubjectAllocation.subject_id == subject_id
        ).all()
        
        sections_count = len(allocations)
        
        req_theory = (subject.theory_hours or 0) * sections_count
        req_practical = (subject.practical_hours or 0) * sections_count
        req_total = req_theory + req_practical
        
        alloc_theory = 0
        alloc_practical = 0
        
        for alloc in allocations:
            for comp in alloc.components:
                alloc_theory += (comp.theory_hours or 0)
                alloc_practical += (comp.practical_hours or 0)
                
        alloc_total = alloc_theory + alloc_practical
        diff = req_total - alloc_total
        
        if sections_count == 0:
            status = "MISSING_ALLOCATION"
        elif diff == 0:
            status = "RECONCILED"
        elif diff > 0 and alloc_total > 0:
            status = "PARTIALLY_ALLOCATED"
        elif alloc_total == 0:
            status = "MISSING_ALLOCATION"
        else:
            status = "OVER_ALLOCATED"
            
        return {
            "subject_id": subject_id,
            "sections_count": sections_count,
            "required_theory": req_theory,
            "required_practical": req_practical,
            "required_total": req_total,
            "allocated_theory": alloc_theory,
            "allocated_practical": alloc_practical,
            "allocated_total": alloc_total,
            "difference": diff,
            "status": status
        }

    def get_class_matrix(self, db: Session, workspace_id: str) -> List[dict]:
        from app.models.domain import AcademicWorkspace, CurriculumOffering, Section, SubjectAllocation, AllocationComponent, Semester, FacultyProfile, User, Subject
        from collections import defaultdict
        
        ws = db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
        if not ws:
            return []
            
        sem = db.query(Semester).filter(Semester.id == ws.semester_id).first()
        if not sem:
            return []
            
        # Get sections
        sections = db.query(Section).filter(Section.workspace_id == workspace_id).order_by(Section.name).all()
        if not sections:
            return [] # Polish empty state for FLABS zero-section case
            
        sec_list = [{"name": s.name, "advisor": getattr(s, 'advisor', None)} for s in sections]
        sections_count = len(sec_list)
        
        # Get offerings (subjects)
        offerings = db.query(CurriculumOffering).filter(
            CurriculumOffering.programme_id == ws.programme_id,
            CurriculumOffering.academic_year_id == ws.academic_year_id,
            CurriculumOffering.semester == sem.semester_number
        ).all()
        
        if not offerings:
            return []
            
        subject_ids = [off.subject_id for off in offerings]
        
        allocations = db.query(SubjectAllocation).filter(
            SubjectAllocation.workspace_id == workspace_id,
            SubjectAllocation.subject_id.in_(subject_ids)
        ).all()
        
        alloc_map = defaultdict(lambda: defaultdict(list))
        sec_id_map = {s.id: s.name for s in sections}
        
        fac_comps = []
        for a in allocations:
            sec_name = sec_id_map.get(a.section_id)
            if not sec_name: continue
            alloc_map[a.subject_id][sec_name].extend(a.components)
            fac_comps.extend(a.components)
            
        fac_ids = list(set([c.faculty_id for c in fac_comps]))
        fps = db.query(FacultyProfile).filter(FacultyProfile.user_id.in_(fac_ids)).all() if fac_ids else []
        users = db.query(User).filter(User.id.in_(fac_ids)).all() if fac_ids else []
        fac_name_map = {}
        for u in users:
            fp = next((f for f in fps if f.user_id == u.id), None)
            fac_name_map[u.id] = fp.name if fp else (u.email.split('@')[0].title())
            
        subjects_data = []
        class_total_theory = 0
        class_total_lab = 0
        
        for off in offerings:
            subj = off.subject
            req_theory = (subj.theory_hours or 0) * sections_count
            req_lab = (subj.practical_hours or 0) * sections_count
            req_total = req_theory + req_lab
            
            allocated_total = 0
            sec_data = {}
            
            for s in sections:
                sec_name = s.name
                comps = alloc_map[subj.id].get(sec_name, [])
                
                in1 = None
                in2 = None
                for c in comps:
                    t = c.theory_hours or 0
                    l = c.practical_hours or 0
                    tot = t + l
                    allocated_total += tot
                    
                    c_data = {
                        "name": fac_name_map.get(c.faculty_id, str(c.faculty_id)),
                        "theory": t,
                        "lab": l,
                        "total": tot
                    }
                    if c.role.value == "Incharge-1":
                        in1 = c_data
                    elif c.role.value == "Incharge-2":
                        in2 = c_data
                        
                sec_data[sec_name] = {
                    "Incharge-1": in1,
                    "Incharge-2": in2
                }
                
            diff = req_total - allocated_total
            if sections_count == 0:
                status = "MISSING"
            elif diff == 0:
                status = "RECONCILED"
            elif diff > 0 and allocated_total > 0:
                status = "PARTIAL"
            elif allocated_total == 0:
                status = "MISSING"
            else:
                status = "OVER_ALLOCATED"
                
            class_total_theory += sum(c.theory_hours or 0 for s_comps in alloc_map[subj.id].values() for c in s_comps)
            class_total_lab += sum(c.practical_hours or 0 for s_comps in alloc_map[subj.id].values() for c in s_comps)
            
            subjects_data.append({
                "subject_code": subj.course_code,
                "subject_short": subj.course_code,
                "subject_name": subj.course_name,
                "sections": sec_data,
                "allocated_total": allocated_total,
                "required_total": req_total,
                "difference": diff,
                "status": status
            })
            
        class_total = class_total_theory + class_total_lab
        subjects_data.sort(key=lambda x: x["subject_code"])
        class_name = f"Semester {sem.semester_number} - {ws.programme.name}"
        
        return [{
            "class_name": class_name,
            "sections": sec_list,
            "subjects": subjects_data,
            "total_hours": class_total,
            "total_theory": class_total_theory,
            "total_lab": class_total_lab
        }]
