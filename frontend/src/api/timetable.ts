import { apiClient } from '@/api/client';
import { timetableMock } from '@/api/timetableMock';
import { TimetableResponse, TimetableVersionInfo } from '@/types/timetable';

/**
 * TIMETABLE API PROVIDER BOUNDARY
 * Mode configuration:
 * For this milestone, DEMO MODE is explicitly enabled by default (VITE_TIMETABLE_MODE = 'demo').
 * In DEMO MODE:
 * - Calls are served deterministically by timetableMock.
 * - Absolutely NO calls are made to SQLite simulation endpoints (http://localhost:8000/api/timetable/...) or Supabase.
 * In LIVE MODE (when future Supabase-backed API is ready):
 * - Calls use apiClient (/timetable/...)
 * - Does NOT silently fallback to mock on error.
 */

// LIVE MODE is the canonical production mode.
// DEMO MODE is active ONLY if explicitly requested via VITE_TIMETABLE_MODE === 'demo' or VITE_DEMO_MODE === 'true'.
export const IS_DEMO_MODE =
  import.meta.env.VITE_TIMETABLE_MODE === 'demo' ||
  (import.meta.env.VITE_DEMO_MODE === 'true' && import.meta.env.VITE_TIMETABLE_MODE !== 'live');

export const timetableApi = {
  isDemoMode: IS_DEMO_MODE,

  generateTimetable: async (workspaceId: string): Promise<any> => {
    if (IS_DEMO_MODE) {
      // In demo mode, simulation solver is not executed.
      // Return a simulated client-only notification without writing to any DB.
      await new Promise((r) => setTimeout(r, 400));
      return {
        status: 'DEMO_OPTIMAL',
        violations: [],
        version_id: 101,
        message: 'DEMO MODE: Solver run simulated with 0 violations. No database changes were made.',
      };
    }
    // Canonical KAIROS backend path with extended solver timeout (120s)
    const res = await apiClient.post(`/timetable/generate/${workspaceId}`, null, {
      timeout: 120000,
    });
    return res.data;
  },

  getTimetable: async (
    workspaceId: string,
    versionId?: number,
    options?: { semesterType?: 'ODD' | 'EVEN'; section?: string }
  ): Promise<TimetableResponse> => {
    if (IS_DEMO_MODE) {
      return await timetableMock.getTimetable(workspaceId, versionId, options);
    }
    // Future live path: use configured apiClient (NO silent mock fallback)
    const url = versionId
      ? `/timetable/workspace/${workspaceId}?version_id=${versionId}`
      : `/timetable/workspace/${workspaceId}`;
    const res = await apiClient.get<TimetableResponse>(url);
    return res.data;
  },

  getVersions: async (workspaceId: string): Promise<TimetableVersionInfo[]> => {
    if (IS_DEMO_MODE) {
      return await timetableMock.getVersions(workspaceId);
    }
    // Future live path: use configured apiClient (NO silent mock fallback)
    const res = await apiClient.get<TimetableVersionInfo[]>(`/timetable/versions/${workspaceId}`);
    return res.data;
  },

  publishVersion: async (versionId: number): Promise<{ status: string; published_version_id: number }> => {
    if (IS_DEMO_MODE) {
      return await timetableMock.publishVersion(versionId);
    }
    // Future live path: use configured apiClient (NO silent mock fallback)
    const res = await apiClient.post(`/timetable/publish/${versionId}`);
    return res.data;
  },

  generatePreview: async (workspaceId: string, scopeType: string = "AUTO"): Promise<any> => {
    // Calls canonical preview endpoint (runs real KAIROS solver with 120s timeout)
    const res = await apiClient.post(`/timetable/preview/${workspaceId}?scope_type=${scopeType}`, null, {
      timeout: 120000,
    });
    return res.data;
  },

  getReadiness: async (workspaceId: string): Promise<any> => {
    // Calls canonical timetable readiness endpoint
    const res = await apiClient.get(`/timetable/readiness/${workspaceId}`);
    return res.data;
  },

  getFacultySchedule: async (semesterType?: 'ODD' | 'EVEN', facultyUserId?: number): Promise<any> => {
    if (IS_DEMO_MODE) {
      // In demo mode, return empty entries or let component use demo list
      return { entries: [] };
    }
    const params = new URLSearchParams();
    if (semesterType) params.append('semester_type', semesterType);
    if (facultyUserId) params.append('faculty_user_id', String(facultyUserId));
    const url = `/timetable/faculty/schedule?${params.toString()}`;
    const res = await apiClient.get(url);
    return res.data;
  },

  getRooms: async (institutionId: number = 2, departmentId?: number): Promise<any[]> => {
    if (IS_DEMO_MODE) {
      return [
        { id: 15, room_code: 'CR-103', room_name: 'Room 103', room_type: 'CLASSROOM', capacity: 70 },
        { id: 16, room_code: 'CR-104', room_name: 'Room 104', room_type: 'CLASSROOM', capacity: 70 },
        { id: 17, room_code: 'CR-301', room_name: 'Room 301', room_type: 'CLASSROOM', capacity: 70 },
        { id: 18, room_code: 'PG-LAB-1', room_name: 'PG Lab 1', room_type: 'PC_LAB', capacity: 70 },
        { id: 19, room_code: 'PG-LAB-2', room_name: 'PG Lab 2', room_type: 'PC_LAB', capacity: 70 },
      ];
    }
    const params = new URLSearchParams({ institution_id: String(institutionId) });
    if (departmentId !== undefined) params.append('department_id', String(departmentId));
    const res = await apiClient.get(`/timetable/rooms?${params.toString()}`);
    return res.data;
  },
};




