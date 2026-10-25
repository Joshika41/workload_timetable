"""
Teaching Session Builder Service.

Transforms finalized workload allocations into canonical TeachingSession records
for the timetable generation engine and KAIROS solver.

Enforces:
1. Strict workflow gating: workspace must be in FINALIZED state with an active WorkloadVersion.
2. Read-only consumption of SubjectAllocation & AllocationComponent models.
3. Separation of Theory (1-period units) vs Practical/Lab (2-period consecutive blocks).
4. Full referential scope integrity (institution, department, programme, semester, section, subject, faculty).
5. Idempotent preparation: replaces existing active sessions for the workspace version cleanly in a single transaction.
6. Zero mutation to any workload tables.
"""

from typing import List, Dict, Any, Optional
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.domain import (
    AcademicWorkspace,
    WorkspaceWorkflowStateEnum,
    WorkloadVersion,
    SubjectAllocation,
    AllocationComponent,
    AllocationStatusEnum,
    Section,
    Subject,
    FacultyProfile,
    Institution,
    Department,
    CurriculumOffering
)
from app.models.timetable import TeachingSession, SynchronizedGroup, SynchronizedGroupMember


class TeachingSessionBuildError(Exception):
    """Raised when teaching session validation fails."""
    pass


class TeachingSessionBuilder:
    """Service responsible for synthesizing TeachingSession rows from approved workload allocations."""

    def __init__(self, db: Session):
        self.db = db

    def build_sessions_for_workspace(self, workspace_id: str) -> List[TeachingSession]:
        """
        Validates the workspace state and converts finalized subject allocations
        into canonical TeachingSession records.

        Returns the list of generated TeachingSession instances.
        """
        # 1. Load and validate the workspace
        ws = self.db.query(AcademicWorkspace).filter(AcademicWorkspace.id == workspace_id).first()
        if not ws:
            raise TeachingSessionBuildError(f"Workspace '{workspace_id}' not found.")

        # 2. Gate check: Workflow state must be FINALIZED
        if ws.workflow_state != WorkspaceWorkflowStateEnum.FINALIZED:
            raise TeachingSessionBuildError(
                f"Workspace '{workspace_id}' is in '{ws.workflow_state.value if hasattr(ws.workflow_state, 'value') else ws.workflow_state}' "
                f"state. Only FINALIZED workspaces can be prepared for timetabling."
            )

        # 3. Gate check: Must have at least one WorkloadVersion
        latest_version = (
            self.db.query(WorkloadVersion)
            .filter(WorkloadVersion.workspace_id == workspace_id)
            .order_by(WorkloadVersion.version_no.desc())
            .first()
        )
        if not latest_version:
            raise TeachingSessionBuildError(
                f"Workspace '{workspace_id}' is marked FINALIZED but has no active WorkloadVersion snapshot."
            )

        # 4. Resolve Institution ID from Department
        dept = self.db.query(Department).filter(Department.id == ws.department_id).first()
        if not dept or not dept.institution_id:
            raise TeachingSessionBuildError(
                f"Workspace '{workspace_id}' department {ws.department_id} is missing institution association."
            )
        institution_id = dept.institution_id

        # 5. Fetch approved subject allocations strictly for this workspace
        allocations = (
            self.db.query(SubjectAllocation)
            .filter(
                SubjectAllocation.workspace_id == workspace_id,
                SubjectAllocation.status == AllocationStatusEnum.FINALIZED
            )
            .all()
        )

        if not allocations:
            # Check if any allocations exist in other statuses to give an actionable error
            any_allocs = self.db.query(SubjectAllocation).filter(SubjectAllocation.workspace_id == workspace_id).count()
            if any_allocs > 0:
                raise TeachingSessionBuildError(
                    f"Workspace '{workspace_id}' has allocations, but none are in FINALIZED status."
                )
            raise TeachingSessionBuildError(
                f"Workspace '{workspace_id}' has no subject allocations to schedule."
            )

        # 6. Synthesize TeachingSession records
        new_sessions: List[TeachingSession] = []

        for alloc in allocations:
            # Section check
            if not alloc.section_id:
                raise TeachingSessionBuildError(
                    f"Subject allocation ID {alloc.id} is missing a section_id."
                )
            section = self.db.query(Section).filter(Section.id == alloc.section_id).first()
            if not section:
                raise TeachingSessionBuildError(
                    f"Section ID {alloc.section_id} referenced by allocation {alloc.id} does not exist."
                )
            if section.workspace_id != workspace_id:
                raise TeachingSessionBuildError(
                    f"Section ID {alloc.section_id} belongs to workspace '{section.workspace_id}', "
                    f"not '{workspace_id}'. Cross-workspace leakage detected."
                )

            # Subject check
            if not alloc.subject_id:
                raise TeachingSessionBuildError(
                    f"Subject allocation ID {alloc.id} is missing a subject_id."
                )
            subject = self.db.query(Subject).filter(Subject.id == alloc.subject_id).first()
            if not subject:
                raise TeachingSessionBuildError(
                    f"Subject ID {alloc.subject_id} referenced by allocation {alloc.id} does not exist."
                )

            # Curriculum Offering lookup
            offering = (
                self.db.query(CurriculumOffering)
                .filter(
                    CurriculumOffering.programme_id == ws.programme_id,
                    CurriculumOffering.subject_id == alloc.subject_id,
                    CurriculumOffering.semester == (ws.semester.semester_number if ws.semester else None)
                )
                .first()
            )
            curriculum_offering_id = offering.id if offering else None

            # Component check
            components = (
                self.db.query(AllocationComponent)
                .filter(AllocationComponent.allocation_id == alloc.id)
                .all()
            )
            if not components:
                raise TeachingSessionBuildError(
                    f"Subject allocation ID {alloc.id} for course '{subject.course_code}' has no allocation components."
                )

            seq_idx = 1
            for comp in components:
                # Faculty check
                if not comp.faculty_id:
                    raise TeachingSessionBuildError(
                        f"Allocation component ID {comp.id} on allocation {alloc.id} is missing faculty_id."
                    )
                faculty = self.db.query(FacultyProfile).filter(FacultyProfile.id == comp.faculty_id).first()
                if not faculty:
                    raise TeachingSessionBuildError(
                        f"Faculty ID {comp.faculty_id} on component {comp.id} does not exist."
                    )

                role_str = comp.role.value if hasattr(comp.role, 'value') else str(comp.role)

                # Theory Sessions: 1 period each
                for _ in range(comp.theory_hours or 0):
                    session_rec = TeachingSession(
                        allocation_id=alloc.id,
                        institution_id=institution_id,
                        workspace_id=workspace_id,
                        programme_id=ws.programme_id,
                        section_id=alloc.section_id,
                        curriculum_offering_id=curriculum_offering_id,
                        subject_id=alloc.subject_id,
                        faculty_id=comp.faculty_id,
                        allocation_role=role_str,
                        teaching_type="THEORY",
                        duration_in_periods=1,
                        session_sequence=seq_idx,
                        source="FINALIZED_ALLOCATION",
                        status="ACTIVE"
                    )
                    new_sessions.append(session_rec)
                    seq_idx += 1

                # Practical/Lab Sessions: Enforce 2 consecutive periods per lab block
                p_hours = comp.practical_hours or 0
                if p_hours > 0:
                    lab_blocks = p_hours // 2
                    remainder = p_hours % 2

                    for _ in range(lab_blocks):
                        session_rec = TeachingSession(
                            allocation_id=alloc.id,
                            institution_id=institution_id,
                            workspace_id=workspace_id,
                            programme_id=ws.programme_id,
                            section_id=alloc.section_id,
                            curriculum_offering_id=curriculum_offering_id,
                            subject_id=alloc.subject_id,
                            faculty_id=comp.faculty_id,
                            allocation_role=role_str,
                            teaching_type="LAB",
                            duration_in_periods=2,
                            session_sequence=seq_idx,
                            source="FINALIZED_ALLOCATION",
                            status="ACTIVE"
                        )
                        new_sessions.append(session_rec)
                        seq_idx += 1

                    if remainder > 0:
                        session_rec = TeachingSession(
                            allocation_id=alloc.id,
                            institution_id=institution_id,
                            workspace_id=workspace_id,
                            programme_id=ws.programme_id,
                            section_id=alloc.section_id,
                            curriculum_offering_id=curriculum_offering_id,
                            subject_id=alloc.subject_id,
                            faculty_id=comp.faculty_id,
                            allocation_role=role_str,
                            teaching_type="LAB",
                            duration_in_periods=remainder,
                            session_sequence=seq_idx,
                            source="FINALIZED_ALLOCATION",
                            status="ACTIVE"
                        )
                        new_sessions.append(session_rec)
                        seq_idx += 1

        # 7. Identify Elective / Specialized courses and link into SynchronizedGroups
        # When a section has multiple elective subjects with the same duration, group them.
        # Lab components must not be synchronized across >2 electives in parallel as physical lab rooms are limited.
        elective_sessions_by_sec = defaultdict(list)
        for s in new_sessions:
            if s.teaching_type != "THEORY":
                continue
            subj = self.db.query(Subject).filter(Subject.id == s.subject_id).first()
            if subj and subj.category in ["ELECTIVE", "MINOR", "CDC", "MULTIDISCIPLINARY"]:
                elective_sessions_by_sec[(s.section_id, s.duration_in_periods, s.session_sequence)].append(s)

        for (sec_id, dur, seq), group in elective_sessions_by_sec.items():
            if len(group) > 1:
                # Create a synchronized group record
                sync_grp = SynchronizedGroup(
                    group_type="ELECTIVE",
                    description=f"Parallel Elective Block for Section {sec_id} Sequence {seq}"
                )
                self.db.add(sync_grp)
                self.db.flush()
                for grp_sess in group:
                    grp_sess.synchronization_group_id = sync_grp.id

        # 8. Persistence with idempotency in a single transaction
        try:
            # Check if any existing sessions are already locked in timetable runs or entries
            from app.models.timetable import TimetableEntry
            existing_sessions = (
                self.db.query(TeachingSession)
                .filter(TeachingSession.workspace_id == workspace_id)
                .all()
            )
            existing_session_ids = [es.id for es in existing_sessions]

            if existing_session_ids:
                referenced_entry = (
                    self.db.query(TimetableEntry)
                    .filter(TimetableEntry.teaching_session_id.in_(existing_session_ids))
                    .first()
                )
                if referenced_entry:
                    # Sessions already synthesized and referenced by a version; return existing active sessions
                    return existing_sessions

                for es in existing_sessions:
                    self.db.delete(es)
                self.db.flush()

            # Add newly synthesized sessions
            self.db.add_all(new_sessions)
            self.db.commit()

            return new_sessions

        except Exception as e:
            self.db.rollback()
            raise TeachingSessionBuildError(f"Persistence transaction failed: {e}") from e
