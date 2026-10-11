from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, JSON, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .domain import Base

class TimetableStatusEnum(enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    VALIDATING = "VALIDATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class TimetableVersionStatusEnum(enum.Enum):
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    PUBLISHED = "PUBLISHED"
    SUPERSEDED = "SUPERSEDED"

class AvailabilityStatusEnum(enum.Enum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    PREFERRED = "PREFERRED"
    AVOID = "AVOID"

class ConstraintTypeEnum(enum.Enum):
    HARD = "HARD"
    SOFT = "SOFT"
    CONFIGURABLE = "CONFIGURABLE"
    POLICY_PENDING = "POLICY_PENDING"

class TimetableConfiguration(Base):
    __tablename__ = 'timetable_configurations'
    id = Column(Integer, primary_key=True, autoincrement=True)
    institution_id = Column(Integer, ForeignKey('institutions.id'), nullable=False)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    academic_context_id = Column(String, nullable=True) # Could reference Academic Context if exists
    shift_id = Column(Integer, ForeignKey('timetable_shifts.id'), nullable=True)
    academic_year = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    configuration_version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TimetableShift(Base):
    __tablename__ = 'timetable_shifts'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TimetableWorkingDay(Base):
    __tablename__ = 'timetable_working_days'
    id = Column(Integer, primary_key=True, autoincrement=True)
    configuration_id = Column(Integer, ForeignKey('timetable_configurations.id'), nullable=False)
    day_name = Column(String, nullable=False) # Monday, Tuesday...
    day_index = Column(Integer, nullable=False) # 0 to 6
    active = Column(Boolean, default=True)

class TimetablePeriod(Base):
    __tablename__ = 'timetable_periods'
    id = Column(Integer, primary_key=True, autoincrement=True)
    configuration_id = Column(Integer, ForeignKey('timetable_configurations.id'), nullable=False)
    shift_id = Column(Integer, ForeignKey('timetable_shifts.id'), nullable=True)
    period_number = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    active = Column(Boolean, default=True)

class TimetableBreak(Base):
    __tablename__ = 'timetable_breaks'
    id = Column(Integer, primary_key=True, autoincrement=True)
    configuration_id = Column(Integer, ForeignKey('timetable_configurations.id'), nullable=False)
    name = Column(String, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    active = Column(Boolean, default=True)

class TimetableRoom(Base):
    __tablename__ = 'timetable_rooms'
    id = Column(Integer, primary_key=True, autoincrement=True)
    institution_id = Column(Integer, ForeignKey('institutions.id'), nullable=False)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=True)
    room_code = Column(String, nullable=False, unique=True)
    room_name = Column(String, nullable=False)
    building = Column(String, nullable=True)
    floor = Column(String, nullable=True)
    room_type = Column(String, nullable=False) # CLASSROOM, LAB, PC_LAB, STUDIO
    capacity = Column(Integer, nullable=False, default=0)
    lab_classification = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    active = Column(Boolean, default=True)

class TimetableFacultyAvailability(Base):
    __tablename__ = 'timetable_faculty_availability'
    id = Column(Integer, primary_key=True, autoincrement=True)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    configuration_id = Column(Integer, ForeignKey('timetable_configurations.id'), nullable=False)
    day_index = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)
    status = Column(Enum(AvailabilityStatusEnum), default=AvailabilityStatusEnum.AVAILABLE)

class TimetableSectionAvailability(Base):
    __tablename__ = 'timetable_section_availability'
    id = Column(Integer, primary_key=True, autoincrement=True)
    section_id = Column(Integer, ForeignKey('sections.id'), nullable=False)
    configuration_id = Column(Integer, ForeignKey('timetable_configurations.id'), nullable=False)
    day_index = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)
    status = Column(Enum(AvailabilityStatusEnum), default=AvailabilityStatusEnum.AVAILABLE)

class TimetableRoomAvailability(Base):
    __tablename__ = 'timetable_room_availability'
    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey('timetable_rooms.id'), nullable=False)
    configuration_id = Column(Integer, ForeignKey('timetable_configurations.id'), nullable=False)
    day_index = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)
    status = Column(Enum(AvailabilityStatusEnum), default=AvailabilityStatusEnum.AVAILABLE)

class SynchronizedGroup(Base):
    __tablename__ = 'synchronized_groups'
    id = Column(Integer, primary_key=True, autoincrement=True)
    group_type = Column(String, nullable=False) # ELECTIVE, LANGUAGE, MIXED
    description = Column(String, nullable=True)

class SynchronizedGroupMember(Base):
    __tablename__ = 'synchronized_group_members'
    id = Column(Integer, primary_key=True, autoincrement=True)
    synchronized_group_id = Column(Integer, ForeignKey('synchronized_groups.id'), nullable=False)
    teaching_session_id = Column(Integer, ForeignKey('teaching_sessions.id'), nullable=False)
    section_id = Column(Integer, ForeignKey('sections.id'), nullable=True)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=True)

class TeachingSession(Base):
    __tablename__ = 'teaching_sessions'
    id = Column(Integer, primary_key=True, autoincrement=True)
    allocation_id = Column(Integer, ForeignKey('subject_allocations.id'), nullable=False)
    institution_id = Column(Integer, ForeignKey('institutions.id'), nullable=False)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    programme_id = Column(Integer, ForeignKey('programmes.id'), nullable=True)
    academic_context_id = Column(String, nullable=True)
    section_id = Column(Integer, ForeignKey('sections.id'), nullable=False)
    curriculum_offering_id = Column(Integer, ForeignKey('curriculum_offerings.id'), nullable=True)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=True)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    allocation_role = Column(String, nullable=True)
    teaching_type = Column(String, nullable=False) # THEORY, LAB
    duration_in_periods = Column(Integer, nullable=False, default=1)
    session_sequence = Column(Integer, nullable=True)
    synchronization_group_id = Column(Integer, ForeignKey('synchronized_groups.id'), nullable=True)
    source = Column(String, default="FINALIZED_ALLOCATION")
    status = Column(String, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TimetableConstraint(Base):
    __tablename__ = 'timetable_constraints'
    id = Column(Integer, primary_key=True, autoincrement=True)
    constraint_code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    constraint_type = Column(Enum(ConstraintTypeEnum), nullable=False)
    scope = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=1)
    configuration_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class TimetableRun(Base):
    __tablename__ = 'timetable_runs'
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, nullable=False, unique=True)
    workspace_id = Column(String, ForeignKey('academic_workspaces.id'), nullable=False)
    academic_context_id = Column(String, nullable=True)
    shift_id = Column(Integer, ForeignKey('timetable_shifts.id'), nullable=True)
    configuration_id = Column(Integer, ForeignKey('timetable_configurations.id'), nullable=False)
    status = Column(Enum(TimetableStatusEnum), default=TimetableStatusEnum.QUEUED)
    solver_name = Column(String, nullable=True)
    solver_version = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    expected_sessions = Column(Integer, nullable=True)
    scheduled_sessions = Column(Integer, nullable=True)
    hard_violation_count = Column(Integer, default=0)
    soft_score = Column(Integer, nullable=True)
    diagnostics_json = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)

class TimetableVersion(Base):
    __tablename__ = 'timetable_versions'
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey('timetable_runs.id'), nullable=False)
    status = Column(Enum(TimetableVersionStatusEnum), default=TimetableVersionStatusEnum.DRAFT)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TimetableEntry(Base):
    __tablename__ = 'timetable_entries'
    id = Column(Integer, primary_key=True, autoincrement=True)
    timetable_version_id = Column(Integer, ForeignKey('timetable_versions.id', ondelete="RESTRICT"), nullable=False)
    teaching_session_id = Column(Integer, ForeignKey('teaching_sessions.id'), nullable=False)
    faculty_id = Column(Integer, ForeignKey('faculty_profiles.id'), nullable=False)
    section_id = Column(Integer, ForeignKey('sections.id'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=True)
    room_id = Column(Integer, ForeignKey('timetable_rooms.id'), nullable=False)
    day_index = Column(Integer, nullable=False)
    start_period = Column(Integer, nullable=False)
    duration_in_periods = Column(Integer, nullable=False, default=1)
    session_type = Column(String, nullable=False)
    synchronization_group_id = Column(Integer, ForeignKey('synchronized_groups.id'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
