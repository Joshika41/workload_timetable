import React, { useState, useEffect } from 'react';
import { timetableApi, IS_DEMO_MODE } from '@/api/timetable';
import { TimetableEntry, CourseReferenceItem, TimetableVersionInfo } from '@/types/timetable';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface HODTimetableProps {
  workspaceId: string;
}

const DAYS = [
  { key: 0, label: 'Monday', short: 'Mon' },
  { key: 1, label: 'Tuesday', short: 'Tue' },
  { key: 2, label: 'Wednesday', short: 'Wed' },
  { key: 3, label: 'Thursday', short: 'Thu' },
  { key: 4, label: 'Friday', short: 'Fri' },
];

const PERIOD_COLUMNS = [
  { num: 1, label: 'Period 1', time: '08:00 - 08:45' },
  { num: 2, label: 'Period 2', time: '08:45 - 09:30' },
  { num: 3, label: 'Period 3', time: '09:30 - 10:15' },
  { num: -1, label: 'BREAK', time: '10:15 - 10:30', isBreak: true },
  { num: 4, label: 'Period 4', time: '10:30 - 11:15' },
  { num: 5, label: 'Period 5', time: '11:15 - 12:00' },
  { num: 6, label: 'Period 6', time: '12:00 - 12:45' },
];

export default function HODTimetable({ workspaceId }: HODTimetableProps) {
  const { session } = useAuth();
  const ctx = session?.context;

  // Selected filters
  const [semesterType, setSemesterType] = useState<'ODD' | 'EVEN'>(
    (ctx?.semesterType as 'ODD' | 'EVEN') || 'ODD'
  );
  const [selectedSection, setSelectedSection] = useState<string>('All');
  const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>(undefined);

  // Data states
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [courseRefs, setCourseRefs] = useState<CourseReferenceItem[]>([]);
  const [versions, setVersions] = useState<TimetableVersionInfo[]>([]);
  const [timetableMeta, setTimetableMeta] = useState<any>(null);

  // Action states
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [demoBannerDismissed, setDemoBannerDismissed] = useState(false);

  // Available sections in fixture
  const availableSections = ['All', 'Section A', 'Section B'];

  const loadTimetableData = async (targetVersionId?: number) => {
    setLoading(true);
    try {
      const [versionsData, ttData] = await Promise.all([
        timetableApi.getVersions(workspaceId),
        timetableApi.getTimetable(workspaceId, targetVersionId, {
          semesterType,
          section: selectedSection === 'All' ? undefined : selectedSection,
        }),
      ]);
      setVersions(versionsData);
      setEntries(ttData.entries || []);
      setCourseRefs(ttData.course_references || []);
      setTimetableMeta(ttData);
      if (ttData.version_id) {
        setSelectedVersionId(ttData.version_id);
      }
    } catch (e: any) {
      toast.error('Failed to load timetable data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetableData(selectedVersionId);
  }, [workspaceId, semesterType, selectedSection]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await timetableApi.generateTimetable(workspaceId);
      toast.success(res.message || 'Demo timetable loaded successfully!');
      await loadTimetableData(res.version_id);
    } catch (e: any) {
      toast.error(e?.message || 'Generation action failed');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedVersionId) return;
    setPublishing(true);
    try {
      await timetableApi.publishVersion(selectedVersionId);
      toast.success('Version published (Demo demonstration only — no backend write)');
      await loadTimetableData(selectedVersionId);
    } catch (e: any) {
      toast.error('Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  // Group entries by Section -> Day -> Period
  const activeSectionsToRender =
    selectedSection === 'All' ? ['Section A', 'Section B'] : [selectedSection];

  const sectionGrids: Record<string, Record<number, Record<number, TimetableEntry>>> = {};
  activeSectionsToRender.forEach((sec) => {
    sectionGrids[sec] = {};
    DAYS.forEach((d) => {
      sectionGrids[sec][d.key] = {};
    });
  });

  entries.forEach((entry) => {
    entry.sections.forEach((sec) => {
      if (sectionGrids[sec] && sectionGrids[sec][entry.day_index] !== undefined) {
        sectionGrids[sec][entry.day_index][entry.period_number] = entry;
      }
    });
  });

  // Calculate Course Reference Totals
  const totalCredits = courseRefs.reduce((acc, c) => acc + (c.credits || 0), 0);
  const totalTheoryHours = courseRefs.reduce((acc, c) => acc + (c.theory_hours || 0), 0);
  const totalPracticalHours = courseRefs.reduce((acc, c) => acc + (c.practical_hours || 0), 0);
  const totalAllottedHours = courseRefs.reduce((acc, c) => acc + (c.allotted_hours || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. PERSISTENT DEMO-MODE BANNER */}
      {IS_DEMO_MODE && !demoBannerDismissed && (
        <div
          style={{
            background: 'linear-gradient(135deg, #1E293B, #0F172A)',
            borderLeft: '5px solid #F59E0B',
            borderRadius: '10px',
            padding: '14px 20px',
            color: '#F8FAFC',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#FBBF24',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                DEMO TIMETABLE — ILLUSTRATIVE DATA, NOT LIVE UNIVERSITY DATA
              </div>
              <div style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '2px' }}>
                Frontend foundation preview with deterministic schedules. No SQLite simulation or
                backend database endpoints are invoked.
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#FDE68A',
              borderRadius: '20px',
              fontWeight: 700,
              border: '1px solid rgba(245, 158, 11, 0.4)',
              whiteSpace: 'nowrap',
            }}
          >
            DEMO MODE ACTIVE
          </span>
        </div>
      )}

      {/* 2. HEADER & CONTROLS CARD */}
      <div className="card" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid #E2E8F0',
            paddingBottom: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#002147', margin: 0 }}>
                Class Timetable Schedule
              </h2>
              <span
                className="chip"
                style={{
                  background: semesterType === 'ODD' ? '#EFF6FF' : '#F0FDF4',
                  color: semesterType === 'ODD' ? '#1D4ED8' : '#15803D',
                  fontWeight: 700,
                }}
              >
                {semesterType} Semester
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
              {ctx?.programmeName || 'Master of Computer Applications (MCA)'} · Academic Year{' '}
              {ctx?.academicYear || '2026-27'} · {ctx?.departmentName}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating}
              style={{
                background: '#002147',
                borderColor: '#002147',
                fontWeight: 700,
                padding: '8px 16px',
              }}
            >
              {generating ? 'Simulating...' : '⚡ Load Demo Timetable'}
            </button>

            {timetableMeta && (
              <button
                className="btn btn-secondary"
                onClick={handlePublish}
                disabled={publishing || generating}
                style={{
                  background: '#ECFDF5',
                  color: '#065F46',
                  borderColor: '#A7F3D0',
                  fontWeight: 700,
                  padding: '8px 16px',
                }}
                title="Illustrative client-only publish demo"
              >
                {publishing ? 'Publishing...' : '✓ Demo Publish'}
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            flexWrap: 'wrap',
            background: '#F8FAFC',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
          }}
        >
          {/* Semester Type Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Term:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setSemesterType('ODD')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: semesterType === 'ODD' ? '#002147' : '#CBD5E1',
                  background: semesterType === 'ODD' ? '#002147' : 'white',
                  color: semesterType === 'ODD' ? 'white' : '#475569',
                  cursor: 'pointer',
                }}
              >
                ODD (Sem 1)
              </button>
              <button
                onClick={() => setSemesterType('EVEN')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid',
                  borderColor: semesterType === 'EVEN' ? '#002147' : '#CBD5E1',
                  background: semesterType === 'EVEN' ? '#002147' : 'white',
                  color: semesterType === 'EVEN' ? 'white' : '#475569',
                  cursor: 'pointer',
                }}
              >
                EVEN (Sem 2)
              </button>
            </div>
          </div>

          {/* Section Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Section:</span>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                fontWeight: 600,
                color: '#0F172A',
                background: 'white',
              }}
            >
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec === 'All' ? 'All Sections' : sec}
                </option>
              ))}
            </select>
          </div>

          {/* Version Selection */}
          {versions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Version:</span>
              <select
                value={selectedVersionId || versions[0]?.id}
                onChange={(e) => {
                  const vid = Number(e.target.value);
                  setSelectedVersionId(vid);
                  loadTimetableData(vid);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#0F172A',
                  background: 'white',
                }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.id} ({v.status}) — {new Date(v.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. TIMETABLE GRIDS */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
          <div style={{ fontWeight: 700 }}>Loading Timetable Data...</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📅</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>No Timetable Available</h3>
          <p style={{ fontSize: '13px' }}>
            Click "Load Demo Timetable" above to view the illustrative schedule.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {activeSectionsToRender.map((sectionName) => (
            <div key={sectionName} className="card" style={{ padding: '0', overflow: 'hidden' }}>
              {/* Section Header */}
              <div
                style={{
                  background: '#002147',
                  padding: '14px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>👥</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>
                    Class Schedule — {sectionName}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.9)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                    }}
                  >
                    6 Periods / Day + Break
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#C9A84C',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {semesterType} Term ({semesterType === 'ODD' ? 'Sem 1' : 'Sem 2'})
                </span>
              </div>

              {/* Table Container */}
              <div style={{ overflowX: 'auto' }}>
                <table
                  className="erp-table"
                  style={{
                    width: '100%',
                    minWidth: '850px',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th
                        style={{
                          width: '100px',
                          textAlign: 'center',
                          color: '#0F172A',
                          fontWeight: 800,
                          fontSize: '12px',
                          borderRight: '2px solid #E2E8F0',
                          padding: '10px',
                        }}
                      >
                        DAY
                      </th>
                      {PERIOD_COLUMNS.map((col) => (
                        <th
                          key={col.num}
                          style={{
                            textAlign: 'center',
                            padding: '8px 4px',
                            background: col.isBreak ? '#FEF3C7' : '#F8FAFC',
                            width: col.isBreak ? '75px' : 'auto',
                            borderRight: '1px solid #E2E8F0',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 800,
                              color: col.isBreak ? '#B45309' : '#0F172A',
                            }}
                          >
                            {col.label}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: col.isBreak ? '#92400E' : '#64748B',
                              fontWeight: 600,
                              marginTop: '2px',
                            }}
                          >
                            {col.time}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => (
                      <tr key={day.key} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        {/* Day Label */}
                        <td
                          style={{
                            fontWeight: 800,
                            color: '#002147',
                            textAlign: 'center',
                            background: '#F8FAFC',
                            borderRight: '2px solid #E2E8F0',
                            fontSize: '13px',
                          }}
                        >
                          {day.label}
                        </td>

                        {/* Period Columns */}
                        {PERIOD_COLUMNS.map((col) => {
                          // Protected BREAK column between P3 and P4
                          if (col.isBreak) {
                            return (
                              <td
                                key="break-col"
                                style={{
                                  background: 'rgba(245, 158, 11, 0.08)',
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  borderRight: '1px solid #E2E8F0',
                                  padding: '4px',
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: '10px',
                                    color: '#B45309',
                                    fontWeight: 800,
                                    letterSpacing: '1.5px',
                                    writingMode: 'vertical-rl',
                                    textOrientation: 'upright',
                                    margin: 'auto',
                                  }}
                                >
                                  BREAK
                                </div>
                              </td>
                            );
                          }

                          const entry = sectionGrids[sectionName]?.[day.key]?.[col.num];

                          if (!entry) {
                            return (
                              <td
                                key={col.num}
                                style={{
                                  borderRight: '1px solid #E2E8F0',
                                  background: 'white',
                                }}
                              />
                            );
                          }

                          const isLab = entry.teaching_type === 'LAB';
                          const isSync = entry.is_synchronized;

                          return (
                            <td
                              key={col.num}
                              style={{
                                padding: '6px',
                                borderRight: '1px solid #E2E8F0',
                                verticalAlign: 'top',
                                background: isLab ? '#F0FDF4' : isSync ? '#FDF4FF' : '#F8FAFC',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '3px',
                                  minHeight: '68px',
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: `1px solid ${
                                    isLab ? '#86EFAC' : isSync ? '#F0ABFC' : '#CBD5E1'
                                  }`,
                                  background: 'white',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                }}
                              >
                                {/* Header: Subject Code & Type badge */}
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      color: isLab ? '#15803D' : isSync ? '#86198F' : '#1D4ED8',
                                    }}
                                  >
                                    {entry.subject_code}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: isLab
                                        ? '#DCFCE7'
                                        : isSync
                                        ? '#FAE8FF'
                                        : '#F1F5F9',
                                      color: isLab ? '#166534' : isSync ? '#701A75' : '#475569',
                                    }}
                                  >
                                    {isLab ? `LAB (${entry.duration}P)` : isSync ? 'SYNC ELECTIVE' : 'THEORY'}
                                  </span>
                                </div>

                                {/* Subject Name */}
                                <div
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: '#0F172A',
                                    lineHeight: 1.25,
                                    maxHeight: '28px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                  title={entry.subject}
                                >
                                  {entry.subject}
                                </div>

                                {/* Faculty & Room */}
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '10px',
                                    color: '#64748B',
                                    fontWeight: 600,
                                    marginTop: 'auto',
                                  }}
                                >
                                  <span
                                    style={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      maxWidth: '100px',
                                    }}
                                    title={entry.faculty}
                                  >
                                    👤 {entry.faculty}
                                  </span>
                                  <span style={{ fontWeight: 700, color: '#334155' }}>
                                    📍 {entry.room}
                                  </span>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. COURSE-REFERENCE TABLE BENEATH CLASS TIMETABLE */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div
          style={{
            background: '#F8FAFC',
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#002147', margin: 0 }}>
              Course Reference Table
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
              Allotted credits, teaching faculty, and scheduled hours for this semester context.
            </p>
          </div>
          <span
            style={{
              fontSize: '11px',
              padding: '4px 10px',
              background: '#E2E8F0',
              color: '#334155',
              borderRadius: '6px',
              fontWeight: 700,
            }}
          >
            {courseRefs.length} Courses Offered
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#475569' }}>
                  CATEGORY
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#475569' }}>
                  COURSE CODE
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#475569' }}>
                  COURSE NAME
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#475569' }}>
                  FACULTY MEMBER
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '11px', color: '#475569' }}>
                  DEPARTMENT
                </th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '11px', color: '#475569' }}>
                  CREDITS
                </th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '11px', color: '#475569' }}>
                  T / P HOURS
                </th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '11px', color: '#475569' }}>
                  ALLOTTED
                </th>
              </tr>
            </thead>
            <tbody>
              {courseRefs.map((course, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #E2E8F0',
                    background: idx % 2 === 0 ? 'white' : '#FAFAFA',
                  }}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background:
                          course.category === 'LAB'
                            ? '#DCFCE7'
                            : course.category === 'ELECTIVE'
                            ? '#FAE8FF'
                            : '#EFF6FF',
                        color:
                          course.category === 'LAB'
                            ? '#166534'
                            : course.category === 'ELECTIVE'
                            ? '#701A75'
                            : '#1D4ED8',
                      }}
                    >
                      {course.category}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: '#002147', fontSize: '12px' }}>
                    {course.course_code}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0F172A', fontSize: '12px' }}>
                    {course.course_name}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '12px', color: '#334155', fontWeight: 600 }}>
                    {course.faculty_name}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '11px', color: '#64748B' }}>
                    {course.department}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#002147' }}>
                    {course.credits}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '12px', color: '#64748B' }}>
                    {course.theory_hours}T + {course.practical_hours}P
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      textAlign: 'center',
                      fontWeight: 800,
                      color: '#059669',
                      fontSize: '13px',
                    }}
                  >
                    {course.allotted_hours}h
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
                <td colSpan={5} style={{ padding: '12px 14px', textAlign: 'right', color: '#002147' }}>
                  Total Scheduled Allocation:
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#002147' }}>
                  {totalCredits} Credits
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748B' }}>
                  {totalTheoryHours}T + {totalPracticalHours}P
                </td>
                <td
                  style={{
                    padding: '12px 14px',
                    textAlign: 'center',
                    color: '#059669',
                    fontSize: '14px',
                  }}
                >
                  {totalAllottedHours} Hours
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
