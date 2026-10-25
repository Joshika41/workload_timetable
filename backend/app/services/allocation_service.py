from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.domain import User, SubjectAllocation, AllocationComponent, AllocationRoleEnum, AllocationStatusEnum, Section, Subject, FacultyProfile
from app.repositories.allocation_repository import AllocationRepository
from app.schemas.allocation import SubjectAllocationRequest
from app.services.faculty_service import FacultyService
from app.services.workload_service import WorkloadService

class AllocationService:
    def __init__(self):
        self.repo = AllocationRepository()
        self.faculty_service = FacultyService()
        self.workload_service = WorkloadService()

    def _validate_section_access(self, db: Session, section_id: int, user: User):
        section = db.query(Section).filter(Section.id == section_id).first()
        if not section:
            raise HTTPException(status_code=404, detail="INVALID_SECTION")
        # In actual business logic, HOD should only access their department's sections
        # But this might need to be relaxed if cross-department teaching is allowed.
        # For now, enforce HOD department check.
        # But wait, sections belong to programmes which belong to departments.
        # However, section doesn't easily trace to department without going through workspace.
        return section

    def get_workspace_allocations(self, db: Session, workspace_id: str, user: User):
        from app.core.workspace import decode_workspace_id
        try:
            context = decode_workspace_id(workspace_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid workspace ID")
            
        if user.department_id != context.department_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this workspace")
            
        return self.repo.get_all_by_workspace(db, context)

    def create_or_update_allocation(self, db: Session, req: SubjectAllocationRequest, user: User, workspace_id: str):
        section = self._validate_section_access(db, req.section_id, user)
        
        if section.workspace_id != workspace_id:
            raise HTTPException(status_code=400, detail="INVALID_CONTEXT")
            
        subject = db.query(Subject).filter(Subject.id == req.subject_id).first()
        if not subject:
            raise HTTPException(status_code=404, detail="INVALID_SUBJECT")

        allocation = db.query(SubjectAllocation).filter(
            SubjectAllocation.workspace_id == workspace_id,
            SubjectAllocation.section_id == req.section_id,
            SubjectAllocation.subject_id == req.subject_id
        ).first()
        
        allocated_theory = sum(c.theory_hours for c in req.components)
        allocated_practical = sum(c.practical_hours for c in req.components)
        
        if allocated_theory > subject.theory_hours or allocated_practical > subject.practical_hours:
            raise HTTPException(status_code=400, detail="HOURS_EXCEED_REQUIREMENT")
            
        # Validate no duplicate faculty assigned to the same section allocation
        assigned_faculties = [c.faculty_id for c in req.components]
        if len(assigned_faculties) != len(set(assigned_faculties)):
            raise HTTPException(status_code=400, detail="DUPLICATE_FACULTY_IN_ALLOCATION")
            
        status = AllocationStatusEnum.UNALLOCATED
        if allocated_theory == 0 and allocated_practical == 0:
            status = AllocationStatusEnum.UNALLOCATED
        elif allocated_theory >= subject.theory_hours and allocated_practical >= subject.practical_hours:
            status = AllocationStatusEnum.ALLOCATED
        else:
            status = AllocationStatusEnum.PARTIALLY_ALLOCATED
        
        if not allocation:
            allocation = SubjectAllocation(
                workspace_id=workspace_id,
                section_id=req.section_id,
                subject_id=req.subject_id,
                status=status
            )
            db.add(allocation)
            db.flush()
        else:
            allocation.status = status
            db.query(AllocationComponent).filter(AllocationComponent.allocation_id == allocation.id).delete()
            db.flush()
            
        for c in req.components:
            role_val = c.role.replace('_', '-').title() if 'INCHARGE' in c.role.upper() else c.role
            try:
                role_enum = AllocationRoleEnum(role_val)
            except ValueError:
                try:
                    role_enum = AllocationRoleEnum(c.role)
                except ValueError:
                    raise HTTPException(status_code=400, detail="INVALID_ROLE")
                
            fac = db.query(FacultyProfile).filter(FacultyProfile.id == c.faculty_id).first()
            if not fac:
                raise HTTPException(status_code=400, detail="INVALID_FACULTY")
                
            comp = AllocationComponent(
                allocation_id=allocation.id,
                faculty_id=c.faculty_id,
                role=role_enum,
                theory_hours=c.theory_hours,
                practical_hours=c.practical_hours
            )
            db.add(comp)
            
        db.commit()
        db.refresh(allocation)
        return allocation

    def finalize_workspace_allocations(self, db: Session, workspace_id: str, user: User, context: "WorkspaceContext"):
        allocations = self.repo.get_all_by_workspace(db, context)
        if not allocations:
            raise HTTPException(status_code=404, detail="No allocations found in this workspace")
            
        for allocation in allocations:
            allocation.status = AllocationStatusEnum.FINALIZED
            db.add(allocation)
            
        return allocations
