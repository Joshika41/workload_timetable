# Open Decisions and Pending Rules (Phase A -> B)

The following architectural and business-logic rules remain intentionally unresolved in Phase A and must be addressed in subsequent phases. Phase A was executed strictly based on existing documentation; where rules were missing or ambiguous, no institutional assumptions were invented.

## 1. Institutional Authentication / SSO
- **Current State**: JWT local strategy with hardcoded test seeds (`drx@srm.edu`, `hod@srm.edu`).
- **Open Decision**: What is the final SSO / identity provider for SRM? Does it use SAML, OAuth2, or Google Workspace? How are roles propagated from the central ERP?

## 2. Workload Formulas and Targets
- **Current State**: Total teaching hours are aggregated dynamically from assigned subjects (`theory_hours` + `practical_hours`). The "18-hour universal target" has been dropped as requested.
- **Open Decision**: What are the exact workload formulas for different faculty designations (Professor, Assistant Professor, etc.)? Are there specific minimums/maximums or varying targets based on administrative roles?

## 3. Main / Assistant / IN-2 Crediting Rules
- **Current State**: A `SubjectAllocation` maps multiple `AllocationComponent` records (MAIN, ASSISTANT, IN2). The MAIN role currently inherits `theory_hours`, while ASSISTANT inherits `practical_hours` dynamically based on the subject's requirements.
- **Open Decision**: How exactly are IN-2 roles credited for workload? Does an ASSISTANT sharing a practical lab receive 100% of the practical hours or are they split? 

## 4. Elective / Language Synchronization Model
- **Current State**: The system handles standard theory/practical subjects tied directly to a `Section`.
- **Open Decision**: How are cross-section electives and language subjects synchronized? Does an elective belong to a "virtual section"? 

## 5. Room Capacity / Equipment / Suitability Rules
- **Current State**: Not implemented (Timetable bounds).
- **Open Decision**: How do we map allocations to physical rooms? What are the constraints for lab equipment suitability versus student count?

## 6. Faculty Availability and Leave Rules
- **Current State**: Faculty workload only sums assigned hours.
- **Open Decision**: How are faculty leaves (CL, OD, ML) integrated into workload and timetable generation? Does a faculty member with an administrative exemption have their maximum available hours reduced?

## 7. Timetable Constraints (Hard/Soft)
- **Current State**: Phase A covers the allocation matrix. Timetable generation is deferred.
- **Open Decision**: What are the explicit hard constraints (e.g., no overlapping classes for the same faculty) versus soft constraints (e.g., preferred morning classes, maximum consecutive hours)?

## 8. Publishing, Locking, and Revision Policy
- **Current State**: HOD can transition an allocation to `FINALIZED`.
- **Open Decision**: Once finalized, what is the revision policy? Can a finalized matrix be unlocked? Is there a formal publish step to notify faculty and students, and does it require higher-level administrative approval?

## 9. Advanced Versioning Requirements
- **Current State**: Only the current state of preferences and allocations is stored.
- **Open Decision**: Do we need to retain historical snapshots of the allocation matrix (e.g., V1, V2, V3) for auditing purposes? 

## 10. External ERP / Notification Integrations
- **Current State**: Standalone system.
- **Open Decision**: How does this module integrate with existing notification services (Email/SMS) for preference deadlines, approval notifications, and final timetable publishing?
