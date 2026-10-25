import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { academicApi } from '@/api/index';
import { timetableApi, IS_DEMO_MODE } from '@/api/timetable';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { exportTimetableToPdf } from '@/lib/timetablePdfExport';

interface SubjectItem {
  offering_id: number;
  subject_id: number;
  course_code: string;
  course_name: string;
  category_key: string;
  category_label: string;
  course_type: string;
  theory_hours: number;
  practical_hours: number;
  total_hours: number;
  credits: number;
  semester: number;
  semester_type: string;
  is_offered: boolean;
  programme_year: number;
}

interface CapacityState {
  total_classrooms: number;
  classroom_capacity: number;
  total_labs: number;
  lab_capacity: number;
}

interface TimetableSlot {
  id: string;
  day: string;
  period: number;
  time: string;
  course_code: string;
  course_name: string;
  course_short: string;
  category: string;
  course_type: string;
  room: string;
  faculty_name: string;
  shift: string;
  section: string;
  is_lab: boolean;
}

const PERIOD_TIMINGS = [
  { period: 1, time: "08:30 - 09:20" },
  { period: 2, time: "09:25 - 10:15" },
  { period: 3, time: "10:30 - 11:20" },
  { period: 4, time: "11:25 - 12:15" },
  { period: 5, time: "01:00 - 01:50" },
  { period: 6, time: "01:55 - 02:45" },
];

const WEEK_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const AVAILABLE_ROOMS = [
  "Room 1", "Room 2", "4th Floor Lab", "Room 1 (Lab)", "Room 200", "Room 204", "Room 205", "Room 304", "Room 305", "BMS Lab"
];

const MCA_FACULTY = [
  "Dr K Kalaiselvi", "Dr S.Umarani", "Dr. R. Agusthiyar", "Dr K.Kottaisamy", 
  "Dr R. Sivasankari", "Dr. D. Kanchana", "Dr. M. Divya", "Dr. M. Sakthi Asvini", 
  "Dr. N. Krishnamoorthy", "Dr. S. Meenakshi"
];

export default function HODSubjects() {
  const { session } = useAuth();
  const deptId = session?.context?.departmentId || 5;

  // Capacity Form State
  const [capacity, setCapacity] = useState<CapacityState>({
    total_classrooms: 6,
    classroom_capacity: 60,
    total_labs: 4,
    lab_capacity: 35,
  });
  const [isLoadingCapacity, setIsLoadingCapacity] = useState(true);
  const [isSavingCapacity, setIsSavingCapacity] = useState(false);

  // Curriculum Subjects State
  const [programmeInfo, setProgrammeInfo] = useState<{
    programme_id: number;
    programme_name: string;
    department_name: string;
    programme_type: string;
  } | null>(null);

  const [availableSemesters, setAvailableSemesters] = useState<number[]>([1, 2, 3, 4]);
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [availableSections, setAvailableSections] = useState<string[]>(['A', 'B']);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isSavingOfferings, setIsSavingOfferings] = useState(false);

  // Weekly Timetable State
  const [weeklyTimetable, setWeeklyTimetable] = useState<TimetableSlot[]>([]);
  const [isTimetableLoaded, setIsTimetableLoaded] = useState(false);
  const [isGeneratingTimetable, setIsGeneratingTimetable] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isSavingTimetable, setIsSavingTimetable] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('MONDAY');
  const [timetableRoom, setTimetableRoom] = useState<string>('CR-103');
  const [canonicalRooms, setCanonicalRooms] = useState<string[]>([]);
  const [timetableSection, setTimetableSection] = useState<string>('A');
  const [timetableFormat, setTimetableFormat] = useState<'SHEET' | 'MATRIX'>('SHEET');
  const [previewDisclaimer, setPreviewDisclaimer] = useState<string | null>(null);
  const [previewBlockers, setPreviewBlockers] = useState<string[]>([]);
  const [isProvisionalPreview, setIsProvisionalPreview] = useState<boolean>(false);

  // Swap Mode State
  const [isSwapMode, setIsSwapMode] = useState<boolean>(false);
  const [swapSelectedSlot, setSwapSelectedSlot] = useState<TimetableSlot | null>(null);

  // Edit Slot Modal State
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [editFormData, setEditFormData] = useState({
    course_code: '',
    course_name: '',
    room: 'CR-103',
    faculty_name: 'Dr K Kalaiselvi',
  });

  // Load Verified Canonical Rooms for this Department
  useEffect(() => {
    timetableApi.getRooms(2, deptId)
      .then((roomsData: any[]) => {
        if (roomsData && roomsData.length > 0) {
          const roomCodes = roomsData.map(r => r.room_code);
          setCanonicalRooms(roomCodes);
          if (roomCodes.length > 0) {
            setTimetableRoom(roomCodes[0]);
            setEditFormData(prev => ({ ...prev, room: roomCodes[0] }));
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load canonical rooms:", err);
      });
  }, [deptId]);

  // Load Capacity on mount
  useEffect(() => {
    if (deptId) {
      setIsLoadingCapacity(true);
      academicApi.getDepartmentCapacity(deptId)
        .then(data => {
          if (data) {
            setCapacity({
              total_classrooms: data.total_classrooms ?? 6,
              classroom_capacity: data.classroom_capacity ?? 60,
              total_labs: data.total_labs ?? 4,
              lab_capacity: data.lab_capacity ?? 35,
            });
          }
        })
        .catch(err => {
          console.error("Failed to load department capacity:", err);
        })
        .finally(() => setIsLoadingCapacity(false));
    }
  }, [deptId]);

  // Load Curriculum Subjects for Programme / Department
  const fetchCurriculum = (sem?: number) => {
    setIsLoadingSubjects(true);
    academicApi.getCurriculumSubjects(deptId, undefined, sem)
      .then(res => {
        if (res) {
          setProgrammeInfo({
            programme_id: res.programme_id,
            programme_name: res.programme_name,
            department_name: res.department_name,
            programme_type: res.programme_type,
          });
          if (res.semesters && res.semesters.length > 0) {
            setAvailableSemesters(res.semesters);
          }
          if (res.sections && res.sections.length > 0) {
            setAvailableSections(res.sections);
            if (!res.sections.includes(timetableSection)) {
              setTimetableSection(res.sections[0]);
            }
          }
          setSubjects(res.subjects || []);
        }
      })
      .catch(err => {
        console.error("Failed to load curriculum subjects:", err);
        toast.error("Failed to load curriculum subjects.");
      })
      .finally(() => setIsLoadingSubjects(false));
  };

  useEffect(() => {
    fetchCurriculum(selectedSemester);
  }, [deptId, selectedSemester]);

  // Load Weekly Timetable if already generated
  useEffect(() => {
    if (programmeInfo?.programme_id) {
      academicApi.getWeeklyTimetable(programmeInfo.programme_id, selectedSemester, timetableSection)
        .then(res => {
          if (res && res.exists && res.schedule?.length > 0) {
            setWeeklyTimetable(res.schedule);
            setIsTimetableLoaded(true);
          } else {
            setWeeklyTimetable([]);
            setIsTimetableLoaded(false);
          }
        })
        .catch(err => {
          console.error("Failed to fetch weekly timetable:", err);
        });
    }
  }, [programmeInfo?.programme_id, selectedSemester, timetableSection]);

  // Save Capacity
  const handleSaveCapacity = async () => {
    setIsSavingCapacity(true);
    try {
      await academicApi.saveDepartmentCapacity({
        department_id: deptId,
        total_classrooms: Number(capacity.total_classrooms),
        classroom_capacity: Number(capacity.classroom_capacity),
        total_labs: Number(capacity.total_labs),
        lab_capacity: Number(capacity.lab_capacity),
      });
      toast.success("Department Infrastructure & Seating Capacity updated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to save seating capacity.");
    } finally {
      setIsSavingCapacity(false);
    }
  };

  // Toggle individual course
  const handleToggleCourse = (offeringId: number) => {
    setSubjects(prev =>
      prev.map(s => (s.offering_id === offeringId ? { ...s, is_offered: !s.is_offered } : s))
    );
  };

  // Batch toggle all in current view
  const handleSelectAll = (selectState: boolean) => {
    setSubjects(prev => prev.map(s => ({ ...s, is_offered: selectState })));
  };

  // Save Course Offerings for this semester
  const handleSaveOfferings = async () => {
    if (!programmeInfo) return;
    setIsSavingOfferings(true);
    try {
      const selectedOfferingIds = subjects
        .filter(s => s.is_offered)
        .map(s => s.offering_id);

      await academicApi.batchUpdateCurriculumSubjects(
        programmeInfo.programme_id,
        selectedSemester,
        selectedOfferingIds
      );
      toast.success(`Semester ${selectedSemester} course offerings saved successfully (${selectedOfferingIds.length} courses active for timetable)!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.detail || "Failed to save course offerings.");
    } finally {
      setIsSavingOfferings(false);
    }
  };

  // Generate Official Timetable (Canonical KAIROS CP-SAT Solver)
  const handleGenerateOfficialTimetable = async () => {
    if (!programmeInfo) return;
    setIsGeneratingTimetable(true);
    setPreviewBlockers([]);
    setPreviewDisclaimer(null);
    setIsProvisionalPreview(false);
    try {
      const semType = selectedSemester % 2 !== 0 ? 'ODD' : 'EVEN';
      const workspaces = await academicApi.getWorkspacesByContext(programmeInfo.programme_id, semType);
      
      const matchedWs = (workspaces || []).find((w: any) => 
        w.programme_id === programmeInfo.programme_id && 
        (Number(w.semester) === Number(selectedSemester) || Number(w.semester_id) === Number(selectedSemester))
      );

      const targetWorkspaceId = matchedWs?.workspace_id || matchedWs?.id;
      if (!targetWorkspaceId) {
        toast.error(`No academic workspace found for Semester ${selectedSemester} (${semType}).`);
        setPreviewBlockers([`No valid AcademicWorkspace configured for Programme ${programmeInfo.programme_name} Semester ${selectedSemester}.`]);
        return;
      }

      const res = await timetableApi.generateTimetable(targetWorkspaceId);
      toast.success(`Official draft version #${res.version_id} generated via KAIROS CP-SAT (${res.scheduled_sessions} sessions)!`);
      
      // Reload weekly timetable to show persisted canonical entries
      const updated = await academicApi.getWeeklyTimetable(programmeInfo.programme_id, selectedSemester, timetableSection);
      if (updated && updated.schedule) {
        setWeeklyTimetable(updated.schedule);
        setIsTimetableLoaded(true);
      }
      setTimeout(() => {
        const el = document.getElementById('weekly-timetable-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'object' && detail.message ? detail.message : (detail || err.message || "Failed to generate timetable.");
      if (typeof detail === 'object' && detail.preflight_errors) {
        setPreviewBlockers(detail.preflight_errors);
      } else {
        setPreviewBlockers([msg]);
      }
      toast.error(msg);
      setTimeout(() => {
        const el = document.getElementById('preview-blockers-banner');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } finally {
      setIsGeneratingTimetable(false);
    }
  };

  // Generate Provisional Timetable Preview (KAIROS constraint solver pipeline)
  const handleGenerateProvisionalPreview = async () => {
    if (!programmeInfo) return;
    setIsGeneratingPreview(true);
    setPreviewBlockers([]);
    setPreviewDisclaimer(null);
    try {
      // 1. Locate current workspace for this programme and semester
      const semType = selectedSemester % 2 !== 0 ? 'ODD' : 'EVEN';
      const workspaces = await academicApi.getWorkspacesByContext(programmeInfo.programme_id, semType);
      
      const matchedWs = (workspaces || []).find((w: any) => 
        w.programme_id === programmeInfo.programme_id && 
        (Number(w.semester) === Number(selectedSemester) || Number(w.semester_id) === Number(selectedSemester))
      );

      const targetWorkspaceId = matchedWs?.workspace_id || matchedWs?.id;
      if (!targetWorkspaceId) {
        toast.error(`No academic workspace found for Semester ${selectedSemester} (${semType}).`);
        setPreviewBlockers([`No valid AcademicWorkspace configured for Programme ${programmeInfo.programme_name} Semester ${selectedSemester}.`]);
        return;
      }

      // 2. Call provisional preview API
      const res = await timetableApi.generatePreview(targetWorkspaceId);

      if (res.status === 'COMPLETED' && res.preview_entries) {
        // Map KAIROS preview entries into the TimetableSlot format
        const dayNamesUpper = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
        const dayCodes = ["mon", "tue", "wed", "thu", "fri", "sat"];

        const mappedSlots: TimetableSlot[] = res.preview_entries.map((entry: any, idx: number) => {
          const dayName = dayNamesUpper[entry.day_index] || "MONDAY";
          const dayCode = dayCodes[entry.day_index] || "mon";
          const periodNum = entry.start_period;
          const timing = PERIOD_TIMINGS.find(pt => pt.period === periodNum)?.time || "08:00 - 08:45";
          const isLab = entry.teaching_type === "LAB" || (entry.room_code || "").toLowerCase().includes("lab");

          return {
            id: `kairos_preview_${dayCode}_p${periodNum}_${entry.session_id || idx}`,
            day: dayName,
            period: periodNum,
            time: timing,
            course_code: entry.subject_code || "SUBJ",
            course_name: entry.subject_name || "Course",
            course_short: (entry.subject_name || "Course").split(' ').slice(0, 3).join(' '),
            category: "CORE",
            course_type: isLab ? "Practical" : "Theory",
            room: entry.room_code || timetableRoom,
            faculty_name: entry.faculty_name || "Faculty",
            shift: "SH 1",
            section: entry.section || timetableSection,
            is_lab: isLab,
          };
        });

        setWeeklyTimetable(mappedSlots);
        setIsTimetableLoaded(true);
        setIsProvisionalPreview(true);
        setPreviewDisclaimer(res.disclaimer || "PROVISIONAL — CAPACITY NOT VERIFIED");
        toast.success(`KAIROS solver generated provisional timetable preview (${mappedSlots.length} sessions)!`);

        setTimeout(() => {
          const el = document.getElementById('weekly-timetable-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else if (res.status === 'INFEASIBLE') {
        setPreviewBlockers(res.violations || ["Solver could not find a feasible schedule satisfying all constraints."]);
        setIsProvisionalPreview(false);
        toast.error("Provisional timetable preview is INFEASIBLE under current constraints.");
        setTimeout(() => {
          const el = document.getElementById('preview-blockers-banner');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    } catch (err: any) {
      console.error("Provisional preview failed:", err);
      setIsProvisionalPreview(false);
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.blockers) {
        setPreviewBlockers(detail.blockers);
        toast.error(detail.message || "Provisional timetable preview blocked.");
      } else if (typeof detail === 'string') {
        setPreviewBlockers([detail]);
        toast.error(detail);
      } else {
        const msg = err.message || "Failed to generate provisional timetable preview.";
        setPreviewBlockers([msg]);
        toast.error(msg);
      }
      setTimeout(() => {
        const el = document.getElementById('preview-blockers-banner');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Handle Slot Click (Swap or Edit)
  const handleSlotClick = (slot: TimetableSlot) => {
    if (isSwapMode) {
      if (!swapSelectedSlot) {
        setSwapSelectedSlot(slot);
        toast.info(`Selected ${slot.day} Period ${slot.period} (${slot.course_code}). Now click another slot to swap!`);
      } else if (swapSelectedSlot.id === slot.id) {
        setSwapSelectedSlot(null);
        toast.info("Slot deselected.");
      } else {
        // Perform Swap
        const updated = weeklyTimetable.map(s => {
          if (s.id === swapSelectedSlot.id) {
            return {
              ...s,
              course_code: slot.course_code,
              course_name: slot.course_name,
              course_short: slot.course_short,
              category: slot.category,
              course_type: slot.course_type,
              room: slot.room,
              faculty_name: slot.faculty_name,
              is_lab: slot.is_lab,
            };
          }
          if (s.id === slot.id) {
            return {
              ...s,
              course_code: swapSelectedSlot.course_code,
              course_name: swapSelectedSlot.course_name,
              course_short: swapSelectedSlot.course_short,
              category: swapSelectedSlot.category,
              course_type: swapSelectedSlot.course_type,
              room: swapSelectedSlot.room,
              faculty_name: swapSelectedSlot.faculty_name,
              is_lab: swapSelectedSlot.is_lab,
            };
          }
          return s;
        });

        setWeeklyTimetable(updated);
        toast.success(`Swapped ${swapSelectedSlot.day} P${swapSelectedSlot.period} with ${slot.day} P${slot.period}! Click "Save Timetable" to persist.`);
        setSwapSelectedSlot(null);
      }
    } else {
      // Open Edit Modal
      setEditingSlot(slot);
      setEditFormData({
        course_code: slot.course_code,
        course_name: slot.course_name,
        room: slot.room,
        faculty_name: slot.faculty_name,
      });
    }
  };

  // Save Edit Slot Modal
  const handleSaveSlotEdit = () => {
    if (!editingSlot) return;
    const matchingSubject = subjects.find(s => s.course_code === editFormData.course_code);
    const updated = weeklyTimetable.map(s => {
      if (s.id === editingSlot.id) {
        return {
          ...s,
          course_code: editFormData.course_code,
          course_name: matchingSubject ? matchingSubject.course_name : editFormData.course_name,
          course_short: matchingSubject ? matchingSubject.course_name.split(' ').slice(0, 3).join(' ') : editFormData.course_name,
          room: editFormData.room,
          faculty_name: editFormData.faculty_name,
          is_lab: editFormData.room.toLowerCase().includes('lab'),
        };
      }
      return s;
    });

    setWeeklyTimetable(updated);
    setEditingSlot(null);
    toast.success(`Updated ${editingSlot.day} Period ${editingSlot.period}! Click "Save Timetable" to persist.`);
  };

  // Save Full Weekly Timetable to Backend
  const handleSaveWeeklyTimetable = async () => {
    if (!programmeInfo || weeklyTimetable.length === 0) return;
    setIsSavingTimetable(true);
    try {
      await academicApi.saveWeeklyTimetable({
        programme_id: programmeInfo.programme_id,
        semester: selectedSemester,
        department_id: deptId,
        section: timetableSection,
        schedule: weeklyTimetable,
      });
      if (isProvisionalPreview) {
        toast.success(`Weekly timetable changes saved to HOD draft workspace. (Note: Remains PROVISIONAL and does not overwrite official published timetable versions).`);
      } else {
        toast.success(`Weekly timetable changes saved successfully!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save timetable changes.");
    } finally {
      setIsSavingTimetable(false);
    }
  };

  // Group subjects by category
  const categoriesInOrder = [
    { key: 'CORE', label: '📘 Professional Core Courses', note: 'Mandatory core theory & integrated laboratory courses' },
    { key: 'DISCIPLINE_ELECTIVE', label: '📙 Professional / Discipline Electives', note: 'Department specializations (e.g. choose 1 per group)' },
    { key: 'GENERIC_ELECTIVE', label: '📗 Generic / Open Electives', note: 'Interdisciplinary domain electives' },
    { key: 'SKILL_ENHANCEMENT', label: '🔬 Skill Enhancement Courses (SEC)', note: 'Practical application & industry skills' },
    { key: 'ABILITY_ENHANCEMENT', label: '💡 Ability Enhancement Courses (AEC)', note: 'Reasoning, soft skills, and communication' },
    { key: 'PROJECT_INTERNSHIP', label: '🎓 Project Work & Internship', note: 'Capstone projects, industry internships' },
  ];

  const groupedSubjects: Record<string, SubjectItem[]> = {};
  categoriesInOrder.forEach(cat => {
    groupedSubjects[cat.key] = subjects.filter(s => s.category_key === cat.key);
  });

  // Calculate statistics
  const totalCourses = subjects.length;
  const offeredCourses = subjects.filter(s => s.is_offered);
  const totalLHours = offeredCourses.reduce((sum, s) => sum + s.theory_hours, 0);
  const totalPHours = offeredCourses.reduce((sum, s) => sum + s.practical_hours, 0);
  const totalCredits = offeredCourses.reduce((sum, s) => sum + s.credits, 0);

  // Filter timetable slots for currently selected day in Sheet view
  const daySlots = weeklyTimetable.filter(s => s.day === selectedDay).sort((a, b) => a.period - b.period);

  const handleExportPDF = () => {
    if (!weeklyTimetable || weeklyTimetable.length === 0) {
      toast.error("No timetable slots available to export.");
      return;
    }
    try {
      exportTimetableToPdf({
        institutionName: 'SRM INSTITUTE OF SCIENCE AND TECHNOLOGY',
        departmentName: programmeInfo?.department_name || session?.context?.departmentName || 'Department of Computer Science',
        programmeName: programmeInfo?.programme_name || 'B.Sc Computer Science (Hons)',
        semester: selectedSemester,
        section: `Section ${timetableSection}`,
        academicYear: session?.context?.academicYear || '2026-27',
        room: timetableRoom,
        slots: weeklyTimetable,
        periodTimings: PERIOD_TIMINGS,
      });
      toast.success("Timetable PDF downloaded successfully!");
    } catch (e: any) {
      console.error("PDF Export error:", e);
      toast.error("Failed to generate PDF. Falling back to print.");
      window.print();
    }
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '60px' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 className="page-title" style={{ margin: 0 }}>Department Curriculum & Subject Mapping</h2>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(0,33,71,0.08)', color: '#002147' }}>
              Regulations 2025
            </span>
          </div>
          <p className="page-subtitle">
            Configure classrooms, laboratories, tick semester-wise subject offerings, and create automated weekly class timetables.
          </p>
        </div>
      </div>

      {/* TOP SECTION: Classrooms & Labs Seating Capacity */}
      <div className="card" style={{ marginBottom: '28px', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', background: '#FAFCFE', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🏢</span>
            <div>
              <div style={{ fontWeight: 800, color: '#002147', fontSize: '15px' }}>Department Infrastructure & Seating Capacity</div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Used by the timetable algorithm to allocate rooms without capacity bottlenecks
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSaveCapacity}
            disabled={isSavingCapacity || isLoadingCapacity}
            style={{ fontSize: '13px', padding: '8px 18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isSavingCapacity ? '💾 Saving Capacity...' : '💾 Save Infrastructure'}
          </button>
        </div>

        <div className="card-body" style={{ padding: '20px' }}>
          {isLoadingCapacity ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 68, borderRadius: '10px' }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {/* Classroom Count */}
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🏫</span>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Classrooms
                  </label>
                </div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="form-control"
                  value={capacity.total_classrooms}
                  onChange={e => setCapacity({ ...capacity, total_classrooms: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={{ height: '42px', fontSize: '16px', fontWeight: 800, color: '#002147', background: 'white' }}
                />
                <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                  Available lecture rooms
                </span>
              </div>

              {/* Classroom Seating Capacity */}
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🪑</span>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Classroom Capacity
                  </label>
                </div>
                <input
                  type="number"
                  min="10"
                  max="200"
                  className="form-control"
                  value={capacity.classroom_capacity}
                  onChange={e => setCapacity({ ...capacity, classroom_capacity: Math.max(10, parseInt(e.target.value) || 10) })}
                  style={{ height: '42px', fontSize: '16px', fontWeight: 800, color: '#002147', background: 'white' }}
                />
                <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                  Average seats per classroom
                </span>
              </div>

              {/* Total Labs */}
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔬</span>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total Laboratories
                  </label>
                </div>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="form-control"
                  value={capacity.total_labs}
                  onChange={e => setCapacity({ ...capacity, total_labs: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={{ height: '42px', fontSize: '16px', fontWeight: 800, color: '#002147', background: 'white' }}
                />
                <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                  Computer & practical labs
                </span>
              </div>

              {/* Lab Seating Capacity */}
              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>💻</span>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: '#002147', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Lab Workstations / Capacity
                  </label>
                </div>
                <input
                  type="number"
                  min="10"
                  max="120"
                  className="form-control"
                  value={capacity.lab_capacity}
                  onChange={e => setCapacity({ ...capacity, lab_capacity: Math.max(10, parseInt(e.target.value) || 10) })}
                  style={{ height: '42px', fontSize: '16px', fontWeight: 800, color: '#002147', background: 'white' }}
                />
                <span style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', display: 'block' }}>
                  Computer systems per lab
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PROGRAMME & SEMESTER NAVIGATION */}
      <div className="card" style={{ marginBottom: '24px', border: '1px solid #E2E8F0' }}>
        <div style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: '#FAFCFE', borderBottom: '1px solid #F1F5F9' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#C9A84C', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>
              ACADEMIC PROGRAMME
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#002147' }}>
              {programmeInfo?.programme_name || 'Master of Computer Applications (MCA)'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              {programmeInfo?.department_name || 'Department of Postgraduate Computer Applications'} · Regulations 2025
            </div>
          </div>

          {/* Semester Selector Tabs */}
          <div style={{ display: 'flex', background: '#F1F5F9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            {availableSemesters.map(sem => {
              const isOdd = sem % 2 !== 0;
              const isActive = selectedSemester === sem;
              return (
                <button
                  key={sem}
                  onClick={() => setSelectedSemester(sem)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    background: isActive ? '#002147' : 'transparent',
                    color: isActive ? 'white' : '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>Semester {sem}</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                    color: isActive ? 'white' : '#64748B'
                  }}>
                    {isOdd ? 'ODD' : 'EVEN'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls & Summary Ribbon */}
        <div style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', background: 'white' }}>
          {/* Summary metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#16A34A' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                {offeredCourses.length} / {totalCourses}
              </span>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Courses Selected</span>
            </div>

            <div style={{ width: '1px', height: '20px', background: '#E2E8F0' }} />

            <div style={{ fontSize: '13px', color: '#334155' }}>
              <strong style={{ color: '#002147' }}>{totalLHours}</strong> Theory hrs/wk · <strong style={{ color: '#002147' }}>{totalPHours}</strong> Practical hrs/wk
            </div>

            <div style={{ width: '1px', height: '20px', background: '#E2E8F0' }} />

            <div style={{ fontSize: '13px', fontWeight: 700, color: '#C9A84C' }}>
              {totalCredits} Total Credits
            </div>
          </div>

          {/* Batch Buttons & Save Offerings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleSelectAll(true)}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Select All
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleSelectAll(false)}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Deselect All
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSaveOfferings}
              disabled={isSavingOfferings || isLoadingSubjects}
              style={{ fontSize: '13px', padding: '7px 18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSavingOfferings ? '💾 Saving Offerings...' : `💾 Save Semester ${selectedSemester} Offerings`}
            </button>
          </div>
        </div>
      </div>

      {/* SEMESTER TABLES GROUPED BY SYLLABUS CATEGORY */}
      {isLoadingSubjects ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#002147' }}>Loading Semester {selectedSemester} Subjects...</div>
          <div style={{ fontSize: '13px', color: '#64748B' }}>Fetching official MCA Regulations 2025 curriculum mappings.</div>
        </div>
      ) : subjects.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📚</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#002147' }}>No Courses Found for Semester {selectedSemester}</div>
          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Please contact Super Admin to register Master Subjects for this semester.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '28px' }}>
          {categoriesInOrder.map(cat => {
            const list = groupedSubjects[cat.key] || [];
            if (list.length === 0) return null;

            return (
              <div key={cat.key} className="card" style={{ border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{
                  padding: '12px 20px',
                  background: '#F8FAFC',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#002147' }}>
                      {cat.label}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '12px' }}>
                      {cat.note}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#E2E8F0',
                    color: '#334155'
                  }}>
                    {list.filter(s => s.is_offered).length} of {list.length} Offered
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#FDFDFD', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ width: '60px', textAlign: 'center', padding: '10px' }}>OFFER</th>
                        <th style={{ width: '130px', padding: '10px 14px' }}>COURSE CODE</th>
                        <th style={{ padding: '10px 14px' }}>COURSE TITLE</th>
                        <th style={{ width: '150px', padding: '10px 14px' }}>COURSE TYPE</th>
                        <th style={{ width: '70px', textAlign: 'center', padding: '10px' }}>L</th>
                        <th style={{ width: '70px', textAlign: 'center', padding: '10px' }}>P</th>
                        <th style={{ width: '70px', textAlign: 'center', padding: '10px' }}>TOTAL</th>
                        <th style={{ width: '80px', textAlign: 'center', padding: '10px' }}>CREDITS</th>
                        <th style={{ width: '130px', textAlign: 'center', padding: '10px' }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(s => {
                        const isTicked = s.is_offered;
                        return (
                          <tr
                            key={s.offering_id}
                            style={{
                              background: isTicked ? '#FFFFFF' : '#FAFAFA',
                              opacity: isTicked ? 1 : 0.65,
                              transition: 'all 0.15s'
                            }}
                          >
                            {/* Checkbox Tick */}
                            <td style={{ textAlign: 'center', padding: '10px' }}>
                              <input
                                type="checkbox"
                                checked={isTicked}
                                onChange={() => handleToggleCourse(s.offering_id)}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  accentColor: '#002147',
                                }}
                              />
                            </td>

                            {/* Course Code */}
                            <td style={{ padding: '10px 14px', fontWeight: 800, color: '#002147', fontFamily: 'monospace', fontSize: '13px' }}>
                              {s.course_code}
                            </td>

                            {/* Course Title */}
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: isTicked ? '#0F172A' : '#64748B' }}>
                              {s.course_name}
                            </td>

                            {/* Course Type */}
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: s.course_type.includes('Integrated') ? '#EFF6FF' : s.course_type.includes('Practical') ? '#F0FDF4' : '#F8FAFC',
                                color: s.course_type.includes('Integrated') ? '#1D4ED8' : s.course_type.includes('Practical') ? '#15803D' : '#475569',
                                border: '1px solid rgba(0,0,0,0.06)'
                              }}>
                                {s.course_type}
                              </span>
                            </td>

                            {/* L - Theory Hours */}
                            <td style={{ textAlign: 'center', padding: '10px', fontWeight: 700, color: '#334155' }}>
                              {s.theory_hours}
                            </td>

                            {/* P - Practical Hours */}
                            <td style={{ textAlign: 'center', padding: '10px', fontWeight: 700, color: '#334155' }}>
                              {s.practical_hours}
                            </td>

                            {/* Total Hours */}
                            <td style={{ textAlign: 'center', padding: '10px', fontWeight: 800, color: '#002147' }}>
                              {s.total_hours}
                            </td>

                            {/* Credits */}
                            <td style={{ textAlign: 'center', padding: '10px', fontWeight: 800, color: '#C9A84C' }}>
                              {s.credits}
                            </td>

                            {/* Status Badge */}
                            <td style={{ textAlign: 'center', padding: '10px' }}>
                              {isTicked ? (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  background: '#DCFCE7',
                                  color: '#166534',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  ✓ Offered
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  background: '#F1F5F9',
                                  color: '#94A3B8'
                                }}>
                                  Not Offered
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIMETABLE CREATION & EXCEL SCHEDULE SECTION (USER REQUEST)                */}
      {/* ========================================================================= */}
      <div id="weekly-timetable-section" className="card" style={{ border: '1px solid #C9A84C', boxShadow: '0 8px 30px rgba(201,168,76,0.12)', overflow: 'hidden' }}>
        
        {/* Timetable Header Bar */}
        <div style={{
          padding: '18px 24px',
          background: 'linear-gradient(135deg, #002147 0%, #003580 100%)',
          color: 'white',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '22px' }}>📅</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, letterSpacing: '0.2px' }}>
                Weekly Class Timetable (Daily Schedule 2026 Format)
              </h3>
              <span style={{ fontSize: '10px', fontWeight: 800, background: '#C9A84C', color: '#002147', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                {deptId === 5 ? 'SRM PG Block' : (deptId === 1 ? 'SRM Block 5 & BMS' : 'SRM Academic Block')}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>
              Official Timetable Schedule for Section {timetableSection} &middot; Verified {deptId === 5 ? 'PG Block' : (deptId === 1 ? 'Block 5 & BMS' : 'Academic Block')} Classrooms &amp; Labs
            </p>
          </div>

          {/* Action Button: Create Timetable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Room:</label>
              <select
                value={timetableRoom}
                onChange={e => setTimetableRoom(e.target.value)}
                style={{ background: 'transparent', color: 'white', border: 'none', fontWeight: 800, fontSize: '13px', cursor: 'pointer', outline: 'none' }}
              >
                {(canonicalRooms.length > 0 ? canonicalRooms : AVAILABLE_ROOMS).map(r => (
                  <option key={r} value={r} style={{ color: '#0F172A' }}>{r}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Section:</label>
              <select
                value={timetableSection}
                onChange={e => setTimetableSection(e.target.value)}
                style={{ background: 'transparent', color: 'white', border: 'none', fontWeight: 800, fontSize: '13px', cursor: 'pointer', outline: 'none' }}
              >
                {availableSections.map(sec => (
                  <option key={sec} value={sec} style={{ color: '#0F172A' }}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* ONE Authoritative KAIROS Timetable Generator Pipeline */}
            <button
              className="btn btn-secondary"
              onClick={handleGenerateProvisionalPreview}
              disabled={isGeneratingTimetable || isGeneratingPreview}
              title="Runs official KAIROS CP-SAT constraint solver pipeline with provisional room preferences"
              style={{
                background: '#002147',
                color: '#C9A84C',
                border: '1px solid #C9A84C',
                fontWeight: 800,
                fontSize: '13px',
                padding: '10px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,33,71,0.3)',
                cursor: 'pointer'
              }}
            >
              {isGeneratingPreview ? '⏳ Solving with KAIROS...' : '🔬 Run KAIROS Preview'}
            </button>

            <button
              className="btn btn-primary"
              onClick={handleGenerateOfficialTimetable}
              disabled={isGeneratingTimetable || isGeneratingPreview}
              title="Executes KAIROS CP-SAT solver, assigns PG Block / Block 5 rooms, verifies 0 clashes, and persists official draft version"
              style={{
                background: '#047857',
                color: 'white',
                border: '1px solid #059669',
                fontWeight: 800,
                fontSize: '13px',
                padding: '10px 18px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(4,120,87,0.3)',
                cursor: 'pointer'
              }}
            >
              {isGeneratingTimetable ? '⏳ Solving & Persisting...' : '🚀 Generate Official Timetable'}
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleExportPDF}
              title="Download official timetable PDF with institution header and matrix"
              style={{
                background: '#F1F5F9',
                color: '#002147',
                border: '1px solid #CBD5E1',
                fontWeight: 800,
                fontSize: '13px',
                padding: '10px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                cursor: 'pointer'
              }}
            >
              <span>📄</span>
              <span>Export Timetable as PDF</span>
            </button>
          </div>
        </div>

        {/* Timetable Sub-Bar: View Toggle & Controls */}
        {isTimetableLoaded && (
          <div style={{
            padding: '12px 24px',
            background: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            {/* View Mode Toggle: Day Sheets vs Full Matrix */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Format:</span>
              <div style={{ display: 'flex', background: '#E2E8F0', borderRadius: '8px', padding: '3px' }}>
                <button
                  onClick={() => setTimetableFormat('SHEET')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: timetableFormat === 'SHEET' ? '#002147' : 'transparent',
                    color: timetableFormat === 'SHEET' ? 'white' : '#64748B'
                  }}
                >
                  📑 Day Sheets (Excel Format)
                </button>
                <button
                  onClick={() => setTimetableFormat('MATRIX')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    background: timetableFormat === 'MATRIX' ? '#002147' : 'transparent',
                    color: timetableFormat === 'MATRIX' ? 'white' : '#64748B'
                  }}
                >
                  📅 Full Week Matrix
                </button>
              </div>
            </div>

            {/* Swap Mode Toggle, Save Button & Export PDF Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => {
                  setIsSwapMode(!isSwapMode);
                  setSwapSelectedSlot(null);
                  if (!isSwapMode) {
                    toast.info("Swap Mode Activated: Click any slot, then click another slot to swap them instantly!");
                  }
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: isSwapMode ? '2px solid #C9A84C' : '1px solid #CBD5E1',
                  background: isSwapMode ? 'rgba(201,168,76,0.15)' : 'white',
                  color: isSwapMode ? '#854D0E' : '#334155',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>🔄</span>
                <span>{isSwapMode ? 'Swap Mode: ON (Click 2 Slots)' : 'Enable Swap Mode'}</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSaveWeeklyTimetable}
                disabled={isSavingTimetable}
                style={{ fontSize: '12px', padding: '7px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isSavingTimetable ? '💾 Saving...' : '💾 Save Timetable'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleExportPDF}
                title="Download official timetable PDF with institution header and matrix"
                style={{
                  background: '#F8FAFC',
                  color: '#002147',
                  border: '1px solid #CBD5E1',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <span>📄</span>
                <span>Export as PDF</span>
              </button>
            </div>
          </div>
        )}

        {/* Timetable Content Body */}
        <div style={{ padding: '24px' }}>
          {/* Actionable Blockers Banner */}
          {previewBlockers.length > 0 && (
            <div id="preview-blockers-banner" style={{
              marginBottom: '20px',
              padding: '16px 20px',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '10px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={20} color="#DC2626" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 800, color: '#991B1B' }}>
                  Provisional Timetable Generation Blocked
                </h4>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#B91C1C' }}>
                  The KAIROS solver requires verified academic inputs before generation. Please address the following blockers:
                </p>
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#7F1D1D' }}>
                  {previewBlockers.map((b, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Provisional Disclaimer Banner */}
          {isTimetableLoaded && isProvisionalPreview && (
            <div style={{
              marginBottom: '16px',
              padding: '12px 18px',
              background: '#EFF6FF',
              border: '1px solid #93C5FD',
              borderRadius: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Info size={18} color="#2563EB" />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1E40AF', letterSpacing: '0.3px' }}>
                  {previewDisclaimer || "PROVISIONAL — CAPACITY NOT VERIFIED"}
                </span>
                <span style={{ fontSize: '11px', color: '#3B82F6', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Non-Publishable Draft
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Generated using KAIROS constraint solver · Soft Block 5/PG preferences
              </span>
            </div>
          )}

          {!isTimetableLoaded ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: '#FAFCFE', borderRadius: '12px', border: '1px dashed #CBD5E1' }}>
              <div style={{ fontSize: '42px', marginBottom: '12px' }}>📊</div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 800, color: '#002147' }}>
                No Timetable Created Yet for Semester {selectedSemester}
              </h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748B', maxWidth: '540px', marginLeft: 'auto', marginRight: 'auto' }}>
                Tick the subjects you want to offer above, then click <strong>"Create Timetable"</strong> for quick scheduling, or click <strong>"Generate Timetable Preview"</strong> to run the full KAIROS constraint solver.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateOfficialTimetable}
                  disabled={isGeneratingTimetable || isGeneratingPreview}
                  style={{ background: '#002147', fontWeight: 700, fontSize: '14px', padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <span>⚡</span>
                  <span>{isGeneratingTimetable ? 'Solving & Persisting...' : 'Generate Official Timetable Now'}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerateProvisionalPreview}
                  disabled={isGeneratingTimetable || isGeneratingPreview}
                  style={{ background: '#C9A84C', color: '#002147', border: 'none', fontWeight: 800, fontSize: '14px', padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <span>🔬</span>
                  <span>{isGeneratingPreview ? 'Solving with KAIROS...' : 'Generate Timetable Preview'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* If Swap Mode Active, show instruction banner */}
              {isSwapMode && (
                <div style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  background: 'rgba(201,168,76,0.15)',
                  border: '1px solid #C9A84C',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🔄</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#854D0E' }}>
                      {swapSelectedSlot
                        ? `First slot selected: ${swapSelectedSlot.day} Period ${swapSelectedSlot.period} (${swapSelectedSlot.course_code}). Now click the second slot to swap.`
                        : 'Swap Mode Active: Click any slot to select it, then click another slot to swap classes.'}
                    </span>
                  </div>
                  {swapSelectedSlot && (
                    <button
                      onClick={() => setSwapSelectedSlot(null)}
                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', background: '#854D0E', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      Cancel Selection
                    </button>
                  )}
                </div>
              )}

              {/* FORMAT 1: DAY SHEETS (EXACT EXCEL SHEET STYLE) */}
              {timetableFormat === 'SHEET' && (
                <div>
                  {/* Day Tabs matching Excel sheets MONDAY 1, TUESDAY 1, etc. */}
                  <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: '16px', gap: '4px', overflowX: 'auto' }}>
                    {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].map(day => (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        style={{
                          padding: '10px 18px',
                          border: 'none',
                          borderBottom: selectedDay === day ? '3px solid #002147' : '3px solid transparent',
                          background: selectedDay === day ? '#F1F5F9' : 'transparent',
                          color: selectedDay === day ? '#002147' : '#64748B',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {day} 1
                      </button>
                    ))}
                  </div>

                  {/* Day Header Banner (As in the Excel file) */}
                  <div style={{
                    padding: '12px 20px',
                    background: '#002147',
                    color: 'white',
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.5px' }}>
                      {selectedDay} ***({deptId === 5 ? 'PG BLOCK' : (deptId === 1 ? 'BLOCK 5 & BMS' : 'ACADEMIC BLOCK')})
                    </div>
                    <div style={{ fontSize: '11px', color: '#C9A84C', fontWeight: 700 }}>
                      SRMIST RAMAPURAM · SHIFT 1
                    </div>
                  </div>

                  {/* Excel Sheet Table */}
                  <div style={{ overflowX: 'auto', border: '1px solid #CBD5E1', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                    <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
                      <thead>
                        <tr style={{ background: '#F1F5F9', borderBottom: '2px solid #CBD5E1', fontWeight: 800, color: '#002147' }}>
                          <th style={{ width: '140px', padding: '12px 14px', textAlign: 'left', borderRight: '1px solid #CBD5E1' }}>
                            Class & Section/HOUR
                          </th>
                          <th style={{ width: '80px', padding: '12px 10px', borderRight: '1px solid #CBD5E1' }}>
                            SHIFT
                          </th>
                          <th style={{ width: '100px', padding: '12px 10px', borderRight: '1px solid #CBD5E1' }}>
                            ROOM NO.
                          </th>
                          {PERIOD_TIMINGS.map(p => (
                            <th key={p.period} style={{ padding: '12px 10px', borderRight: '1px solid #CBD5E1', minWidth: '150px' }}>
                              <div>{p.period}</div>
                              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>{p.time}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Section Row */}
                        <tr style={{ borderBottom: '1px solid #CBD5E1', background: 'white' }}>
                          {/* Class & Section */}
                          <td style={{ padding: '14px', textAlign: 'left', fontWeight: 800, color: '#002147', borderRight: '1px solid #CBD5E1', background: '#FAFCFE' }}>
                            <div>{programmeInfo?.programme_name || 'MCA'} Sem {selectedSemester} - Section {timetableSection}</div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>
                              {isProvisionalPreview ? 'KAIROS Preview Section' : 'Selected Section'}
                            </div>
                          </td>

                          {/* Shift */}
                          <td style={{ padding: '14px 10px', fontWeight: 700, color: '#334155', borderRight: '1px solid #CBD5E1', background: '#FAFCFE' }}>
                            SH 1
                          </td>

                          {/* Room No */}
                          <td style={{ padding: '14px 10px', fontWeight: 800, color: '#002147', borderRight: '1px solid #CBD5E1', background: '#FAFCFE' }}>
                            {daySlots.find(s => s.room)?.room || timetableRoom}
                          </td>

                          {/* Periods 1 to 6 */}
                          {PERIOD_TIMINGS.map(p => {
                            const slot = daySlots.find(s => s.period === p.period);
                            const isSelectedForSwap = swapSelectedSlot?.id === slot?.id;

                            if (!slot) {
                              return (
                                <td key={p.period} style={{ padding: '12px 10px', borderRight: '1px solid #CBD5E1', color: '#94A3B8', fontSize: '12px' }}>
                                  — Free —
                                </td>
                              );
                            }

                            return (
                              <td
                                key={p.period}
                                onClick={() => handleSlotClick(slot)}
                                style={{
                                  padding: '10px 8px',
                                  borderRight: '1px solid #CBD5E1',
                                  background: isSelectedForSwap
                                    ? 'rgba(201,168,76,0.25)'
                                    : slot.is_lab
                                    ? '#F0FDF4'
                                    : '#FFFFFF',
                                  border: isSelectedForSwap ? '2px solid #C9A84C' : undefined,
                                  cursor: 'pointer',
                                  transition: 'background 0.15s',
                                }}
                                title={isSwapMode ? "Click to swap this slot" : "Click to edit slot"}
                              >
                                {/* Course Code & Short Title as in Excel */}
                                <div style={{ fontWeight: 800, color: '#002147', fontSize: '13px', marginBottom: '2px' }}>
                                  {slot.course_code}
                                </div>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '4px', lineHeight: 1.2 }}>
                                  {slot.course_short}
                                </div>

                                {/* Room */}
                                <div style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: slot.is_lab ? '#DCFCE7' : '#EFF6FF',
                                  color: slot.is_lab ? '#166534' : '#1D4ED8',
                                  marginBottom: '3px'
                                }}>
                                  {slot.room}
                                </div>

                                {/* Faculty */}
                                <div style={{ fontSize: '10px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  👤 {slot.faculty_name}
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* FORMAT 2: FULL WEEK MATRIX (MONDAY TO FRIDAY OVERVIEW) */}
              {timetableFormat === 'MATRIX' && (
                <div style={{ overflowX: 'auto', border: '1px solid #CBD5E1', borderRadius: '8px' }}>
                  <table className="erp-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ background: '#002147', color: 'white', fontWeight: 800 }}>
                        <th style={{ width: '120px', padding: '12px 14px', textAlign: 'left' }}>DAY</th>
                        {PERIOD_TIMINGS.map(p => (
                          <th key={p.period} style={{ padding: '12px 10px', minWidth: '150px' }}>
                            <div>Period {p.period}</div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{p.time}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"].map(day => {
                        const slots = weeklyTimetable.filter(s => s.day === day);
                        return (
                          <tr key={day} style={{ borderBottom: '1px solid #E2E8F0' }}>
                            {/* Day Header */}
                            <td style={{ padding: '14px', textAlign: 'left', fontWeight: 800, color: '#002147', background: '#F8FAFC', borderRight: '1px solid #E2E8F0' }}>
                              {day}
                            </td>

                            {/* Periods 1 to 6 */}
                            {PERIOD_TIMINGS.map(p => {
                              const slot = slots.find(s => s.period === p.period);
                              const isSelectedForSwap = swapSelectedSlot?.id === slot?.id;

                              if (!slot) {
                                return (
                                  <td key={p.period} style={{ padding: '10px', borderRight: '1px solid #E2E8F0', color: '#94A3B8', fontSize: '12px' }}>
                                    — Free —
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={p.period}
                                  onClick={() => handleSlotClick(slot)}
                                  style={{
                                    padding: '10px 8px',
                                    borderRight: '1px solid #E2E8F0',
                                    background: isSelectedForSwap
                                      ? 'rgba(201,168,76,0.25)'
                                      : slot.is_lab
                                      ? '#F0FDF4'
                                      : '#FFFFFF',
                                    border: isSelectedForSwap ? '2px solid #C9A84C' : undefined,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                  }}
                                  title={isSwapMode ? "Click to swap slot" : "Click to edit slot"}
                                >
                                  <div style={{ fontWeight: 800, color: '#002147', fontSize: '13px' }}>
                                    {slot.course_code}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginBottom: '4px' }}>
                                    {slot.course_short}
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#E2E8F0', color: '#334155' }}>
                                      {slot.room}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                                    {slot.faculty_name}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EDIT SLOT MODAL */}
      {editingSlot && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,15,35,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px'
        }}>
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '480px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#FAFCFE' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '15px', color: '#002147' }}>
                  ✏️ Edit Timetable Class Slot
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  {editingSlot.day} · Period {editingSlot.period} ({editingSlot.time})
                </div>
              </div>
              <button
                onClick={() => setEditingSlot(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {/* Subject Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                  ASSIGNED SUBJECT
                </label>
                <select
                  className="form-control"
                  value={editFormData.course_code}
                  onChange={e => {
                    const found = subjects.find(s => s.course_code === e.target.value);
                    setEditFormData({
                      ...editFormData,
                      course_code: e.target.value,
                      course_name: found ? found.course_name : editFormData.course_name
                    });
                  }}
                  style={{ fontWeight: 700 }}
                >
                  {subjects.map(s => (
                    <option key={s.course_code} value={s.course_code}>
                      {s.course_code} — {s.course_name}
                    </option>
                  ))}
                  <option value="TUTORIAL">TUTORIAL — Tutorial & Mentoring</option>
                  <option value="LIBRARY">LIBRARY — Library / Self Study</option>
                </select>
              </div>

              {/* Room Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                  CLASSROOM / LAB (Default: Room 1)
                </label>
                <select
                  className="form-control"
                  value={editFormData.room}
                  onChange={e => setEditFormData({ ...editFormData, room: e.target.value })}
                  style={{ fontWeight: 700 }}
                >
                  {(canonicalRooms.length > 0 ? canonicalRooms : AVAILABLE_ROOMS).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Faculty Incharge */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#002147', display: 'block', marginBottom: '6px' }}>
                  FACULTY INCHARGE
                </label>
                <select
                  className="form-control"
                  value={editFormData.faculty_name}
                  onChange={e => setEditFormData({ ...editFormData, faculty_name: e.target.value })}
                  style={{ fontWeight: 700 }}
                >
                  {MCA_FACULTY.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingSlot(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSlotEdit}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
