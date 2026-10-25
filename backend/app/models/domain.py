from sqlalchemy import Column, Integer, String, Boolean, Enum, ForeignKey, Float, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum
import uuid

Base = declarative_base()

class RoleEnum(str, enum.Enum):
    MASTER_ADMIN = "MASTER_ADMIN"
    HOD = "HOD"
    ERP_COORDINATOR = "ERP_COORDINATOR"
    FACULTY = "FACULTY"

class SemesterTypeEnum(str, enum.Enum):
    ODD = "ODD"
    EVEN = "EVEN"

class PreferenceStatusEnum(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    PENDING = "PENDING"
    DENIED = "DENIED"

class AllocationStatusEnum(str, enum.Enum):
    UNALLOCATED = "UNALLOCATED"
    PARTIALLY_ALLOCATED = "PARTIALLY_ALLOCATED"
    ALLOCATED = "ALLOCATED"
    FINALIZED = "FINALIZED"

class WorkspaceWorkflowStateEnum(str, enum.Enum):
    PREFERENCES = "PREFERENCES"
    REVIEW = "REVIEW"
    ALLOCATION = "ALLOCATION"
    FINALIZED = "FINALIZED"

class AllocationRoleEnum(str, enum.Enum):
    INCHARGE_1 = "Incharge-1"
    INCHARGE_2 = "Incharge-2"

class Institution(Base):
    __tablename__ = 'institutions'
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, nullable=False, unique=True, default="")
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Department(Base):
    __tablename__ = 'departments'
    id = Column(Integer, primary_key=True, autoincrement=True)
    institution_id = Column(Integer, ForeignKey('institutions.id'), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    institution = relationship("Institution")
    programmes = relationship("Programme", back_populates="department")
    users = relationship("User", back_populates="department")

class Programme(Base):
    __tablename__ = 'programmes'
    id = Column(Integer, primary_key=True, autoincrement=True)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=False)
    name = Column(String, nullable=False) # e.g. MCA GEN AI
    programme_type = Column(String, nullable=False) # e.g. UG, PG
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    department = relationship("Department", back_populates="programmes")

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    department = relationship("Department", back_populates="users")
    faculty_profile = relationship("FacultyProfile", back_populates="user", uselist=False)

class FacultyProfile(Base):
    __tablename__ = 'faculty_profiles'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, unique=True)
    erp_id = Column(String, nullable=True, unique=True) # made nullable for placeholders
    name = Column(String, nullable=False)
    designation = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    
    # New fields for PRD v0.2
    home_department_id = Column(Integer, ForeignKey('departments.id'), nullable=True)
    faculty_type = Column(String, nullable=True) # e.g. "GUEST", "FTS"
    is_placeholder = Column(Boolean, default=False)
    is_dummy = Column(Boolean, default=False)
    
    seniority_index = Column(Integer, default=999)
    target_workload = Column(Integer, default=18)
    campus_work_hours = Column(Integer, default=0)
    
    user = relationship("User", back_populates="faculty_profile")
    home_department = relationship("Department")

class AcademicYear(Base):
    __tablename__ = 'academic_years'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True) # e.g. 2026-2027

class Semester(Base):
    __tablename__ = 'semesters'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    semester_number = Column(Integer, nullable=False)

class AcademicWorkspace(Base):
    __tablename__ = 'academic_workspaces'
    id = Column(String, primary_key=True) # Base64 encoded context
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=False)
    programme_id = Column(Integer, ForeignKey('programmes.id'), nullable=False)
    academic_year_id = Column(Integer, ForeignKey('academic_years.id'), nullable=False)
    semester_id = Column(Integer, ForeignKey('semesters.id'), nullable=False)
    programme_year = Column(Integer, nullable=False)
    workflow_state = Column(Enum(WorkspaceWorkflowStateEnum), default=WorkspaceWorkflowStateEnum.PREFERENCES)
    version = Column(Integer, default=1) # added version for snapshots
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    department = relationship("Department")
    # deprecated: programme relationship, keeping it for now
    programme = relationship("Programme")
    academic_year = relationship("AcademicYear")
    semester = relationship("Semester")
    
    # New M:N mapped programmes
    mapped_programmes = relationship("WorkspaceProgrammeMap", back_populates="workspace")

class WorkspaceProgrammeMap(Base):
    __tablename__ = 'workspace_programme_map'
    id = Column(Integer, primary_key=True, autoincrement=True)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    programme_id = Column(Integer, ForeignKey('programmes.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    workspace = relationship("AcademicWorkspace", back_populates="mapped_programmes")
    programme = relationship("Programme")

class FacultyWorkspaceScope(Base):
    __tablename__ = 'faculty_workspace_scopes'
    id = Column(Integer, primary_key=True, autoincrement=True)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    faculty = relationship("FacultyProfile")
    workspace = relationship("AcademicWorkspace")

class FacultyProgrammeScope(Base):
    __tablename__ = 'faculty_programme_scopes'
    id = Column(Integer, primary_key=True, autoincrement=True)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    programme_id = Column(Integer, ForeignKey('programmes.id'), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    faculty = relationship("FacultyProfile")
    programme = relationship("Programme")

class Subject(Base):
    __tablename__ = 'subjects'
    __table_args__ = (
        UniqueConstraint('course_code', 'course_name', name='subjects_code_name_key'),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    course_code = Column(String, nullable=False)
    course_name = Column(String, nullable=False)
    credits = Column(Integer, nullable=True)
    theory_hours = Column(Integer, default=0)
    practical_hours = Column(Integer, default=0)
    total_hours = Column(Integer, default=0)
    category = Column(String, default='CORE')

class TeachingDomain(Base):
    __tablename__ = 'teaching_domains'
    id = Column(Integer, primary_key=True, autoincrement=True)
    domain_code = Column(String, unique=True, nullable=False)
    domain_name = Column(String, nullable=False)
    domain_type = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FacultyTeachingEligibility(Base):
    __tablename__ = 'faculty_teaching_eligibility'
    id = Column(Integer, primary_key=True, autoincrement=True)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    domain_code = Column(String, ForeignKey('teaching_domains.domain_code'), nullable=False)
    eligibility_scope = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")
    source_reference = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    faculty = relationship("FacultyProfile")
    domain = relationship("TeachingDomain")

class CurriculumOffering(Base):
    __tablename__ = 'curriculum_offerings'
    id = Column(Integer, primary_key=True, autoincrement=True)
    programme_id = Column(Integer, ForeignKey('programmes.id'), nullable=False)
    academic_year_id = Column(Integer, ForeignKey('academic_years.id'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=False)
    programme_year = Column(Integer, nullable=False) # e.g. 1
    semester = Column(Integer, nullable=False) # e.g. 1
    semester_type = Column(Enum(SemesterTypeEnum), nullable=False)
    requires_preference = Column(Boolean, default=True)
    
    programme = relationship("Programme")
    academic_year = relationship("AcademicYear")
    subject = relationship("Subject")
    teaching_rule = relationship("OfferingTeachingRule", back_populates="offering", uselist=False)

class OfferingTeachingRule(Base):
    __tablename__ = 'offering_teaching_rules'
    id = Column(Integer, primary_key=True, autoincrement=True)
    curriculum_offering_id = Column(Integer, ForeignKey('curriculum_offerings.id'), nullable=False, unique=True)
    teaching_domain_code = Column(String, ForeignKey('teaching_domains.domain_code'), nullable=False)
    teaching_model = Column(String, default="HOME_DEPARTMENT") # HOME_DEPARTMENT, SERVICE_DEPARTMENT, SHARED
    cross_department_allowed = Column(Boolean, default=False)
    preference_eligible = Column(Boolean, default=True)
    status = Column(String, default="ACTIVE")
    source_reference = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    offering = relationship("CurriculumOffering", back_populates="teaching_rule")
    domain = relationship("TeachingDomain")

class Section(Base):
    __tablename__ = 'sections'
    id = Column(Integer, primary_key=True, autoincrement=True)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    curriculum_offering_id = Column(Integer, ForeignKey('curriculum_offerings.id'), nullable=True) # Keeping nullable for backward compatibility
    name = Column(String, nullable=False) # e.g. A, B
    student_strength = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    workspace = relationship("AcademicWorkspace")
    curriculum_offering = relationship("CurriculumOffering")

class PreferenceSubmission(Base):
    __tablename__ = 'preference_submissions'
    id = Column(Integer, primary_key=True, autoincrement=True)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    status = Column(Enum(PreferenceStatusEnum), default=PreferenceStatusEnum.DRAFT)
    review_status = Column(Enum(PreferenceStatusEnum), default=PreferenceStatusEnum.PENDING)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    faculty = relationship("FacultyProfile")
    workspace = relationship("AcademicWorkspace")
    items = relationship("PreferenceItem", back_populates="submission", cascade="all, delete-orphan")

class PreferenceItem(Base):
    __tablename__ = 'preference_items'
    id = Column(Integer, primary_key=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey('preference_submissions.id'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=False)
    rank = Column(Integer, nullable=False)
    decision = Column(Enum(PreferenceStatusEnum), default=PreferenceStatusEnum.PENDING)
    
    submission = relationship("PreferenceSubmission", back_populates="items")
    subject = relationship("Subject")

class SubjectAllocation(Base):
    __tablename__ = 'subject_allocations'
    __table_args__ = (
        UniqueConstraint('workspace_id', 'section_id', 'subject_id', name='uq_subject_allocations_ws_sec_subj'),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    section_id = Column(Integer, ForeignKey('sections.id'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=False)
    status = Column(Enum(AllocationStatusEnum), default=AllocationStatusEnum.UNALLOCATED)
    source = Column(String, default="PREFERRED") # PREFERRED or HOD_OFFERED
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    workspace = relationship("AcademicWorkspace")
    section = relationship("Section")
    subject = relationship("Subject")
    components = relationship("AllocationComponent", back_populates="allocation")

class AllocationComponent(Base):
    __tablename__ = 'allocation_components'
    __table_args__ = (
        UniqueConstraint('allocation_id', 'role', name='uq_allocation_components_alloc_role'),
    )
    id = Column(Integer, primary_key=True, autoincrement=True)
    allocation_id = Column(Integer, ForeignKey('subject_allocations.id'), nullable=False)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    role = Column(Enum(AllocationRoleEnum), nullable=False)
    theory_hours = Column(Integer, default=0)
    practical_hours = Column(Integer, default=0)
    
    allocation = relationship("SubjectAllocation", back_populates="components")
    faculty = relationship("FacultyProfile")

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    action = Column(String, nullable=False)
    target_entity = Column(String, nullable=False)
    target_id = Column(Integer, nullable=True)
    details = Column(String, nullable=True)

class PolicyConfig(Base):
    __tablename__ = 'policy_config'
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, nullable=False, unique=True)
    scope = Column(String, nullable=False)
    value = Column(String, nullable=False)

class WorkloadVersion(Base):
    __tablename__ = 'workload_versions'
    id = Column(Integer, primary_key=True, autoincrement=True)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    version_no = Column(Integer, nullable=False)
    snapshot_json = Column(String, nullable=False) # Store the JSON payload
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class FacultyCycleState(Base):
    __tablename__ = 'faculty_cycle_states'
    id = Column(Integer, primary_key=True, autoincrement=True)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    state = Column(String, nullable=False) # PENDING, ALLOCATED, NO_TEACHING
    reason = Column(String, nullable=True)

