# SRM RAMAPURAM WORKLOAD ERP — TIMETABLE PHASE AUDIT & STATUS REPORT

**Document ID:** `TIMETABLE-PHASE-STATUS-2026-10-15`  
**Repository:** `Joshika41/workload_timetable`  
**Author / Engine:** Antigravity AI Engineering  
**System Status:** Frontend Demo Mode Active · Database Timetable Schema Verified · Solver Engine Tested  

---

## 1. Executive Summary

This document provides a comprehensive assessment of the **Timetable Generation & Management Phase** within the SRM Ramapuram Workload ERP system. 

The project has achieved a major milestone by establishing a **Frontend-First Architecture**:
1. **Frontend UI & Interactive Experience:** Complete, polished, and currently running in an **Explicit Demo Mode**. Both Department HODs and Faculty members can view, filter, and inspect weekly class timetables, break periods, contiguous laboratory sessions, synchronized electives, and course reference tables without dependency on unfinalized backend records.
2. **Database Schemas:** All 16 relational timetable tables physically exist in the production **Supabase PostgreSQL** database under Alembic migration head `360cc1ea70ea`.
3. **Solver Engine (KAIROS):** The CP-SAT constraint solver engine has been modified, tested, and validated against complex academic constraints (synchronized multi-section electives, mixed-section seminars, and hard laboratory room matching).
4. **Current Engineering Gap:** The connection bridge between live finalized workload allocations in Supabase PostgreSQL and the KAIROS solver pipeline has not yet been executed. The backend solver prototype currently operates on an isolated SQLite database (`simulation.db`).

---

## 2. Architecture & Data Flow Overview

```
                                  +---------------------------------------+
                                  |         REACT FRONTEND (Vite)         |
                                  |   - HOD Class Schedule & Controls     |
                                  |   - Faculty "My Timetable" Grid       |
                                  +---------------------------------------+
                                                      |
                          +---------------------------+---------------------------+
                          |                                                       |
                          v [Current Milestone: DEMO MODE]                        v [Upcoming Live Mode]
         +----------------------------------+                   +----------------------------------+
         |     timetableMock.ts Provider    |                   |       Axios apiClient (/api)     |
         |  - Deterministic ODD/EVEN Fixture|                   |  - Bearer Token Auth             |
         |  - Multi-section Class Grids     |                   +----------------------------------+
         |  - Multi-period Lab Blocks       |                                     |
         |  - Course Reference Summaries    |                                     v
         +----------------------------------+                   +----------------------------------+
                                                                |          FASTAPI BACKEND         |
                                                                |  - Workload & Allocations Service|
                                                                |  - KAIROS Solver Pipeline        |
                                                                +----------------------------------+
                                                                          |              |
                                              +---------------------------+              +---------------------------+
                                              |                                                                      |
                                              v [Current Engine Test Bed]                                            v [Production Target]
                             +----------------------------------+                                   +----------------------------------+
                             |       SQLite (simulation.db)     |                                   |       Supabase PostgreSQL        |
                             |  - 100 Solved Mock Entries       |                                   |  - 16 Timetable Tables (Ready)   |
                             |  - 18 Teaching Sessions          |                                   |  - 46 Academic Workspaces        |
                             |  - Isolated Test Runs            |                                   |  - 0 Timetable Records (Empty)   |
                             +----------------------------------+                                   +----------------------------------+
```

---

## 3. Database & Schema Status Breakdown

### 3.1. Supabase PostgreSQL (Production DB)

A read-only query of the live Supabase PostgreSQL instance (`aws-0-ap-northeast-2.pooler.supabase.com`) reveals the following table verification status:

| Table Name | Schema Exists | Live Records | Purpose / Description |
| :--- | :---: | :---: | :--- |
| `timetable_configurations` | **YES** | 0 | Department/workspace working day and period configuration |
| `timetable_shifts` | **YES** | 0 | Shift definitions (e.g., Morning Shift I, Afternoon Shift II) |
| `timetable_working_days` | **YES** | 0 | Active weekly instructional days (Monday through Friday) |
| `timetable_periods` | **YES** | 0 | Bell schedule slots (P1–P6, start/end timestamps) |
| `timetable_breaks` | **YES** | 0 | Protected break periods (10:15 – 10:30 morning break) |
| `timetable_rooms` | **YES** | 0 | Physical classrooms, computer labs, and seminar halls |
| `timetable_faculty_availability` | **YES** | 0 | Faculty blackout and unviability rules |
| `timetable_section_availability` | **YES** | 0 | Section blackout times |
| `timetable_room_availability` | **YES** | 0 | Room blackout or shared reservation rules |
| `synchronized_groups` | **YES** | 0 | Multi-section synchronous elective and seminar groups |
| `synchronized_group_members` | **YES** | 0 | Mappings between teaching sessions and sync groups |
| `teaching_sessions` | **YES** | 0 | Discrete schedulable blocks (Theory = 1 period, Lab = 2/3 periods) |
| `timetable_constraints` | **YES** | 0 | Configurable institutional hard and soft rules |
| `timetable_runs` | **YES** | 0 | Execution audit logs for KAIROS solver instances |
| `timetable_versions` | **YES** | 0 | Timetable versions (`DRAFT`, `PUBLISHED`, `SUPERSEDED`) |
| `timetable_entries` | **YES** | 0 | Assigned grid slots: `(day_index, period, room_id, session_id)` |

> [!NOTE]
> **Key Finding:** The database schema is 100% prepared. No new migrations are required. The tables are simply waiting for finalized workload allocations to be converted into `teaching_sessions`.

### 3.2. SQLite (`simulation.db`)

An auxiliary database file exists at `backend/simulation.db`. It was created specifically to test the KAIROS constraint solver during Phase 9 development without risking modifications to live academic data.
- **Contents:** 18 Teaching Sessions, 4 Rooms, 3 Sections, 5 Solver Runs, and 100 Timetable Entries.
- **Isolation Status:** The frontend has been deliberately unlinked from this database so that test artifacts are not mistaken for real university schedules.

---

## 4. Frontend Implementation Status

The frontend application has been upgraded with an enterprise-grade UI:

### 4.1. Explicit Demo Mode
- **Persistent Header Banner:** A high-contrast warning banner is displayed across all timetable views:  
  `DEMO TIMETABLE — ILLUSTRATIVE DATA, NOT LIVE UNIVERSITY DATA`
- **Zero Faux Backend Calls:** The application will never falsely claim that a live database transaction succeeded or silently mask an API error with demo data.

### 4.2. HOD Class Timetable Portal (`/hod/workspace/:workspaceId/timetable`)
- **Context Filtering:** HODs can toggle between:
  - **ODD Semester (Sem 1)** and **EVEN Semester (Sem 2)**
  - Class Sections: **All Sections**, **Section A**, or **Section B**
  - Version history snapshots
- **6-Period Bell Schedule Grid:**
  - `Period 1`: 08:00 – 08:45
  - `Period 2`: 08:45 – 09:30
  - `Period 3`: 09:30 – 10:15
  - `PROTECTED BREAK`: 10:15 – 10:30 (Occupies a distinct amber column; no teaching blocks can be scheduled here)
  - `Period 4`: 10:30 – 11:15
  - `Period 5`: 11:15 – 12:00
  - `Period 6`: 12:00 – 12:45
- **Multi-Period Lab Blocks:** Laboratories display as contiguous multi-period blocks (e.g., P4 + P5 on Monday or P1 + P2 on Wednesday) highlighted in emerald green.
- **Synchronous Electives:** Sections taking electives simultaneously are rendered in distinctive violet sync badges with shared room assignments.
- **Course-Reference Table:** Rendered directly beneath the grid, displaying Course Category (`CORE`, `LAB`, `ALLIED`, `ELECTIVE`), Code, Name, Faculty, Department, Credits, T/P Hours, and Allotted Hours, with a verified aggregate footer.

### 4.3. Faculty "My Timetable" Portal (`/faculty/timetable`)
- **Direct Sidebar Navigation:** A dedicated `📅 My Timetable` link is now mounted in the Faculty portal sidebar.
- **Personalized Teaching View:** Shows only the teaching blocks assigned to the specific faculty member, along with weekly hour metrics (`Total Hours`, `Theory Hours`, `Lab Hours`).
- **Interactive Faculty Preview:** Allows reviewing schedules across multiple faculty members (e.g., Dr. C. Sathish Kumar, Dr. R. Renuga Devi, Dr. K. Kalaiselvi, Dr. J. Dhilipan).

---

## 5. Solver Engine (KAIROS) Status

The core solver engine is located in `backend/vendor/KAIROS` using Google OR-Tools CP-SAT. The following customizations have been verified:

1. **Room & Section Unavailability Constraints:** Support for blackouts where rooms or sections cannot be scheduled.
2. **Contiguous Start Slot Restrictions:** Multi-period laboratory sessions cannot begin in slots that overlap the morning break (P3) or the end of the instructional day (P6).
3. **Synchronized Blocks (`synchronized_blocks`):** Indicator variable equality constraints (`model.Add(base_sum == other_sum)`) guarantee that parallel elective sections start on the exact same day and period.
4. **ERP Validator:** Built-in validation checks room capacity against combined section enrollments and ensures theory classes are not placed into computer labs.

---

## 6. Exact Blockers Preventing Live End-to-End Scheduling

Before the live solver can run against Supabase PostgreSQL, the following workflow requirements must be completed:

```
[1. Preference Submissions] ➔ [2. HOD Workload Allocation] ➔ [3. Finalize Department] ➔ [4. Generate Timetable]
           (DONE)                         (DONE)                       (PENDING)                  (BLOCKED)
```

1. **Unfinalized Allocations:** The department workspaces in Supabase PostgreSQL are currently in `PREFERENCES` / `ALLOCATED` state. Workload finalization must occur before scheduling.
2. **Zero Student Strengths:** Section records in Supabase PostgreSQL currently list `student_strength = 0`. The room assignment logic requires positive student counts to ensure classrooms are not overfilled.
3. **Missing Room Master Records:** Physical classrooms (`LH-301`, `CS-LAB-1`, etc.) must be registered in the `timetable_rooms` table in Supabase PostgreSQL.
4. **Teaching Session Conversion:** Workload allocation hours (e.g., 4 Theory + 2 Lab) must be decomposed into schedulable session objects (e.g., four 1-hour sessions + one 2-hour lab block).

---

## 7. Recommended Next Steps

To transition from the current **Frontend Demo Mode** to **Live Production Scheduling**:

| Step | Task | Target Location | Description |
| :---: | :--- | :--- | :--- |
| **1** | **Master Data Seeding** | Supabase PG | Seed official room capacities, bell periods, and working days into Supabase PostgreSQL. |
| **2** | **Workload Finalization** | Backend Router | Trigger HOD Department Finalization to lock allocations. |
| **3** | **Session Generator Service** | Backend Service | Create an automated service that converts finalized `SubjectAllocation` rows into `teaching_sessions`. |
| **4** | **Re-point Timetable Router** | Backend Router | Update `backend/app/routers/timetable.py` to use `get_db()` (Supabase PG) instead of `get_sim_db()` (`simulation.db`). |
| **5** | **Switch Frontend to Live Mode** | Frontend Env | Set `VITE_TIMETABLE_MODE=live` to connect the UI directly to the Supabase-backed API endpoints. |

---

*Report generated and archived for repository documentation.*
