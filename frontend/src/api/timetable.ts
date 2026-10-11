export const timetableApi = {
    generateTimetable: async (workspaceId: string) => {
        const res = await fetch(`http://localhost:8000/api/timetable/generate/${workspaceId}`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to generate timetable');
        return await res.json();
    },
    getTimetable: async (workspaceId: string, versionId?: number) => {
        const url = versionId 
            ? `http://localhost:8000/api/timetable/workspace/${workspaceId}?version_id=${versionId}`
            : `http://localhost:8000/api/timetable/workspace/${workspaceId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to get timetable');
        return await res.json();
    },
    getVersions: async (workspaceId: string) => {
        const res = await fetch(`http://localhost:8000/api/timetable/versions/${workspaceId}`);
        if (!res.ok) throw new Error('Failed to fetch versions');
        return await res.json();
    },
    publishVersion: async (versionId: number) => {
        const res = await fetch(`http://localhost:8000/api/timetable/publish/${versionId}`, {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to publish version');
        return await res.json();
    }
}
