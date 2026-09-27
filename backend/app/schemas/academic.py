from pydantic import BaseModel
from typing import List, Optional

class ProgrammeBase(BaseModel):
    id: int
    name: str
    programme_type: str

class DepartmentResponse(BaseModel):
    id: int
    name: str
    programmes: List[ProgrammeBase]

class SectionSchema(BaseModel):
    id: int
    name: str

class AcademicWorkspaceResponse(BaseModel):
    workspace_id: str
    department_id: int
    department_name: str
    programme_id: int
    programme_name: str
    programme_year: int
    academic_year_id: int
    academic_year_name: str
    semester: int
    semester_type: str
    workflow_state: str = "PREFERENCES"
    sections: List[SectionSchema] = []
