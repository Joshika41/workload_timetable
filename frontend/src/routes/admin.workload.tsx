import { createFileRoute } from '@tanstack/react-router';
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
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Users,
  BookOpen,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building,
  Plus,
  Trash2,
  Briefcase,
  Eye,
  Edit2,
  Clock,
  Check,
  X,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/workload')({
  component: AdminWorkloadSheetsPage,
});

function AdminWorkloadSheetsPage() {
  const {
    allWorkloads,
    allocations,
    facultyList,
    campusWorkList,
    addCampusWork,
    removeCampusWork,
    updateFacultyDefaultHours,
  } = useWorkloadData();

  // Tab: "faculty-ledger" (Faculty Workload Ledger) vs "official-sheet" (Institutional Statement)
  const [activeSheetTab, setActiveSheetTab] = useState<'faculty-ledger' | 'official-sheet'>('faculty-ledger');

  const [searchTerm, setSearchTerm] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNDERLOADED' | 'BALANCED' | 'OVERLOADED'>('ALL');

  // Campus Work Modal State
  const [isCampusWorkModalOpen, setIsCampusWorkModalOpen] = useState(false);
  const [campusFacultyId, setCampusFacultyId] = useState<string>(facultyList[0]?.id || 'FAC001');
  const [campusHours, setCampusHours] = useState<number>(4);
  const [campusDescription, setCampusDescription] = useState<string>('Department Administration');

  // Selected Faculty Detail Modal
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);
  const selectedWorkload = allWorkloads.find((w) => w.facultyId === selectedFacultyId);

  // Edit target hours state inside detail modal
  const [editingTargetHours, setEditingTargetHours] = useState<number | null>(null);

  // Filtered workloads
  const filteredWorkloads = allWorkloads.filter((w) => {
    const matchesSearch =
      w.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.facultyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.designation.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProg = programmeFilter === 'ALL' || w.programme === programmeFilter;
    const matchesStatus = statusFilter === 'ALL' || w.status === statusFilter;

    return matchesSearch && matchesProg && matchesStatus;
  });

  const handleExportFaculty = () => {
    exportFacultyWorkloadToExcel(allWorkloads);
    toast.success('Faculty Workload Excel sheet exported successfully!');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveCampusWork = () => {
    if (!campusFacultyId || campusHours <= 0 || !campusDescription.trim()) {
      toast.error('Please enter valid campus work hours and description');
      return;
    }
    addCampusWork({
      facultyId: campusFacultyId,
      hours: campusHours,
      description: campusDescription.trim(),
    });

    const fac = facultyList.find((f) => f.id === campusFacultyId);
    toast.success(`Added ${campusHours}h campus work for ${fac?.name}`);
    setIsCampusWorkModalOpen(false);
  };

  const handleSaveTargetHours = () => {
    if (selectedFacultyId && editingTargetHours !== null) {
      updateFacultyDefaultHours(selectedFacultyId, editingTargetHours);
      toast.success('Faculty workload target hours updated successfully');
      setEditingTargetHours(null);
    }
  };

  return (
    <WorkloadShell
      role="admin"
      title="Faculty Workload Ledger & Reports"
      subtitle="Complete institutional workload ledger including teaching allocations, campus work, and live reconciliation"
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
            onClick={() => setIsCampusWorkModalOpen(true)}
            className="h-8 gap-1.5 text-xs bg-teal-700 hover:bg-teal-800 text-white font-bold"
          >
            <Plus className="size-3.5" />
            <span>Add Campus Work</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-8 gap-1 text-xs border-slate-300 bg-white hover:bg-slate-100"
          >
            <Printer className="size-3.5 text-slate-700" />
            <span className="hidden sm:inline">Print / PDF</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportFaculty}
            className="h-8 gap-1.5 text-xs bg-[#002147] text-white"
          >
            <Download className="size-3.5 text-teal-300" />
            <span>Export Workload (.xlsx)</span>
          </Button>
        </div>
      }
    >
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. TAB SWITCHER & FILTERS */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveSheetTab('faculty-ledger')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSheetTab === 'faculty-ledger'
                ? 'bg-[#002147] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="size-3.5" />
            Faculty Workload Ledger
          </button>

          <button
            onClick={() => setActiveSheetTab('official-sheet')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSheetTab === 'official-sheet'
                ? 'bg-[#002147] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="size-3.5" />
            Official Workload Statement
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
            <Input
              placeholder="Search faculty name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-7 text-xs bg-slate-50"
            />
          </div>

          <select
            value={programmeFilter}
            onChange={(e) => setProgrammeFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
          >
            <option value="ALL">All Programmes</option>
            <option value="MCA">MCA</option>
            <option value="MCA GEN AI">MCA GEN AI</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="UNDERLOADED">Underloaded</option>
            <option value="BALANCED">Balanced</option>
            <option value="OVERLOADED">Overloaded</option>
          </select>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. TAB A: FACULTY WORKLOAD LEDGER TABLE (Section 23 of prompt) */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeSheetTab === 'faculty-ledger' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Faculty Workload Master Ledger
              </h3>
              <p className="text-xs text-slate-500">
                Formula: <strong className="text-blue-900">Total Credited = Teaching Hours + Campus Work Hours</strong>
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 font-bold">
              {filteredWorkloads.length} Faculty Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
              <thead className="text-[11px] font-bold text-slate-600 bg-slate-100 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5 text-center w-12">S.No</th>
                  <th className="px-3.5 py-2.5">Faculty Name</th>
                  <th className="px-3.5 py-2.5">Designation</th>
                  <th className="px-3.5 py-2.5 text-center">Target Hours</th>
                  <th className="px-3.5 py-2.5 text-center">Teaching Hours</th>
                  <th className="px-3.5 py-2.5 text-center">Campus Work</th>
                  <th className="px-3.5 py-2.5 text-center">Total Credited</th>
                  <th className="px-3.5 py-2.5 text-center">Remaining</th>
                  <th className="px-3.5 py-2.5 text-center">Excess</th>
                  <th className="px-3.5 py-2.5 text-center">Utilization %</th>
                  <th className="px-3.5 py-2.5 text-center">Status</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredWorkloads.map((w, idx) => (
                  <tr
                    key={w.facultyId}
                    onClick={() => setSelectedFacultyId(w.facultyId)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                  >
                    <td className="px-3.5 py-2.5 text-center font-bold text-slate-700 font-mono">
                      {idx + 1}
                    </td>

                    <td className="px-3.5 py-2.5 font-bold text-slate-900">
                      {w.facultyName}
                      <span className="block text-[10px] text-slate-500 font-mono font-normal">
                        {w.facultyId} · {w.programme}
                      </span>
                    </td>

                    <td className="px-3.5 py-2.5 text-slate-600">{w.designation}</td>

                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-700">
                      {w.defaultHours}h
                    </td>

                    <td className="px-3.5 py-2.5 text-center font-mono font-semibold text-blue-800">
                      {w.teachingHours}h
                    </td>

                    <td className="px-3.5 py-2.5 text-center font-mono font-semibold text-teal-700">
                      {w.campusWorkHours > 0 ? `${w.campusWorkHours}h` : '-'}
                    </td>

                    <td className="px-3.5 py-2.5 text-center font-mono font-black text-slate-900 bg-slate-50">
                      {w.allocatedHours}h
                    </td>

                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-amber-700">
                      {w.remainingHours}h
                    </td>

                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-rose-700">
                      {w.overloadHours > 0 ? `+${w.overloadHours}h` : '0h'}
                    </td>

                    <td className="px-3.5 py-2.5 text-center font-mono font-bold text-slate-800">
                      {w.utilizationPercentage}%
                    </td>

                    <td className="px-3.5 py-2.5 text-center">
                      <WorkloadStatusBadge status={w.status} size="sm" />
                    </td>

                    <td className="px-3.5 py-2.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFacultyId(w.facultyId);
                        }}
                        className="h-7 px-2.5 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        <Eye className="size-3.5 mr-1" /> View Breakdown
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. TAB B: OFFICIAL WORKLOAD STATEMENT (Section 25 format) */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeSheetTab === 'official-sheet' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden p-6 space-y-6">
          <div className="text-center space-y-1 border-b pb-4">
            <h2 className="font-bold text-sm text-slate-800 tracking-wider uppercase">
              SRM INSTITUTE OF SCIENCE AND TECHNOLOGY
            </h2>
            <h3 className="font-extrabold text-base text-[#002147]">
              DEPARTMENT OF COMPUTER APPLICATIONS — MCA &amp; MCA GEN AI
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              FACULTY-WISE TEACHING WORKLOAD STATEMENT · ODD SEMESTER 2026-2027
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-300 border-collapse min-w-[900px]">
              <thead className="bg-slate-100 text-[11px] font-bold text-slate-800 border-b border-slate-300 uppercase">
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-center w-12">S.No</th>
                  <th className="border border-slate-300 px-3 py-2">Staff Name</th>
                  <th className="border border-slate-300 px-3 py-2">Subject Code</th>
                  <th className="border border-slate-300 px-3 py-2">Course Name</th>
                  <th className="border border-slate-300 px-3 py-2">Class / Sec</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">Theory</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">Practical</th>
                  <th className="border border-slate-300 px-3 py-2 text-center">Credited</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkloads.map((faculty, fIdx) => {
                  const subjectRows = faculty.allocatedSubjects;
                  const rowCount = Math.max(1, subjectRows.length);

                  return (
                    <tbody key={faculty.facultyId} className="border-b-2 border-slate-300">
                      {subjectRows.length === 0 ? (
                        <tr>
                          <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700">{fIdx + 1}</td>
                          <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900">{faculty.facultyName}</td>
                          <td colSpan={6} className="border border-slate-300 px-3 py-2 text-center text-slate-400 italic">No teaching courses assigned</td>
                        </tr>
                      ) : (
                        subjectRows.map((sub, sIdx) => (
                          <tr key={sIdx} className="hover:bg-slate-50">
                            {sIdx === 0 && (
                              <td rowSpan={rowCount} className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700 align-top bg-slate-50/50">
                                {fIdx + 1}
                              </td>
                            )}
                            {sIdx === 0 && (
                              <td rowSpan={rowCount} className="border border-slate-300 px-3 py-2 font-bold text-slate-900 align-top bg-slate-50/50">
                                {faculty.facultyName}
                                <span className="block text-[10px] text-slate-500 font-normal">{faculty.designation}</span>
                              </td>
                            )}
                            <td className="border border-slate-300 px-3 py-2 font-mono font-bold text-blue-700">{sub.courseCode}</td>
                            <td className="border border-slate-300 px-3 py-2 font-semibold text-slate-800">{sub.courseTitle}</td>
                            <td className="border border-slate-300 px-3 py-2 font-medium text-slate-700">{sub.section}</td>
                            <td className="border border-slate-300 px-3 py-2 text-center font-mono">{sub.theoryHours}</td>
                            <td className="border border-slate-300 px-3 py-2 text-center font-mono">{sub.practicalHours}</td>
                            <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold text-slate-900 bg-slate-50">{sub.totalHours}</td>
                          </tr>
                        ))
                      )}

                      {/* Summary Subtotal Row */}
                      <tr className="bg-slate-100 font-bold text-slate-900 text-[11px]">
                        <td colSpan={5} className="border border-slate-300 px-3 py-2 text-right uppercase">
                          TOTAL FOR {faculty.facultyName} (TARGET: {faculty.defaultHours}H)
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono">{faculty.theoryHours}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono">{faculty.practicalHours}</td>
                        <td className="border border-slate-300 px-3 py-2 text-center font-mono font-black text-blue-900 bg-blue-100">
                          {faculty.allocatedHours} hrs
                        </td>
                      </tr>
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. FACULTY WORKLOAD DETAIL BREAKDOWN MODAL (Section 24) */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedFacultyId} onOpenChange={(open) => !open && setSelectedFacultyId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="text-base font-extrabold text-slate-900">
                {selectedWorkload?.facultyName}
              </span>
              {selectedWorkload && <WorkloadStatusBadge status={selectedWorkload.status} />}
            </DialogTitle>
            <DialogDescription>
              {selectedWorkload?.designation} · {selectedWorkload?.programme} · ID: {selectedWorkload?.facultyId}
            </DialogDescription>
          </DialogHeader>

          {selectedWorkload && (
            <div className="space-y-4 py-2 text-xs">
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Target Workload</p>
                  <p className="text-lg font-black text-slate-800">{selectedWorkload.defaultHours} hrs</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Teaching Hours</p>
                  <p className="text-lg font-black text-blue-700">{selectedWorkload.teachingHours} hrs</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Campus Work</p>
                  <p className="text-lg font-black text-teal-700">{selectedWorkload.campusWorkHours} hrs</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Credited</p>
                  <p className="text-lg font-black text-slate-900">{selectedWorkload.allocatedHours} hrs</p>
                </div>
              </div>

              {/* Teaching Allocation Breakdown */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-600 text-[11px]">
                  TEACHING ALLOCATION
                </h4>
                {selectedWorkload.allocatedSubjects.length === 0 ? (
                  <p className="p-3 bg-slate-50 border rounded text-slate-400 text-center italic">
                    No teaching subjects assigned.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {selectedWorkload.allocatedSubjects.map((sub, i) => (
                      <div key={i} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] mr-2">
                            {sub.courseCode}
                          </span>
                          <span className="font-semibold text-slate-900">{sub.courseTitle}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Section: <strong>{sub.section}</strong> · Role: <strong>{sub.role}</strong>
                          </p>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-900 text-xs">
                            {sub.theoryHours}h (T) + {sub.practicalHours}h (P)
                          </span>
                          <p className="text-[10px] text-slate-500 font-bold">Total: {sub.totalHours} hrs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campus Work List */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold uppercase tracking-wider text-teal-800 text-[11px]">
                    CAMPUS WORK RESPONSIBILITIES
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCampusFacultyId(selectedWorkload.facultyId);
                      setIsCampusWorkModalOpen(true);
                    }}
                    className="h-6 px-2 text-[11px] border-teal-300 text-teal-800 bg-teal-50"
                  >
                    + Add Campus Work
                  </Button>
                </div>

                {selectedWorkload.campusWorkEntries.length === 0 ? (
                  <p className="p-3 bg-slate-50 border rounded text-slate-400 text-center italic">
                    No administrative or campus work duties assigned.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                    {selectedWorkload.campusWorkEntries.map((cw) => (
                      <div key={cw.id} className="p-2.5 flex items-center justify-between bg-teal-50/30">
                        <div>
                          <p className="font-bold text-slate-900">{cw.description}</p>
                          <p className="text-[10px] text-teal-700">Institutional / Department Duty</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-extrabold text-teal-900">{cw.hours} hrs</span>
                          <button
                            onClick={() => {
                              removeCampusWork(cw.id);
                              toast.success('Campus work entry removed');
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Workload Reconciliation */}
              <div className="p-3 bg-slate-900 text-white rounded-lg flex items-center justify-between text-xs">
                <span>
                  Target: <strong>{selectedWorkload.defaultHours}h</strong> · Credited: <strong>{selectedWorkload.allocatedHours}h</strong>
                </span>
                <span className="font-bold text-teal-300">
                  {selectedWorkload.remainingHours > 0
                    ? `${selectedWorkload.remainingHours}h UNDERLOADED`
                    : selectedWorkload.overloadHours > 0
                    ? `+${selectedWorkload.overloadHours}h OVERLOADED`
                    : '✓ RECONCILED & BALANCED'}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 5. ADD CAMPUS WORK MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={isCampusWorkModalOpen} onOpenChange={setIsCampusWorkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-800">
              <Briefcase className="size-5 text-teal-600" /> Add Campus Work Responsibility
            </DialogTitle>
            <DialogDescription>
              Campus work hours contribute to total credited workload (e.g. HOD duties, committee work, examination work).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Faculty Member</label>
              <select
                value={campusFacultyId}
                onChange={(e) => setCampusFacultyId(e.target.value)}
                className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold"
              >
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.designation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Campus Work Hours</label>
              <Input
                type="number"
                value={campusHours}
                onChange={(e) => setCampusHours(Number(e.target.value))}
                className="h-8 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Campus Work Description / Remark</label>
              <Input
                value={campusDescription}
                onChange={(e) => setCampusDescription(e.target.value)}
                placeholder="e.g., Department Administration, Placement Officer"
                className="h-8 text-xs"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCampusWorkModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveCampusWork} className="bg-teal-700 hover:bg-teal-800 text-white font-bold">
                Save Campus Work
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
