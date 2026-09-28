import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Save,
  BookOpen,
  Sparkles,
  Layers,
  RotateCcw,
  Check,
  User,
  GraduationCap,
  Calendar,
  Filter,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreferenceItem {
  id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  class_type: string;
  course_type: string;
  semester: number;
  semester_type?: string;
  theory_hours: number;
  practical_hours: number;
  decision: string;
  sections: string[];
}

interface FacultyInfo {
  id: number;
  name: string;
  erp_id: string;
  designation: string;
  email?: string;
  department?: string;
}

interface AllocationRow {
  preference_item_id: number;
  subject_id: number;
  subject_name: string;
  subject_code: string;
  course_type: string;
  class_type: string;
  semester: number;
  semester_type: string;
  approval: 'PENDING' | 'APPROVED' | 'REJECTED';
  section: string;
  valid_sections: string[];
  role: string;
  theory_hours: number;
  lab_hours: number;
  total_hours: number;
}

export default function FacultyDetailModal({
  facultyId: propFacultyId,
  onClose: propOnClose
}: {
  facultyId?: number;
  onClose?: () => void;
}) {
  const { session } = useAuth();
  const params = useParams<{ facultyId?: string }>();
  const navigate = useNavigate();

  const effectiveFacultyId = propFacultyId ?? (params.facultyId ? Number(params.facultyId) : undefined);
  const handleClose = useCallback(() => {
    if (propOnClose) {
      propOnClose();
    } else {
      navigate(-1);
    }
  }, [propOnClose, navigate]);

  const [faculty, setFaculty] = useState<FacultyInfo | null>(null);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hourCap, setHourCap] = useState(16);
  const [totalAllocated, setTotalAllocated] = useState(0);

  // Filters
  const [semesterFilter, setSemesterFilter] = useState<'ALL' | 'ODD' | 'EVEN'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'REJECTED'>('ALL');

  useEffect(() => {
    if (!effectiveFacultyId) return;
    loadData();
  }, [effectiveFacultyId]);

  // Keyboard accessibility (Escape to dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveAllocations();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, allocations, hourCap, totalAllocated]);

  const calcTotal = (allocs: AllocationRow[]) => {
    const total = allocs
      .filter((a) => a.approval === 'APPROVED')
      .reduce((sum, a) => sum + a.total_hours, 0);
    setTotalAllocated(total);
  };

  const loadData = async () => {
    if (!effectiveFacultyId) return;
    setIsLoading(true);
    try {
      const facResp = await apiClient.get(`/faculty/detail/${effectiveFacultyId}`);
      setFaculty(facResp.data.faculty);
      setPreferences(facResp.data.preferences || []);
      setHourCap(facResp.data.hour_cap || 16);

      const initAlloc: AllocationRow[] = (facResp.data.preferences as PreferenceItem[] || []).map(
        (p: PreferenceItem) => {
          const semNum = Number(p.semester) || 1;
          const inferredType = semNum % 2 !== 0 ? 'ODD' : 'EVEN';
          const semType = (p.semester_type || inferredType).toUpperCase();

          return {
            preference_item_id: p.id,
            subject_id: p.subject_id,
            subject_name: p.subject_name,
            subject_code: p.subject_code,
            course_type: p.course_type || 'CORE',
            class_type: p.class_type || 'General',
            semester: semNum,
            semester_type: semType,
            approval: (p.decision === 'APPROVED'
              ? 'APPROVED'
              : p.decision === 'DENIED'
              ? 'REJECTED'
              : 'PENDING') as AllocationRow['approval'],
            section: (p.sections && p.sections.length > 0 && p.sections[0]) ? p.sections[0] : 'A',
            valid_sections: p.sections && p.sections.length > 0 ? p.sections : ['A', 'B', 'C'],
            role: 'Incharge-1',
            theory_hours: p.theory_hours ?? 3,
            lab_hours: p.practical_hours ?? 0,
            total_hours: (p.theory_hours ?? 3) + (p.practical_hours ?? 0),
          };
        }
      );

      // Merge with existing allocations if available
      if (facResp.data.allocations) {
        for (const existingAlloc of facResp.data.allocations) {
          const idx = initAlloc.findIndex((a) => a.subject_id === existingAlloc.subject_id);
          const current = initAlloc[idx];
          if (idx >= 0 && current) {
            initAlloc[idx] = {
              ...current,
              ...existingAlloc,
              total_hours: (existingAlloc.theory_hours ?? current.theory_hours) +
                           (existingAlloc.lab_hours ?? current.lab_hours)
            };
          }
        }
      }

      setAllocations(initAlloc);
      calcTotal(initAlloc);
    } catch {
      toast.error('Failed to load faculty details.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateAllocation = (
    subjectId: number,
    field: keyof AllocationRow,
    value: string | number
  ) => {
    setAllocations((prev) => {
      const updated = prev.map((row) => {
        if (row.subject_id !== subjectId) return row;
        const nextRow = { ...row };
        if (field === 'theory_hours' || field === 'lab_hours') {
          const numVal = Number(value);
          (nextRow as any)[field] = numVal;
          nextRow.total_hours =
            (field === 'theory_hours' ? numVal : nextRow.theory_hours) +
            (field === 'lab_hours' ? numVal : nextRow.lab_hours);
        } else {
          (nextRow as any)[field] = value;
        }
        return nextRow;
      });
      calcTotal(updated);
      return updated;
    });
  };

  const handleBulkApproval = (decision: 'APPROVED' | 'PENDING' | 'REJECTED') => {
    setAllocations((prev) => {
      const updated = prev.map((row) => {
        // apply to filtered rows or all rows
        if (semesterFilter !== 'ALL' && row.semester_type !== semesterFilter) {
          return row;
        }
        return {
          ...row,
          approval: decision
        };
      });
      calcTotal(updated);
      return updated;
    });
    toast.info(`Updated all visible preferences to ${decision.toLowerCase()}.`);
  };

  const saveAllocations = async () => {
    if (!effectiveFacultyId) return;
    const approved = allocations.filter((a) => a.approval === 'APPROVED');
    const newTotal = approved.reduce((s, a) => s + a.total_hours, 0);

    if (newTotal > hourCap) {
      toast.error(`Allocation exceeds hour cap: ${newTotal} / ${hourCap} hours. Reduce allocated hours before saving.`);
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post(`/faculty/${effectiveFacultyId}/allocations`, {
        allocations: allocations.map((a) => ({
          subject_id: a.subject_id,
          approval: a.approval,
          section: a.section,
          role: a.role,
          theory_hours: a.theory_hours,
          lab_hours: a.lab_hours,
        })),
      });
      toast.success('Allocations saved successfully.');
      handleClose();
    } catch {
      toast.error('Failed to save allocations.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered rows
  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      const matchSemester =
        semesterFilter === 'ALL' || a.semester_type === semesterFilter;
      const matchStatus =
        statusFilter === 'ALL' || a.approval === statusFilter;
      return matchSemester && matchStatus;
    });
  }, [allocations, semesterFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = allocations.length;
    const oddCount = allocations.filter((a) => a.semester_type === 'ODD').length;
    const evenCount = allocations.filter((a) => a.semester_type === 'EVEN').length;
    const approvedList = allocations.filter((a) => a.approval === 'APPROVED');
    const approvedCount = approvedList.length;
    const pendingCount = allocations.filter((a) => a.approval === 'PENDING').length;
    const rejectedCount = allocations.filter((a) => a.approval === 'REJECTED').length;
    const theoryHoursTotal = approvedList.reduce((acc, a) => acc + a.theory_hours, 0);
    const labHoursTotal = approvedList.reduce((acc, a) => acc + a.lab_hours, 0);

    return {
      totalCount,
      oddCount,
      evenCount,
      approvedCount,
      pendingCount,
      rejectedCount,
      theoryHoursTotal,
      labHoursTotal,
    };
  }, [allocations]);

  const remaining = hourCap - totalAllocated;
  const progressPercent = Math.min(Math.round((totalAllocated / (hourCap || 1)) * 100), 100);
  const isOverloaded = totalAllocated > hourCap;

  // Faculty initials
  const initials = useMemo(() => {
    if (!faculty?.name) return 'FM';
    const cleanName = faculty.name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim();
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'FM';
    if (parts.length === 1) return (parts[0]?.slice(0, 2) || 'FM').toUpperCase();
    const first = parts[0] || '';
    const last = parts[parts.length - 1] || '';
    return ((first[0] || 'F') + (last[0] || 'M')).toUpperCase();
  }, [faculty?.name]);

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in-0"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-2xl border border-slate-200 animate-pulse">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-2xl bg-slate-200" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 rounded-md bg-slate-200" />
              <div className="h-4 w-32 rounded-md bg-slate-100" />
            </div>
            <div className="h-14 w-40 rounded-xl bg-slate-200" />
          </div>
          <div className="h-72 rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!faculty) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in-0"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl border border-slate-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Faculty Not Found</h3>
          <p className="mt-2 text-sm text-slate-500">
            The requested faculty record could not be loaded or was removed.
          </p>
          <button
            onClick={handleClose}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in-0 duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="faculty-action-title"
    >
      <div
        className="relative flex w-full max-w-6xl max-h-[92vh] flex-col rounded-2xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP PROFILE HEADER */}
        <div className="relative border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50/70 p-5 sm:p-6">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pr-12">
            {/* Faculty Identity */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002147] to-[#003580] text-white font-extrabold text-xl sm:text-2xl shadow-md border-2 border-white ring-1 ring-slate-200">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2
                    id="faculty-action-title"
                    className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight"
                  >
                    {faculty.name}
                  </h2>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
                    {faculty.designation}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs sm:text-sm text-slate-500 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-mono bg-slate-100/80 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    ID: {faculty.erp_id}
                  </span>
                  {faculty.department && (
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                      {faculty.department}
                    </span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600 font-medium">
                    Faculty Action & Workload Review
                  </span>
                </div>
              </div>
            </div>

            {/* Workload Capacity Meter Card */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm min-w-[280px] sm:min-w-[320px]">
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                  <span>Workload Allocation</span>
                  <span
                    className={cn(
                      'font-black text-sm',
                      isOverloaded ? 'text-rose-600' : 'text-slate-900'
                    )}
                  >
                    {totalAllocated} <span className="text-slate-400 font-normal">/ {hourCap} hrs</span>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden p-0.5">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300 ease-out',
                      isOverloaded
                        ? 'bg-gradient-to-r from-rose-500 to-red-600'
                        : totalAllocated === hourCap
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    )}
                    style={{ width: `${Math.min((totalAllocated / (hourCap || 1)) * 100, 100)}%` }}
                  />
                </div>

                {/* Status text */}
                <div className="flex items-center justify-between text-[11px] font-semibold pt-0.5">
                  {isOverloaded ? (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Exceeds cap by {Math.abs(remaining)} hrs
                    </span>
                  ) : remaining === 0 ? (
                    <span className="inline-flex items-center gap-1 text-indigo-700 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                      Optimal full capacity reached
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {remaining} hours available
                    </span>
                  )}
                  <span className="text-slate-400 font-medium">
                    {progressPercent}% filled
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SUB-HEADER & FILTERS BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/60 px-5 sm:px-6 py-3.5">
          {/* Section title & breakdown */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Subject Preferences & Allocations
              </h3>
              <span className="inline-flex items-center rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {allocations.length} total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review course preferences, toggle approval, and configure sections, roles, and hour splits.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Semester Odd / Even Filter */}
            <div className="inline-flex items-center rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setSemesterFilter('ALL')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition',
                  semesterFilter === 'ALL'
                    ? 'bg-[#002147] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                All Terms ({allocations.length})
              </button>
              <button
                type="button"
                onClick={() => setSemesterFilter('ODD')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition inline-flex items-center gap-1',
                  semesterFilter === 'ODD'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-700 hover:bg-indigo-50/70'
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
                Odd Semesters ({stats.oddCount})
              </button>
              <button
                type="button"
                onClick={() => setSemesterFilter('EVEN')}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition inline-flex items-center gap-1',
                  semesterFilter === 'EVEN'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-teal-700 hover:bg-teal-50/70'
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                Even Semesters ({stats.evenCount})
              </button>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkApproval('APPROVED')}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition shadow-2xs"
                title="Approve all currently visible preferences"
              >
                <Check className="h-3.5 w-3.5" />
                Approve All
              </button>
              <button
                type="button"
                onClick={() => handleBulkApproval('PENDING')}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 hover:bg-slate-200 transition shadow-2xs"
                title="Reset all to pending state"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* ALLOCATION TABLE CONTAINER */}
        <div className="flex-1 overflow-auto bg-white p-4 sm:p-6">
          {filteredAllocations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                No matching subject preferences
              </h4>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                {allocations.length === 0
                  ? 'This faculty member has not submitted any subject preferences for the active session.'
                  : 'No subject preferences match the current semester or approval filter selection.'}
              </p>
              {allocations.length > 0 && (
                <button
                  onClick={() => {
                    setSemesterFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  className="mt-4 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-500 uppercase tracking-wider">
                    <th scope="col" className="py-3 px-4 min-w-[220px]">
                      Subject & Code
                    </th>
                    <th scope="col" className="py-3 px-3 min-w-[130px]">
                      Semester & Type
                    </th>
                    <th scope="col" className="py-3 px-3">
                      Category
                    </th>
                    <th scope="col" className="py-3 px-3">
                      Programme
                    </th>
                    <th scope="col" className="py-3 px-4 min-w-[170px] text-center">
                      Decision
                    </th>
                    <th scope="col" className="py-3 px-3 min-w-[90px]">
                      Section
                    </th>
                    <th scope="col" className="py-3 px-3 min-w-[120px]">
                      Role
                    </th>
                    <th scope="col" className="py-3 px-3 text-center min-w-[85px]">
                      Theory
                    </th>
                    <th scope="col" className="py-3 px-3 text-center min-w-[85px]">
                      Lab
                    </th>
                    <th scope="col" className="py-3 px-4 text-right min-w-[80px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredAllocations.map((a) => {
                    const isOdd = a.semester_type === 'ODD';
                    const isApproved = a.approval === 'APPROVED';
                    const isRejected = a.approval === 'REJECTED';
                    const isPending = a.approval === 'PENDING';

                    return (
                      <tr
                        key={a.subject_id}
                        className={cn(
                          'transition-colors duration-150',
                          isApproved
                            ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
                            : isRejected
                            ? 'bg-rose-50/25 opacity-75 hover:opacity-100 hover:bg-rose-50/40'
                            : 'bg-white hover:bg-slate-50/70'
                        )}
                      >
                        {/* Subject & Code */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 leading-snug">
                            {a.subject_name}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="inline-flex font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {a.subject_code}
                            </span>
                          </div>
                        </td>

                        {/* Semester & Odd/Even Type Indicator */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              Semester {a.semester}
                            </span>
                            {/* Odd / Even Badge */}
                            <div>
                              {isOdd ? (
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200/90 shadow-2xs">
                                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                  ODD SEM
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide bg-teal-50 text-teal-800 border border-teal-200/90 shadow-2xs">
                                  <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                                  EVEN SEM
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Course Type / Category */}
                        <td className="py-3 px-3">
                          <span
                            className={cn(
                              'inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide border',
                              a.course_type.toUpperCase().includes('CORE')
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : a.course_type.toUpperCase().includes('ELECTIVE')
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            )}
                          >
                            {a.course_type}
                          </span>
                        </td>

                        {/* Class / Programme Type */}
                        <td className="py-3 px-3">
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                            {a.class_type || 'MCA'}
                          </span>
                        </td>

                        {/* Decision (Interactive 3-way toggle button group) */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/80 max-w-[170px] mx-auto shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateAllocation(a.subject_id, 'approval', 'APPROVED')}
                              className={cn(
                                'flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition',
                                isApproved
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-500 hover:text-emerald-700 hover:bg-white/60'
                              )}
                              title="Approve subject preference"
                            >
                              <Check className="h-3 w-3" />
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => updateAllocation(a.subject_id, 'approval', 'PENDING')}
                              className={cn(
                                'flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition',
                                isPending
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-500 hover:text-amber-700 hover:bg-white/60'
                              )}
                              title="Keep preference pending"
                            >
                              <Clock className="h-3 w-3" />
                              Wait
                            </button>
                            <button
                              type="button"
                              onClick={() => updateAllocation(a.subject_id, 'approval', 'REJECTED')}
                              className={cn(
                                'flex-1 py-1 px-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition',
                                isRejected
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-500 hover:text-rose-700 hover:bg-white/60'
                              )}
                              title="Deny subject preference"
                            >
                              <X className="h-3 w-3" />
                              No
                            </button>
                          </div>
                        </td>

                        {/* Section Selection */}
                        <td className="py-3 px-3">
                          <select
                            value={a.section}
                            onChange={(e) => updateAllocation(a.subject_id, 'section', e.target.value)}
                            disabled={!isApproved}
                            className={cn(
                              'w-full rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition',
                              isApproved
                                ? 'bg-white border-slate-300 text-slate-800 shadow-2xs hover:border-slate-400'
                                : 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed'
                            )}
                          >
                            <option value="">— Select —</option>
                            {a.valid_sections.map((sec) => (
                              <option key={sec} value={sec}>
                                Section {sec}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Role Selection */}
                        <td className="py-3 px-3">
                          <select
                            value={a.role}
                            onChange={(e) => updateAllocation(a.subject_id, 'role', e.target.value)}
                            disabled={!isApproved}
                            className={cn(
                              'w-full rounded-lg border px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition',
                              isApproved
                                ? 'bg-white border-slate-300 text-slate-800 shadow-2xs hover:border-slate-400'
                                : 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed'
                            )}
                          >
                            <option value="Incharge-1">Incharge-1</option>
                            <option value="Incharge-2">Incharge-2</option>
                            <option value="Lab Incharge">Lab Incharge</option>
                            <option value="Faculty Support">Faculty Support</option>
                          </select>
                        </td>

                        {/* Theory Hours */}
                        <td className="py-3 px-3 text-center">
                          <select
                            value={a.theory_hours}
                            onChange={(e) => updateAllocation(a.subject_id, 'theory_hours', e.target.value)}
                            disabled={!isApproved}
                            className={cn(
                              'w-16 rounded-lg border px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition mx-auto',
                              isApproved
                                ? 'bg-white border-slate-300 text-slate-800 shadow-2xs'
                                : 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed'
                            )}
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={n}>
                                {n} hrs
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Lab Hours */}
                        <td className="py-3 px-3 text-center">
                          <select
                            value={a.lab_hours}
                            onChange={(e) => updateAllocation(a.subject_id, 'lab_hours', e.target.value)}
                            disabled={!isApproved}
                            className={cn(
                              'w-16 rounded-lg border px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition mx-auto',
                              isApproved
                                ? 'bg-white border-slate-300 text-slate-800 shadow-2xs'
                                : 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed'
                            )}
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={n}>
                                {n} hrs
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Total Hours */}
                        <td className="py-3 px-4 text-right">
                          <span
                            className={cn(
                              'inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-black shadow-2xs border',
                              isApproved
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            )}
                          >
                            {isApproved ? `${a.total_hours} hrs` : '0 hrs'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50/90 px-5 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Hour Summary & Warnings */}
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">Approved Totals:</span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-slate-700">
                Theory: <strong className="text-slate-900">{stats.theoryHoursTotal}h</strong>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-slate-700">
                Lab: <strong className="text-slate-900">{stats.labHoursTotal}h</strong>
              </span>
              <span
                className={cn(
                  'px-2.5 py-1 rounded-md border font-black',
                  isOverloaded
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                )}
              >
                Total: {totalAllocated} / {hourCap} hrs
              </span>
            </div>

            {isOverloaded && (
              <span className="text-rose-600 font-bold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Must decrease hours by {totalAllocated - hourCap}h
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveAllocations}
              disabled={isSaving || isOverloaded}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                isOverloaded
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-[#002147] hover:bg-[#003580] active:scale-[0.98]'
              )}
            >
              {isSaving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving Allocations...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 text-white/90" />
                  Save Allocations
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
