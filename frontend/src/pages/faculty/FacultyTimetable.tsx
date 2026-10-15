import React, { useState, useEffect } from 'react';
import { timetableApi, IS_DEMO_MODE } from '@/api/timetable';
import { TimetableEntry } from '@/types/timetable';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

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

export default function FacultyTimetable() {
  const { session } = useAuth();
  const ctx = session?.context;

  const [loading, setLoading] = useState(false);
  const [semesterType, setSemesterType] = useState<'ODD' | 'EVEN'>(
    (ctx?.semesterType as 'ODD' | 'EVEN') || 'ODD'
  );

  // In demo mode, faculty can toggle which faculty identity to preview
  const demoFacultyList = [
    { name: 'Dr. C. Sathish Kumar', role: 'Associate Professor' },
    { name: 'Dr. R. Renuga Devi', role: 'Professor & HOD' },
    { name: 'Dr. R. Sivasankari', role: 'Assistant Professor' },
    { name: 'Dr. K. Kalaiselvi', role: 'Professor & HOD' },
    { name: 'Dr. J. Dhilipan', role: 'Professor & Vice Principal' },
    { name: 'Dr. K. Kottaisamy', role: 'Assistant Professor' },
  ];

  const [selectedDemoFaculty, setSelectedDemoFaculty] = useState<string>(
    session?.name && demoFacultyList.some((f) => f.name.toLowerCase().includes(session.name.toLowerCase()))
      ? demoFacultyList.find((f) => f.name.toLowerCase().includes(session.name.toLowerCase()))!.name
      : 'Dr. C. Sathish Kumar'
  );

  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  useEffect(() => {
    const loadFacultySchedule = async () => {
      setLoading(true);
      try {
        const data = await timetableApi.getTimetable('FLABS-MCA-SEM', undefined, { semesterType });
        // Filter strictly from the shared canonical timetable dataset for this faculty member
        const myEntries = (data.entries || []).filter((e) =>
          e.faculty.toLowerCase().includes(selectedDemoFaculty.toLowerCase())
        );
        setEntries(myEntries);
      } catch (e) {
        toast.error('Failed to load faculty timetable');
      } finally {
        setLoading(false);
      }
    };
    loadFacultySchedule();
  }, [selectedDemoFaculty, semesterType]);

  // Build Day -> Period grid
  const grid: Record<number, Record<number, TimetableEntry>> = {};
  DAYS.forEach((d) => {
    grid[d.key] = {};
  });

  entries.forEach((entry) => {
    if (grid[entry.day_index]) {
      grid[entry.day_index][entry.period_number] = entry;
    }
  });

  // Calculate total scheduled hours for this faculty member
  const totalHours = entries.reduce((acc, e) => acc + (e.duration || 1), 0);
  const theoryHours = entries
    .filter((e) => e.teaching_type === 'THEORY')
    .reduce((acc, e) => acc + (e.duration || 1), 0);
  const labHours = entries
    .filter((e) => e.teaching_type === 'LAB')
    .reduce((acc, e) => acc + (e.duration || 1), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. PERSISTENT DEMO-MODE BANNER */}
      {IS_DEMO_MODE && (
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
                Displaying deterministic sample teaching schedule. Derived from the shared class schedule
                fixture without backend writes.
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

      {/* 2. HEADER & FACULTY IDENTITY CONTROLS */}
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
                My Teaching Timetable
              </h2>
              <span
                className="chip"
                style={{
                  background: semesterType === 'ODD' ? '#EFF6FF' : '#F0FDF4',
                  color: semesterType === 'ODD' ? '#1D4ED8' : '#15803D',
                  fontWeight: 700,
                }}
              >
                {semesterType} Term ({semesterType === 'ODD' ? 'Sem 1' : 'Sem 2'})
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', margin: 0 }}>
              Individual teaching schedule for academic year {ctx?.academicYear || '2026-27'}.
            </p>
          </div>

          {/* Quick Summary Pill */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              background: '#F8FAFC',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Theory: </span>
              <strong style={{ color: '#1D4ED8' }}>{theoryHours}h</strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Lab: </span>
              <strong style={{ color: '#15803D' }}>{labHours}h</strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total: </span>
              <strong style={{ color: '#002147' }}>{totalHours}h / week</strong>
            </div>
          </div>
        </div>

        {/* Toolbar: Term toggle & Demo Faculty preview selector */}
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
          {/* Term Toggle */}
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

          {/* Demo Faculty Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
              Preview Faculty Schedule:
            </span>
            <select
              value={selectedDemoFaculty}
              onChange={(e) => setSelectedDemoFaculty(e.target.value)}
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
              {demoFacultyList.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name} ({f.role})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. TIMETABLE GRID */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
          <div style={{ fontWeight: 700 }}>Loading Personal Schedule...</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>☕</div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>No Teaching Sessions</h3>
          <p style={{ fontSize: '13px' }}>
            {selectedDemoFaculty} has no scheduled teaching slots in the {semesterType} semester fixture.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
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
              <span style={{ fontSize: '18px' }}>📅</span>
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>
                Weekly Teaching Grid — {selectedDemoFaculty}
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
              {entries.length} Assigned Blocks · {totalHours} Scheduled Hours
            </span>
          </div>

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

                    {PERIOD_COLUMNS.map((col) => {
                      if (col.isBreak) {
                        return (
                          <td
                            key="break-cell"
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

                      const entry = grid[day.key]?.[col.num];

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

                      return (
                        <td
                          key={col.num}
                          style={{
                            padding: '6px',
                            borderRight: '1px solid #E2E8F0',
                            verticalAlign: 'top',
                            background: isLab ? '#F0FDF4' : '#EFF6FF',
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
                              border: `1px solid ${isLab ? '#86EFAC' : '#93C5FD'}`,
                              background: 'white',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                            }}
                          >
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
                                  color: isLab ? '#15803D' : '#1D4ED8',
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
                                  background: isLab ? '#DCFCE7' : '#DBEAFE',
                                  color: isLab ? '#166534' : '#1E40AF',
                                }}
                              >
                                {isLab ? `LAB (${entry.duration}P)` : 'THEORY'}
                              </span>
                            </div>

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
                              <span style={{ fontWeight: 700, color: '#002147' }}>
                                👥 {entry.sections.join(', ')}
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
      )}
    </div>
  );
}
