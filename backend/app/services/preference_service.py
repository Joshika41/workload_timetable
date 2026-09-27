from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime
from app.models.domain import User, PreferenceStatusEnum, PreferenceSubmission, PreferenceItem
from app.repositories.preference_repository import PreferenceRepository
from app.schemas.preferences import PreferenceSubmitRequest

class PreferenceService:
    def __init__(self):
        self.repo = PreferenceRepository()

    def get_my_preferences(self, db: Session, user: User, workspace_id: str):
        if not user.faculty_profile:
            raise HTTPException(status_code=400, detail="User is not linked to a faculty profile")
        return self.repo.get_faculty_submissions(db, user.faculty_profile.id, workspace_id)

    def submit_preferences(self, db: Session, user: User, req: PreferenceSubmitRequest, context: "WorkspaceContext"):
        if not user.faculty_profile:
            raise HTTPException(status_code=400, detail="User is not linked to a faculty profile")
            
        existing = self.repo.get_by_faculty_and_workspace(db, user.faculty_profile.id, req.workspace_id)
        
        # Allow re-submission/editing (upsert)
        # Finalization check could go here if workspace state is tied to this endpoint.
        if existing:
            self.repo.delete(db, existing.id)
            
        # Detect duplicates
        subject_ids = [p.subject_id for p in req.preferences]
        if len(subject_ids) != len(set(subject_ids)):
            raise HTTPException(status_code=400, detail="Duplicate subjects found in preferences")
            
        sub = PreferenceSubmission(
            faculty_id=user.faculty_profile.id,
            workspace_id=req.workspace_id,
            status=PreferenceStatusEnum.SUBMITTED,
            submitted_at=datetime.utcnow()
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        
        for pref in req.preferences:
            item = PreferenceItem(
                submission_id=sub.id,
                subject_id=pref.subject_id,
                rank=pref.rank,
                decision=PreferenceStatusEnum.PENDING
            )
            db.add(item)
        db.commit()
        return sub

    def get_all_preferences(self, db: Session, user: User, workspace_id: str):
        if not user.department_id:
            raise HTTPException(status_code=400, detail="User not linked to a department")
        return self.repo.get_all_by_department(db, user.department_id, workspace_id)

    def decide_preference(self, db: Session, item_id: int, decision: str):
        try:
            decision_enum = PreferenceStatusEnum(decision)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid decision status")
            
        item = self.repo.get_item(db, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Preference item not found")
            
        # Check if the decision is valid for an item
        if decision_enum not in [PreferenceStatusEnum.APPROVED, PreferenceStatusEnum.PENDING, PreferenceStatusEnum.DENIED]:
             raise HTTPException(status_code=400, detail="Decision must be APPROVED, PENDING, or DENIED")
             
        self.repo.update_item_decision(db, item_id, decision_enum)
        
        # Check if all items in submission are decided, and update submission status if needed
        # (This can be added later if needed)
        return item
