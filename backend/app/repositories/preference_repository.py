from sqlalchemy.orm import Session
from app.models.domain import PreferenceSubmission, PreferenceItem, PreferenceStatusEnum, User
from app.repositories.base import BaseRepository

class PreferenceRepository(BaseRepository[PreferenceSubmission]):
    def __init__(self):
        super().__init__(PreferenceSubmission)

    def get_by_faculty_and_workspace(self, db: Session, faculty_id: int, workspace_id: str):
        return db.query(self.model).filter(
            self.model.faculty_id == faculty_id,
            self.model.workspace_id == workspace_id
        ).first()

    def get_all_by_department(self, db: Session, department_id: int, workspace_id: str = None):
        from app.models.domain import FacultyProfile
        q = db.query(self.model).join(FacultyProfile, FacultyProfile.id == self.model.faculty_id).join(User, User.id == FacultyProfile.user_id).filter(User.department_id == department_id)
        if workspace_id:
            q = q.filter(self.model.workspace_id == workspace_id)
        return q.all()

    def get_faculty_submissions(self, db: Session, faculty_id: int, workspace_id: str = None):
        q = db.query(self.model).filter(self.model.faculty_id == faculty_id)
        if workspace_id:
            q = q.filter(self.model.workspace_id == workspace_id)
        return q.all()
        
    def get_item(self, db: Session, item_id: int):
        return db.query(PreferenceItem).filter(PreferenceItem.id == item_id).first()
        
    def update_item_decision(self, db: Session, item_id: int, decision: PreferenceStatusEnum):
        item = self.get_item(db, item_id)
        if item:
            item.decision = decision
            db.commit()
            db.refresh(item)
        return item
