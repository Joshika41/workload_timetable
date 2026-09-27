from pydantic import BaseModel
from typing import List, Optional

class AllocationComponentRequest(BaseModel):
    faculty_id: int
    role: str # MAIN, ASSISTANT, IN2
    theory_hours: int
    practical_hours: int

class SubjectAllocationRequest(BaseModel):
    workspace_id: str
    section_id: int
    components: List[AllocationComponentRequest]

class AllocationComponentResponse(BaseModel):
    id: int
    faculty_id: int
    faculty_name: str
    role: str
    theory_hours: int
    practical_hours: int

class SubjectAllocationResponse(BaseModel):
    id: int
    section_id: int
    section_name: str
    subject_code: str
    subject_name: str
    status: str
    components: List[AllocationComponentResponse]

class FinalizeAllocationRequest(BaseModel):
    workspace_id: str
