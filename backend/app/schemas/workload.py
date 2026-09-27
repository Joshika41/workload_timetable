from pydantic import BaseModel
from typing import List, Optional

class FacultyWorkloadResponse(BaseModel):
    faculty_id: int
    faculty_name: str
    designation: str
    total_theory_hours: int
    total_practical_hours: int
    total_teaching_hours: int
    status: str

class ClassMatrixRow(BaseModel):
    section_id: int
    section_name: str
    subject_code: str
    subject_name: str
    theory: int
    practical: int
    total: int
    main_faculty: str
    assistant_faculty: Optional[str]
    status: str
