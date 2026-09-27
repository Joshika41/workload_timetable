from sqlalchemy.orm import Session
from app.models.domain import SubjectAllocation, AllocationComponent, Section, AllocationStatusEnum
from app.repositories.base import BaseRepository

class AllocationRepository(BaseRepository[SubjectAllocation]):
    def __init__(self):
        super().__init__(SubjectAllocation)

    def get_by_section(self, db: Session, section_id: int):
        return db.query(self.model).filter(self.model.section_id == section_id).first()

    def get_all_by_workspace(self, db: Session, context: "WorkspaceContext"):
        from app.models.domain import CurriculumOffering
        query = db.query(self.model).join(Section).join(CurriculumOffering).filter(
            CurriculumOffering.programme_id == context.programme_id,
            CurriculumOffering.programme_year == context.programme_year,
            CurriculumOffering.academic_year_id == context.academic_year_id,
            CurriculumOffering.semester == context.semester
        )
        return query.all()

    def clear_components(self, db: Session, allocation_id: int):
        db.query(AllocationComponent).filter(AllocationComponent.allocation_id == allocation_id).delete()
        db.commit()

    def add_component(self, db: Session, component: AllocationComponent):
        db.add(component)
        db.commit()
        db.refresh(component)
        return component
