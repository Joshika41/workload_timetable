import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkloadData } from '@/lib/workload-store';
import { WorkloadStatusBadge } from '@/components/WorkloadStatusBadge';
import { exportFacultyWorkloadToExcel, exportCourseAllocationToExcel } from '@/lib/excel-export';
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
  Users,
  BookOpen,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  TrendingUp,
  Search,
  Filter,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet,
  Download,
  Building,
  Check,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/')({
  component: HodDashboardPage,
});

function HodDashboardPage() {
  const navigate = useNavigate();
  const {
    facultyList,
    courseList,
    sectionList,
    allocations,
    allWorkloads,
    dashboardMetrics,
    updateFacultyDefaultHours,
  } = useWorkloadData();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNDERLOADED' | 'BALANCED' | 'OVERLOADED'>('ALL');
  const [programmeFilter, setProgrammeFilter] = useState<string>('ALL');

  // Faculty Detail Modal State
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);
  const selectedWorkload = allWorkloads.find((w) => w.facultyId === selectedFacultyId);

  // Edit Default Hours State inside modal
  const [editingDefaultHours, setEditingDefaultHours] = useState<number | null>(null);

  // Filtered Faculty List
  const filteredWorkloads = allWorkloads.filter((w) => {
    const matchesSearch =
      w.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.facultyId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || w.status === statusFilter;
    const matchesProg = programmeFilter === 'ALL' || w.programme === programmeFilter;

    return matchesSearch && matchesStatus && matchesProg;
  });

  const handleExportFaculty = () => {
    exportFacultyWorkloadToExcel(allWorkloads);
    toast.success('Faculty Workload Excel exported successfully!');
  };

  const handleExportCourses = () => {
    exportCourseAllocationToExcel(allocations);
    toast.success('Course-wise Allocation Excel exported successfully!');
  };

  const handleSaveDefaultHours = () => {
    if (selectedFacultyId && editingDefaultHours !== null) {
      updateFacultyDefaultHours(selectedFacultyId, editingDefaultHours);
      toast.success('Default workload hours updated successfully');
      setEditingDefaultHours(null);
    }
  };

  return (
    <WorkloadShell
      role="admin"
      title="HOD Reviewer Console"
      subtitle="Faculty Subject Preference Review, Workload Configuration & Real-Time Allocation Management"
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportFaculty}
            className="h-8 gap-1.5 text-xs border-slate-300 bg-white hover:bg-slate-100 text-slate-800"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" />
            <span>Export Faculty Workload</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate({ to: '/admin/allocation' })}
            className="h-8 gap-1.5 text-xs bg-[#002147] hover:bg-[#001833] text-white"
          >
            <SlidersHorizontal className="size-3.5 text-teal-300" />
            <span>Open Course Allocation</span>
          </Button>
        </>
      }
    >
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. DARK BLUE INSTITUTIONAL HERO SECTION */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[#002147] text-white p-6 shadow-md border border-blue-900/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30 rounded uppercase tracking-wider">
                Department of Computer Applications
              </span>
              <span className="text-xs text-blue-200">· MCA &amp; MCA GEN AI</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Academic Workload &amp; Preference Management
            </h2>
            <p className="text-xs sm:text-sm text-blue-200/90 max-w-2xl leading-relaxed">
              Real-time oversight of faculty subject preferences, section allocations, and dynamic workload calculations according to SRM 2025 Syllabus standards.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm p-3.5 rounded-lg border border-white/10 shrink-0">
            <div className="text-center px-3 border-r border-white/10">
              <p className="text-[10px] uppercase font-bold text-teal-300">Coverage</p>
              <p className="text-2xl font-extrabold text-white">
                {dashboardMetrics.allocationCoveragePercentage}%
              </p>
            </div>
            <div className="text-xs space-y-1">
              <p className="text-blue-100 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400"></span>
                <span className="font-semibold">{dashboardMetrics.allocatedHours} hrs</span> allocated
              </p>
              <p className="text-blue-200 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-400"></span>
                <span className="font-semibold">{dashboardMetrics.unallocatedHours} hrs</span> unallocated
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. TOP SUMMARY METRICS CARDS (Section 6 & 43 of Prompt) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* TOTAL FACULTY */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Faculty
            </p>
            <p className="text-xl font-black text-slate-900 mt-1">
              {dashboardMetrics.totalFaculty}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">18 Seeded Staff</p>
          </div>

          {/* TOTAL SUBJECTS */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Subjects
            </p>
            <p className="text-xl font-black text-blue-700 mt-1">
              {dashboardMetrics.totalCourses}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">2025 Syllabus</p>
          </div>

          {/* TOTAL SECTIONS */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Total Sections
            </p>
            <p className="text-xl font-black text-slate-900 mt-1">
              {dashboardMetrics.totalSections}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">MCA &amp; Gen AI</p>
          </div>

          {/* PREFERENCE SUBMITTED */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Pref Submitted
            </p>
            <p className="text-xl font-black text-emerald-600 mt-1">
              {dashboardMetrics.submittedPreferences}
            </p>
            <p className="text-[10px] text-emerald-600/70 mt-0.5 font-mono">Willingness Cart</p>
          </div>

          {/* PREFERENCE PENDING */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Pref Pending
            </p>
            <p className="text-xl font-black text-amber-600 mt-1">
              {dashboardMetrics.pendingPreferences}
            </p>
            <p className="text-[10px] text-amber-600/70 mt-0.5 font-mono">Awaiting Cart</p>
          </div>

          {/* ALLOCATED SUBJECTS */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Allocated Subjects
            </p>
            <p className="text-xl font-black text-blue-600 mt-1">
              {allocations.filter((a) => a.mainFacultyId).length}
            </p>
            <p className="text-[10px] text-blue-600/70 mt-0.5 font-mono">Main Assigned</p>
          </div>

          {/* UNALLOCATED SUBJECTS */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
              Unallocated
            </p>
            <p className="text-xl font-black text-rose-600 mt-1">
              {allocations.filter((a) => !a.mainFacultyId).length}
            </p>
            <p className="text-[10px] text-rose-600/70 mt-0.5 font-mono">Pending Faculty</p>
          </div>

          {/* WORKLOAD RECONCILIATED */}
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
              Reconciled
            </p>
            <p className="text-xl font-black text-teal-600 mt-1">
              {allocations.filter((a) => a.status === 'FINALIZED' || a.status === 'RECONCILED').length}
            </p>
            <p className="text-[10px] text-teal-600/70 mt-0.5 font-mono">Finalized Offerings</p>
          </div>
        </div>

        {/* WORKLOAD SUMMARY ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">UNDERLOADED</p>
              <p className="text-lg font-black text-amber-600">{dashboardMetrics.underloadedCount} Faculty</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">&lt; Target limit</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">BALANCED</p>
              <p className="text-lg font-black text-emerald-600">{dashboardMetrics.balancedCount} Faculty</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">100% Target Match</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">OVERLOADED</p>
              <p className="text-lg font-black text-rose-600">{dashboardMetrics.overloadedCount} Faculty</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">&gt; Target limit</span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">CAMPUS WORK</p>
              <p className="text-lg font-black text-teal-700">
                {allWorkloads.filter((w) => w.campusWorkHours > 0).length} Faculty ({allWorkloads.reduce((sum, w) => sum + w.campusWorkHours, 0)}h)
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Admin Duties</span>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. MAIN FACULTY WORKLOAD DATA TABLE */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[#002147]" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Faculty Workload Status &amp; Preferences Overview
            </h3>
            <span className="text-xs text-slate-500 font-mono">({filteredWorkloads.length} faculty)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                placeholder="Search staff name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs bg-white rounded-md"
              />
            </div>

            {/* Programme Filter */}
            <select
              value={programmeFilter}
              onChange={(e) => setProgrammeFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
            >
              <option value="ALL">All Programmes</option>
              <option value="MCA">MCA</option>
              <option value="MCA GEN AI">MCA GEN AI</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNDERLOADED">Underloaded</option>
              <option value="BALANCED">Balanced</option>
              <option value="OVERLOADED">Overloaded</option>
            </select>
          </div>
        </div>

        {/* Dense Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-[11px] font-bold text-slate-600 bg-slate-100 uppercase border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Faculty Member</th>
                <th className="px-3.5 py-2.5">Designation</th>
                <th className="px-3.5 py-2.5">Programme</th>
                <th className="px-3.5 py-2.5 text-center">Default Hrs</th>
                <th className="px-3.5 py-2.5 text-center">Allocated Hrs</th>
                <th className="px-3.5 py-2.5 text-center">Remaining</th>
                <th className="px-3.5 py-2.5 text-center">Subjects</th>
                <th className="px-3.5 py-2.5 text-center">Workload Status</th>
                <th className="px-3.5 py-2.5 text-center">Preferences</th>
                <th className="px-3.5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredWorkloads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No faculty found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredWorkloads.map((w) => (
                  <tr
                    key={w.facultyId}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedFacultyId(w.facultyId)}
                  >
                    {/* Faculty Name & ID */}
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                          {w.facultyName.charAt(3) || 'F'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{w.facultyName}</p>
                          <p className="font-mono text-[10px] text-slate-500">{w.facultyId}</p>
                        </div>
                      </div>
                    </td>

                    {/* Designation */}
                    <td className="px-3.5 py-2.5 text-slate-600">{w.designation}</td>

                    {/* Programme */}
                    <td className="px-3.5 py-2.5">
                      <span className="font-medium text-slate-700">{w.programme}</span>
                    </td>

                    {/* Default Hours */}
                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-700">
                      {w.defaultHours}h
                    </td>

                    {/* Allocated Hours */}
                    <td className="px-3.5 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded font-mono font-bold text-slate-900 bg-slate-100">
                        {w.allocatedHours}h
                      </span>
                    </td>

                    {/* Remaining Hours */}
                    <td className="px-3.5 py-2.5 text-center font-mono">
                      {w.remainingHours > 0 ? (
                        <span className="text-amber-700 font-bold">{w.remainingHours}h remaining</span>
                      ) : w.overloadHours > 0 ? (
                        <span className="text-rose-700 font-bold">+{w.overloadHours}h overload</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">Exact (0h)</span>
                      )}
                    </td>

                    {/* Subject Count */}
                    <td className="px-3.5 py-2.5 text-center font-semibold text-slate-700">
                      {w.allocatedCoursesCount}
                    </td>

                    {/* Workload Status */}
                    <td className="px-3.5 py-2.5 text-center">
                      <WorkloadStatusBadge status={w.status} size="sm" />
                    </td>

                    {/* Preference Status */}
                    <td className="px-3.5 py-2.5 text-center">
                      <WorkloadStatusBadge status={w.preferencesStatus} size="sm" />
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFacultyId(w.facultyId);
                        }}
                        className="h-7 px-2 text-xs text-[#002147] hover:bg-blue-100 hover:text-blue-900 gap-1"
                      >
                        <Eye className="size-3.5" />
                        <span>View</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. FACULTY WORKLOAD DETAIL MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedFacultyId} onOpenChange={(open) => !open && setSelectedFacultyId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">
                {selectedWorkload?.facultyName}
              </span>
              {selectedWorkload && <WorkloadStatusBadge status={selectedWorkload.status} />}
            </DialogTitle>
            <DialogDescription>
              {selectedWorkload?.designation} · {selectedWorkload?.programme} · Faculty ID: {selectedWorkload?.facultyId}
            </DialogDescription>
          </DialogHeader>

          {selectedWorkload && (
            <div className="space-y-4 py-2 text-xs">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Default Limit</p>
                  <p className="text-lg font-black text-slate-800">{selectedWorkload.defaultHours} hrs</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Allocated</p>
                  <p className="text-lg font-black text-blue-700">{selectedWorkload.allocatedHours} hrs</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Theory / Lab</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    {selectedWorkload.theoryHours}h (T) + {selectedWorkload.practicalHours}h (L)
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Remaining</p>
                  <p className="text-lg font-black text-amber-700">{selectedWorkload.remainingHours} hrs</p>
                </div>
              </div>

              {/* Configure Default Workload Hours (Editable by HOD) */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-blue-900">Configurable Default Workload Limit</p>
                  <p className="text-[11px] text-blue-700">
                    Adjust official default weekly hours for this faculty profile.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={editingDefaultHours ?? selectedWorkload.defaultHours}
                    onChange={(e) => setEditingDefaultHours(Number(e.target.value))}
                    className="h-8 rounded border border-blue-300 bg-white px-2 text-xs font-bold text-blue-900"
                  >
                    <option value={18}>18 Hours (Prof / AP Regular)</option>
                    <option value={16}>16 Hours (Adjunct)</option>
                    <option value={14}>14 Hours (Lead)</option>
                    <option value={10}>10 Hours (FTS)</option>
                    <option value={4}>4 Hours (AP/BSc. CS)</option>
                  </select>
                  {editingDefaultHours !== null && editingDefaultHours !== selectedWorkload.defaultHours && (
                    <Button size="sm" onClick={handleSaveDefaultHours} className="h-8 px-2.5 text-xs bg-blue-700">
                      Save
                    </Button>
                  )}
                </div>
              </div>

              {/* Allocated Courses List */}
              <div className="space-y-2">
                <p className="font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                  Allocated Courses ({selectedWorkload.allocatedSubjects.length})
                </p>
                {selectedWorkload.allocatedSubjects.length === 0 ? (
                  <p className="p-3 bg-slate-100 rounded text-slate-500 text-center">
                    No teaching courses currently assigned.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {selectedWorkload.allocatedSubjects.map((sub, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                              {sub.courseCode}
                            </span>
                            <span className="font-semibold text-slate-900">{sub.courseTitle}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Section: <strong className="text-slate-700">{sub.section}</strong> · Students: {sub.studentCount} · Role: {sub.role}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {sub.theoryHours}h Th + {sub.practicalHours}h Lab
                          </span>
                          <p className="text-[10px] text-slate-400 font-mono">Total: {sub.totalHours} hrs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preferences List */}
              <div className="space-y-2 pt-1">
                <p className="font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                  Faculty Preferences Submitted
                </p>
                {selectedWorkload.preferencesStatus === 'PENDING' ? (
                  <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
                    <Clock className="size-4 text-amber-600 shrink-0" />
                    <span>This faculty member has not submitted their subject preferences yet.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedWorkload.allocatedSubjects.length > 0 && (
                      <p className="text-[11px] text-slate-500 italic">
                        Preferences submitted by faculty during the willingness collection window:
                      </p>
                    )}
                    {/* Render from store preferences */}
                    <div className="grid gap-1.5">
                      <div className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <span className="font-semibold text-slate-800">1. Preferred Subjects Cart</span>
                        <WorkloadStatusBadge status="SUBMITTED" size="sm" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
