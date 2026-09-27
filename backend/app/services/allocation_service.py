from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.domain import User, SubjectAllocation, AllocationComponent, AllocationRoleEnum, AllocationStatusEnum, Section
from app.repositories.allocation_repository import AllocationRepository
from app.schemas.allocation import SubjectAllocationRequest

class AllocationService:
    def __init__(self):
        self.repo = AllocationRepository()

    def _validate_section_access(self, db: Session, section_id: int, user: User):
        section = db.query(Section).filter(Section.id == section_id).first()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        if section.curriculum_offering.programme.department_id != user.department_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this section")
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

    def create_or_update_allocation(self, db: Session, req: SubjectAllocationRequest, user: User, context: "WorkspaceContext"):
        section = self._validate_section_access(db, req.section_id, user)
        
        # Verify that the section belongs to the workspace
        offering = section.curriculum_offering
        if (offering.programme_id != context.programme_id or 
            offering.programme_year != context.programme_year or
            offering.academic_year_id != context.academic_year_id or 
            offering.semester != context.semester):
            raise HTTPException(status_code=400, detail="Section does not belong to the active workspace")
            
        allocation = self.repo.get_by_section(db, req.section_id)
        
        allocated_theory = sum(c.theory_hours for c in req.components)
        allocated_practical = sum(c.practical_hours for c in req.components)
        
        req_theory = allocation.section.curriculum_offering.subject.theory_hours if allocation else section.curriculum_offering.subject.theory_hours
        req_practical = allocation.section.curriculum_offering.subject.practical_hours if allocation else section.curriculum_offering.subject.practical_hours
        
        status = AllocationStatusEnum.UNALLOCATED
        if allocated_theory == 0 and allocated_practical == 0:
            status = AllocationStatusEnum.UNALLOCATED
        elif allocated_theory >= req_theory and allocated_practical >= req_practical:
            status = AllocationStatusEnum.ALLOCATED
        else:
            status = AllocationStatusEnum.PARTIALLY_ALLOCATED
        
        if not allocation:
            allocation = self.repo.create(db, {"section_id": req.section_id, "status": status})
        else:
            self.repo.clear_components(db, allocation.id)
            self.repo.update(db, allocation, {"status": status})
            
        for c in req.components:
            try:
                role_enum = AllocationRoleEnum(c.role)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid role enum")
                
            comp = AllocationComponent(
                allocation_id=allocation.id,
                faculty_id=c.faculty_id,
                role=role_enum,
                theory_hours=c.theory_hours,
                practical_hours=c.practical_hours
            )
            self.repo.add_component(db, comp)
            
        # Refresh allocation to include components
        db.refresh(allocation)
        return allocation

    def finalize_workspace_allocations(self, db: Session, workspace_id: str, user: User, context: "WorkspaceContext"):
        allocations = self.repo.get_all_by_workspace(db, context)
        if not allocations:
            raise HTTPException(status_code=404, detail="No allocations found in this workspace")
            
        for allocation in allocations:
            self.repo.update(db, allocation, {"status": AllocationStatusEnum.FINALIZED})
            
        return allocations
