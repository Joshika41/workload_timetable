import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkloadData } from '@/lib/workload-store';
import { WorkloadStatusBadge } from '@/components/WorkloadStatusBadge';
import type { CourseAllocation, ProgrammeType, SemesterType } from '@/lib/workload-types';
import { exportCourseAllocationToExcel } from '@/lib/excel-export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SlidersHorizontal,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Users,
  Building,
  Sparkles,
  ArrowLeft,
  Check,
  AlertTriangle,
  Layers,
  FilterX,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/allocation')({
  component: AdminAllocationPage,
});

function FacultyInlineSelect({ alloc, type, disabled, getFacultyForCourseDropdown, facultyList, updateAllocation }: any) {
  const { preferred, remaining } = getFacultyForCourseDropdown(alloc.courseCode);
  const value = type === 'main' ? alloc.mainFacultyId : alloc.asstFacultyId;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value || null;
    const fac = facultyList.find((f: any) => f.id === selectedId);
    
    const updated = { ...alloc };
    if (type === 'main') {
      updated.mainFacultyId = selectedId;
      updated.mainFacultyName = fac?.name;
      updated.mainTheoryHours = alloc.theoryHours;
      updated.mainPracticalHours = alloc.practicalHours;
      updated.status = selectedId ? 'ALLOCATED' : 'UNALLOCATED';
    } else {
      updated.asstFacultyId = selectedId;
      updated.asstFacultyName = fac?.name;
      updated.asstTheoryHours = 0;
      updated.asstPracticalHours = alloc.practicalHours > 0 ? alloc.practicalHours : 0;
    }
    
    updateAllocation(updated);
    toast.success(`Assigned ${type === 'main' ? 'Main' : 'Assistant'} Faculty for ${alloc.courseCode}`);
  };

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={disabled}
      className={`w-full min-w-[140px] max-w-[200px] h-7 rounded border px-1 text-[11px] font-bold ${
        type === 'main'
          ? 'border-blue-300 bg-blue-50/50 text-blue-900'
          : 'border-teal-300 bg-teal-50/50 text-teal-900'
      } disabled:opacity-50 disabled:bg-slate-100 disabled:border-slate-200 cursor-pointer`}
    >
      <option value="">-- Select --</option>
      <optgroup label="⭐ PREFERRED">
        {preferred.map((p: any) => (
          <option key={p.faculty.id} value={p.faculty.id}>
            ⭐ {p.faculty.name} ({p.remainingHours}h cap)
          </option>
        ))}
      </optgroup>
      <optgroup label="OTHER ELIGIBLE">
        {remaining.map((r: any) => (
          <option key={r.faculty.id} value={r.faculty.id}>
            {r.faculty.name} ({r.remainingHours}h cap)
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function AdminAllocationPage() {
  const {
    allocations,
    facultyList,
    courseList,
    sectionList,
    preferences,
    allWorkloads,
    updateAllocation,
    createAllocation,
    deleteAllocation,
    getFacultyForCourseDropdown,
  } = useWorkloadData();

  // Page mode: 'management' (Subject List Table) | 'finalize' (Subject Finalization Screen) | 'class-matrix' (Class-Wise Allocation Matrix)
  const [activeTab, setActiveTab] = useState<'management' | 'finalize' | 'class-matrix'>('management');

  // Academic Context Selector State
  const [contextProgramme, setContextProgramme] = useState<ProgrammeType>('MCA GEN AI');
  const [contextSemester, setContextSemester] = useState<SemesterType>('I');
  const [contextSection, setContextSection] = useState<string>('I MCA GEN AI A');

  // Subject Finalization Selected ID
  const [finalizingAllocId, setFinalizingAllocId] = useState<string | null>(null);

  // Filters for management table
  const [searchTerm, setSearchTerm] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');
  const [semesterFilter, setSemesterFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ALLOCATED' | 'UNALLOCATED'>('ALL');
  const [selectedFacultyFilter, setSelectedFacultyFilter] = useState<string>('ALL');

  // Search inside Other Eligible Faculty list on Finalize Screen
  const [otherFacultySearch, setOtherFacultySearch] = useState('');

  // Edit/Add Allocation Modal State
  const [editingAlloc, setEditingAlloc] = useState<CourseAllocation | null>(null);
  const [isNewAllocModalOpen, setIsNewAllocModalOpen] = useState(false);

  // New allocation form state
  const [newCourseCode, setNewCourseCode] = useState(courseList[0]?.code || 'PCA25C01J');
  const [newSection, setNewSection] = useState(sectionList[0]?.name || 'I MCA GEN AI A');
  const [newStudents, setNewStudents] = useState(55);
  const [newTheoryHours, setNewTheoryHours] = useState(3);
  const [newPracticalHours, setNewPracticalHours] = useState(2);
  const [newMainFacultyId, setNewMainFacultyId] = useState<string>('');
  const [newAsstFacultyId, setNewAsstFacultyId] = useState<string>('');

  // Target allocation being finalized
  const targetAlloc = allocations.find((a) => a.id === finalizingAllocId) || allocations[0];

  // Temporary local state while finalizing a subject
  const [selectedMainId, setSelectedMainId] = useState<string | null>(targetAlloc?.mainFacultyId || null);
  const [selectedAsstId, setSelectedAsstId] = useState<string | null>(targetAlloc?.asstFacultyId || null);
  const [mainTh, setMainTh] = useState<number>(targetAlloc?.mainTheoryHours ?? targetAlloc?.theoryHours ?? 3);
  const [mainPr, setMainPr] = useState<number>(targetAlloc?.mainPracticalHours ?? targetAlloc?.practicalHours ?? 2);
  const [asstTh, setAsstTh] = useState<number>(targetAlloc?.asstTheoryHours ?? 0);
  const [asstPr, setAsstPr] = useState<number>(targetAlloc?.asstPracticalHours ?? (targetAlloc?.practicalHours ? 2 : 0));

  // Open Subject Finalization screen for a specific allocation
  const handleOpenFinalize = (alloc: CourseAllocation) => {
    setFinalizingAllocId(alloc.id);
    setSelectedMainId(alloc.mainFacultyId);
    setSelectedAsstId(alloc.asstFacultyId);
    setMainTh(alloc.mainTheoryHours !== undefined ? alloc.mainTheoryHours : alloc.theoryHours);
    setMainPr(alloc.mainPracticalHours !== undefined ? alloc.mainPracticalHours : alloc.practicalHours);
    setAsstTh(alloc.asstTheoryHours !== undefined ? alloc.asstTheoryHours : 0);
    setAsstPr(alloc.asstPracticalHours !== undefined ? alloc.asstPracticalHours : (alloc.practicalHours > 0 ? alloc.practicalHours : 0));
    setActiveTab('finalize');
  };

  const handleSaveFinalization = (isFinalized: boolean) => {
    // Left empty since we moved to inline editing
  };

  // Filtered allocations for management table
  const filteredAllocations = allocations.filter((alloc) => {
    const matchesSearch =
      alloc.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alloc.courseTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alloc.mainFacultyName && alloc.mainFacultyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (alloc.asstFacultyName && alloc.asstFacultyName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesProg = programmeFilter === 'ALL' || alloc.programme === programmeFilter;
    const matchesSem = semesterFilter === 'ALL' || alloc.semester === semesterFilter;
    const matchesSec = sectionFilter === 'ALL' || alloc.section === sectionFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ALLOCATED' && alloc.mainFacultyId !== null) ||
      (statusFilter === 'UNALLOCATED' && alloc.mainFacultyId === null);

    const matchesFaculty =
      selectedFacultyFilter === 'ALL' ||
      alloc.mainFacultyId === selectedFacultyFilter ||
      alloc.asstFacultyId === selectedFacultyFilter;

    return matchesSearch && matchesProg && matchesSem && matchesSec && matchesStatus && matchesFaculty;
  });

  const handleExport = () => {
    exportCourseAllocationToExcel(allocations);
    toast.success('Course allocation spreadsheet exported successfully!');
  };

  const handleCreateNewAllocation = () => {
    const course = courseList.find((c) => c.code === newCourseCode);
    const mainFac = facultyList.find((f) => f.id === newMainFacultyId);
    const asstFac = facultyList.find((f) => f.id === newAsstFacultyId);

    const newAlloc: CourseAllocation = {
      id: `ALLOC_${Date.now()}`,
      courseCode: newCourseCode,
      courseTitle: course?.title || newCourseCode,
      programme: course?.programme || 'MCA GEN AI',
      semester: course?.semester || 'I',
      section: newSection,
      studentCount: newStudents,
      theoryHours: newTheoryHours,
      practicalHours: newPracticalHours,
      labBatches: newPracticalHours > 0 ? 2 : 0,
      mainFacultyId: newMainFacultyId || null,
      mainFacultyName: mainFac?.name,
      asstFacultyId: newAsstFacultyId || null,
      asstFacultyName: asstFac?.name,
      totalHours: newTheoryHours + newPracticalHours,
      status: newMainFacultyId ? 'ALLOCATED' : 'UNALLOCATED',
    };

    createAllocation(newAlloc);
    toast.success(`Created allocation for ${newCourseCode} (${newSection})`);
    setIsNewAllocModalOpen(false);
  };

  /**
   * Preferred vs Other Eligible breakdown for active target course
   */
  const courseCodeForFinalize = targetAlloc?.courseCode || 'PCA25C01J';
  const { preferred, remaining } = getFacultyForCourseDropdown(courseCodeForFinalize);

  const filteredOtherFaculty = remaining.filter(
    (item) =>
      item.faculty.name.toLowerCase().includes(otherFacultySearch.toLowerCase()) ||
      item.faculty.designation.toLowerCase().includes(otherFacultySearch.toLowerCase())
  );

  // Reconciliation calculations for active subject finalization
  const requiredTheory = targetAlloc?.theoryHours || 0;
  const requiredPractical = targetAlloc?.practicalHours || 0;
  const requiredTotal = requiredTheory + requiredPractical;

  const allocatedTheory = (selectedMainId ? mainTh : 0) + (selectedAsstId ? asstTh : 0);
  const allocatedPractical = (selectedMainId ? mainPr : 0) + (selectedAsstId ? asstPr : 0);
  const allocatedTotal = allocatedTheory + allocatedPractical;

  const isReconciled = requiredTotal > 0 && allocatedTotal === requiredTotal;

  return (
    <WorkloadShell
      role="admin"
      title="HOD Subject Allocation & Finalization Portal"
      subtitle="Configure main/assistant faculty, credited theory/lab hours, and class-wise curriculum allocations"
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => window.history.back()}
            className="h-8 gap-1 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 bg-white"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'management' ? 'default' : 'outline'}
            onClick={() => setActiveTab('management')}
            className={`h-8 gap-1.5 text-xs ${activeTab === 'management' ? 'bg-[#002147] text-white' : 'bg-white'}`}
          >
            <SlidersHorizontal className="size-3.5" />
            <span>Subject Allocations List</span>
          </Button>

          <Button
            size="sm"
            variant={activeTab === 'class-matrix' ? 'default' : 'outline'}
            onClick={() => setActiveTab('class-matrix')}
            className={`h-8 gap-1.5 text-xs ${activeTab === 'class-matrix' ? 'bg-[#002147] text-white' : 'bg-white'}`}
          >
            <BookOpen className="size-3.5 text-teal-300" />
            <span>Class-Wise Matrix</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            className="h-8 gap-1.5 text-xs border-slate-300 bg-white hover:bg-slate-100 text-slate-800"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </Button>
        </div>
      }
    >
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. ACADEMIC CONTEXT SELECTOR BAR */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-blue-900/40 bg-[#002147] text-white p-4 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-blue-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Building className="size-4 text-teal-300" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Academic Context Selector
            </h3>
            <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded font-mono">
              ODD Semester 2026-2027
            </span>
          </div>

          <div className="text-xs text-blue-200">
            Selected Context Scope Controls Displayed Subjects &amp; Allocations
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-blue-200 uppercase mb-1">Academic Year</label>
            <div className="h-8 rounded bg-white/10 border border-white/20 px-2.5 flex items-center font-bold text-white">
              2026–2027
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-blue-200 uppercase mb-1">Semester</label>
            <div className="h-8 rounded bg-white/10 border border-white/20 px-2.5 flex items-center font-bold text-teal-300">
              ODD SEMESTER
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-blue-200 uppercase mb-1">Programme</label>
            <select
              value={contextProgramme}
              onChange={(e) => setContextProgramme(e.target.value as ProgrammeType)}
              className="w-full h-8 rounded bg-blue-950 border border-blue-400/40 px-2 font-bold text-white"
            >
              <option value="MCA GEN AI">MCA GEN AI</option>
              <option value="MCA">MCA</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-blue-200 uppercase mb-1">Semester / Year</label>
            <select
              value={contextSemester}
              onChange={(e) => setContextSemester(e.target.value as SemesterType)}
              className="w-full h-8 rounded bg-blue-950 border border-blue-400/40 px-2 font-bold text-white"
            >
              <option value="I">I Year (Semester I)</option>
              <option value="III">II Year (Semester III)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-blue-200 uppercase mb-1">Section</label>
            <select
              value={contextSection}
              onChange={(e) => setContextSection(e.target.value)}
              className="w-full h-8 rounded bg-blue-950 border border-blue-400/40 px-2 font-bold text-white"
            >
              {sectionList.map((sec) => (
                <option key={sec.id} value={sec.name}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. TAB A: SUBJECT ALLOCATIONS LIST TABLE */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'management' && (
        <div className="space-y-6">
          {/* Live Deduction Tracker */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-[#002147]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Faculty Workload Capacity Tracker
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Click any faculty to filter their assignments
              </span>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
              {allWorkloads.map((w) => {
                const isSelected = selectedFacultyFilter === w.facultyId;
                return (
                  <div
                    key={w.facultyId}
                    onClick={() => setSelectedFacultyFilter(isSelected ? 'ALL' : w.facultyId)}
                    className={`shrink-0 w-44 rounded-lg p-2.5 cursor-pointer border transition-all ${
                      isSelected
                        ? 'border-[#002147] bg-blue-50 ring-2 ring-[#002147]/20 shadow-sm'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-xs text-slate-900 truncate" title={w.facultyName}>
                        {w.facultyName}
                      </span>
                      <WorkloadStatusBadge status={w.status} size="sm" />
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{w.designation}</p>
                    <div className="mt-2 pt-1 border-t border-slate-200 flex justify-between text-[11px] font-mono">
                      <span>Target: <strong>{w.defaultHours}h</strong></span>
                      <span className="text-blue-700 font-bold">Total: {w.allocatedHours}h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Subject Allocation Management
                </h3>
                <p className="text-xs text-slate-500">
                  Select any subject and click <strong className="text-blue-800">[ Finalize ]</strong> to perform detailed faculty mapping.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setIsNewAllocModalOpen(true)}
                  className="h-8 gap-1.5 text-xs bg-[#002147] text-white"
                >
                  <Plus className="size-3.5 text-teal-300" />
                  <span>Add New Offering</span>
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                <thead className="text-[11px] font-bold text-slate-600 bg-slate-100 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Subject Code</th>
                    <th className="px-3.5 py-2.5">Subject Title</th>
                    <th className="px-3.5 py-2.5">Programme &amp; Section</th>
                    <th className="px-3.5 py-2.5 text-center">L (Th)</th>
                    <th className="px-3.5 py-2.5 text-center">P (Lab)</th>
                    <th className="px-3.5 py-2.5 text-center">Total Req</th>
                    <th className="px-3.5 py-2.5">Main Faculty</th>
                    <th className="px-3.5 py-2.5">Assistant / IN-2</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAllocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-3.5 py-2.5 font-mono font-bold text-blue-700">
                        {alloc.courseCode}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900 max-w-xs truncate" title={alloc.courseTitle}>
                        {alloc.courseTitle}
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-700 font-mono">
                        {alloc.section} ({alloc.programme})
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono text-slate-800">
                        {alloc.theoryHours}h
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono text-slate-800">
                        {alloc.practicalHours}h
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-900 bg-slate-50">
                        {alloc.totalHours}h
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                        <FacultyInlineSelect
                          alloc={alloc}
                          type="main"
                          facultyList={facultyList}
                          updateAllocation={updateAllocation}
                          getFacultyForCourseDropdown={getFacultyForCourseDropdown}
                        />
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {alloc.practicalHours > 0 ? (
                          <FacultyInlineSelect
                            alloc={alloc}
                            type="asst"
                            facultyList={facultyList}
                            updateAllocation={updateAllocation}
                            getFacultyForCourseDropdown={getFacultyForCourseDropdown}
                          />
                        ) : (
                          <span className="text-slate-400 italic text-[11px] px-2 block text-center border border-dashed rounded bg-slate-50 py-1">No Lab Component</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            alloc.status === 'FINALIZED' || alloc.status === 'RECONCILED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : alloc.mainFacultyId
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {alloc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. TAB C: CLASS-WISE CURRICULUM ALLOCATION MATRIX (Untitled spreadsheet (1).xlsx) */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'class-matrix' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="text-center space-y-1 border-b pb-4">
              <h2 className="font-bold text-sm text-slate-800 tracking-wider uppercase">
                SRM INSTITUTE OF SCIENCE AND TECHNOLOGY
              </h2>
              <h3 className="font-extrabold text-base text-[#002147]">
                CLASS-WISE CURRICULUM ALLOCATION MATRIX
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {contextProgramme} · Semester {contextSemester} · Digital Replica of Official Allocation Master Sheet
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-300 border-collapse min-w-[950px]">
                <thead className="bg-slate-100 text-[11px] font-bold text-slate-800 border-b border-slate-300 uppercase">
                  <tr>
                    <th className="border border-slate-300 px-3 py-2 text-center w-12">S.No</th>
                    <th className="border border-slate-300 px-3 py-2">Subject Code</th>
                    <th className="border border-slate-300 px-3 py-2">Subject Name</th>
                    <th className="border border-slate-300 px-3 py-2 text-center">L (Th)</th>
                    <th className="border border-slate-300 px-3 py-2 text-center">P (Lab)</th>
                    <th className="border border-slate-300 px-3 py-2 text-center">Total</th>
                    <th className="border border-slate-300 px-3 py-2">Main Faculty</th>
                    <th className="border border-slate-300 px-3 py-2">Assistant Faculty (IN2 Lab)</th>
                    <th className="border border-slate-300 px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allocations
                    .filter((a) => a.programme === contextProgramme && a.semester === contextSemester)
                    .map((alloc, idx) => {
                      const hasLab = alloc.practicalHours > 0;

                      return (
                        <tr key={alloc.id} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 font-mono font-bold text-blue-700">
                            {alloc.courseCode}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-900">
                            {alloc.courseTitle}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-mono font-semibold text-slate-800">
                            {alloc.theoryHours}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-mono font-semibold text-slate-800">
                            {alloc.practicalHours}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold text-blue-900 bg-blue-50/50">
                            {alloc.totalHours} hrs
                          </td>
                          <td className="border border-slate-300 px-3 py-2">
                            <span className="font-bold text-slate-900">
                              {alloc.mainFacultyName || <span className="text-rose-600 italic">Unassigned</span>}
                            </span>
                          </td>

                          {/* ASSISTANT FACULTY CELL - BLACK CELL FOR 0 LAB COURSES AS REQUESTED */}
                          {hasLab ? (
                            <td className="border border-slate-300 px-3 py-2 text-slate-700 font-medium">
                              {alloc.asstFacultyName || <span className="text-amber-600 italic">Pending Asst</span>}
                            </td>
                          ) : (
                            <td className="border border-slate-900 bg-[#0f172a] text-slate-400 font-mono text-[10px] text-center uppercase tracking-wider py-2">
                              — NO LAB / NO ASST —
                            </td>
                          )}

                          <td className="border border-slate-300 px-3 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                alloc.status === 'FINALIZED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : alloc.mainFacultyId
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {alloc.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 5. NEW ALLOCATION MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={isNewAllocModalOpen} onOpenChange={setIsNewAllocModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-teal-600" />
              Add Class Allocation
            </DialogTitle>
            <DialogDescription>
              Create a new course offering and assign faculty members with live deduction tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Course</label>
              <select
                value={newCourseCode}
                onChange={(e) => {
                  setNewCourseCode(e.target.value);
                  const c = courseList.find((x) => x.code === e.target.value);
                  if (c) {
                    setNewTheoryHours(c.theoryHours_L);
                    setNewPracticalHours(c.practicalHours_P);
                  }
                }}
                className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
              >
                {courseList.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} - {c.title} ({c.programme} Sem {c.semester})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Section</label>
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                >
                  {sectionList.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Students</label>
                <Input
                  type="number"
                  value={newStudents}
                  onChange={(e) => setNewStudents(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Theory (Hrs)</label>
                <Input
                  type="number"
                  value={newTheoryHours}
                  onChange={(e) => setNewTheoryHours(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Practical (Hrs)</label>
                <Input
                  type="number"
                  value={newPracticalHours}
                  onChange={(e) => setNewPracticalHours(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Main Faculty (Theory &amp; Lab)</label>
              <select
                value={newMainFacultyId}
                onChange={(e) => setNewMainFacultyId(e.target.value)}
                className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
              >
                <option value="">-- Select Main Faculty --</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsNewAllocModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateNewAllocation} className="bg-[#002147] text-white">
                Create Allocation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
