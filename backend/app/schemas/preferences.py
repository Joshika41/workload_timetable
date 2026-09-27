from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class SubjectPref(BaseModel):
    subject_id: int
    rank: int

class PreferenceSubmitRequest(BaseModel):
    workspace_id: str
    preferences: List[SubjectPref]

class PreferenceItemResponse(BaseModel):
    id: int
    subject_id: int
    subject_code: str
    subject_name: str
    category: str
    rank: int
    decision: str

class PreferenceSubmissionResponse(BaseModel):
    id: int
    faculty_id: int
    faculty_name: str
    workspace_id: str
    status: str
    review_status: str
    submitted_at: Optional[datetime]
    items: List[PreferenceItemResponse]

class PreferenceDecisionRequest(BaseModel):
    decision: str  # APPROVED, PENDING, DENIED

class SubmissionReviewRequest(BaseModel):
    review_status: str  # APPROVED, PENDING, DENIED
