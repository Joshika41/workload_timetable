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

export const IS_DEMO_MODE = import.meta.env.VITE_TIMETABLE_MODE !== 'live';

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
    // Future live backend path via standard apiClient
    const res = await apiClient.post(`/timetable/generate/${workspaceId}`);
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
};
