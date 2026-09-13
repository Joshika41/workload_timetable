import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkloadData } from '@/lib/workload-store';
import { WorkloadStatusBadge } from '@/components/WorkloadStatusBadge';
import { COURSE_CATEGORIES } from '@/lib/workload-types';
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
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  SlidersHorizontal,
  Users,
  Sparkles,
  BookOpen,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/preferences')({
  component: AdminPreferencesReviewPage,
});

function AdminPreferencesReviewPage() {
  const {
    allWorkloads,
    preferences,
    courseList,
  } = useWorkloadData();

  const [searchTerm, setSearchTerm] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'PENDING'>('ALL');

  // Selected faculty modal
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);
  const selectedFacultyWorkload = allWorkloads.find((w) => w.facultyId === selectedFacultyId);
  const selectedSubmission = selectedFacultyId ? preferences[selectedFacultyId] : null;

  // Compute summary stats
  const totalFaculty = allWorkloads.length;
  const submittedCount = allWorkloads.filter((w) => w.preferencesStatus === 'SUBMITTED').length;
  const pendingCount = allWorkloads.filter((w) => w.preferencesStatus === 'PENDING').length;
  const allocatedCount = allWorkloads.filter((w) => w.allocatedCoursesCount > 0).length;

  // Filtered rows
  const filteredRows = allWorkloads.filter((w) => {
    const matchesSearch =
      w.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.facultyId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProg = programmeFilter === 'ALL' || w.programme === programmeFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SUBMITTED' && w.preferencesStatus === 'SUBMITTED') ||
      (statusFilter === 'PENDING' && w.preferencesStatus === 'PENDING');

    return matchesSearch && matchesProg && matchesStatus;
  });

  return (
    <WorkloadShell
      role="admin"
      title="Faculty Preference Review"
      subtitle="Examine faculty subject willingness, ranked course selections, and submission statuses"
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
        </div>
      }
    >
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. TOP SUMMARY CARDS (Exact prompt section 16 values) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* TOTAL FACULTY */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Total Faculty
          </p>
          <p className="text-3xl font-black text-slate-900 mt-1">{totalFaculty}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">MCA Department</p>
        </div>

        {/* SUBMITTED */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Submitted
          </p>
          <p className="text-3xl font-black text-blue-700 mt-1">{submittedCount}</p>
          <p className="text-[11px] text-blue-600/80 mt-0.5">Preferences Received</p>
        </div>

        {/* PENDING */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Pending
          </p>
          <p className="text-3xl font-black text-amber-600 mt-1">{pendingCount}</p>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Awaiting Submission</p>
        </div>

        {/* ALLOCATED */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Allocated
          </p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{allocatedCount}</p>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Assigned Teaching</p>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. TABLE & FILTER CONTROLS */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-[#002147]" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Faculty Preference Carts &amp; Allocation Status
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <Input
                placeholder="Search faculty name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs bg-white rounded-md"
              />
            </div>

            <select
              value={programmeFilter}
              onChange={(e) => setProgrammeFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            >
              <option value="ALL">All Programmes</option>
              <option value="MCA">MCA</option>
              <option value="MCA GEN AI">MCA GEN AI</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            >
              <option value="ALL">All Submission Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-[11px] font-bold text-slate-600 bg-slate-100 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Faculty</th>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Submitted Preferences</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Default Hrs</th>
                <th className="px-4 py-3 text-center">Allocated</th>
                <th className="px-4 py-3 text-center">Remaining</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No faculty records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((w) => {
                  const sub = preferences[w.facultyId];
                  const hasPrefs = sub && sub.preferences.length > 0;

                  return (
                    <tr
                      key={w.facultyId}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      {/* Faculty Name */}
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <p className="font-bold text-slate-900">{w.facultyName}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{w.designation} · {w.facultyId}</p>
                      </td>

                      {/* Programme */}
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {w.programme}
                      </td>

                      {/* Preferences List Pills */}
                      <td className="px-4 py-3 max-w-xs">
                        {hasPrefs ? (
                          <div className="flex flex-wrap gap-1">
                            {sub.preferences.slice(0, 3).map((p) => (
                              <span
                                key={p.courseCode}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-900 font-mono text-[10px]"
                                title={p.courseTitle}
                              >
                                <strong className="text-blue-700 font-bold">#{p.rank}</strong>
                                <span>{p.courseCode}</span>
                              </span>
                            ))}
                            {sub.preferences.length > 3 && (
                              <span className="text-[10px] text-slate-400 font-semibold self-center">
                                +{sub.preferences.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            No preferences submitted
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <WorkloadStatusBadge status={w.preferencesStatus} size="sm" />
                      </td>

                      {/* Default */}
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-700">
                        {w.defaultHours}h
                      </td>

                      {/* Allocated */}
                      <td className="px-4 py-3 text-center font-mono font-bold text-blue-700">
                        {w.allocatedHours}h
                      </td>

                      {/* Remaining */}
                      <td className="px-4 py-3 text-center font-mono font-bold text-amber-700">
                        {w.remainingHours}h
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedFacultyId(w.facultyId)}
                          className="h-7 px-2.5 text-xs text-[#002147] border-blue-200 bg-white hover:bg-blue-50 gap-1"
                        >
                          <Eye className="size-3.5" />
                          <span>VIEW</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. FACULTY PREFERENCES DETAIL DIALOG */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedFacultyId} onOpenChange={(open) => !open && setSelectedFacultyId(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedFacultyWorkload?.facultyName} — Preferences</span>
              {selectedFacultyWorkload && (
                <WorkloadStatusBadge status={selectedFacultyWorkload.preferencesStatus} />
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedFacultyWorkload?.designation} · {selectedFacultyWorkload?.programme} · Submitted:{' '}
              {selectedSubmission?.submittedAt || 'Pending'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Workload Status</p>
                <p className="font-bold text-slate-800 text-sm">
                  {selectedFacultyWorkload?.allocatedHours}h / {selectedFacultyWorkload?.defaultHours}h (Allocated / Default)
                </p>
              </div>
              <WorkloadStatusBadge status={selectedFacultyWorkload?.status || 'UNDERLOADED'} />
            </div>

            <div className="space-y-2">
              <p className="font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                Ranked Subject Preferences
              </p>

              {!selectedSubmission || selectedSubmission.preferences.length === 0 ? (
                <p className="p-4 rounded bg-slate-100 text-slate-500 text-center">
                  This faculty has not selected any preferences yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border rounded-lg overflow-hidden">
                  {selectedSubmission.preferences.map((pref) => {
                    const course = courseList.find((c) => c.code === pref.courseCode);
                    const catInfo = course ? COURSE_CATEGORIES[course.category] : null;

                    return (
                      <div key={pref.courseCode} className="p-3 flex items-center justify-between hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <span className="size-6 rounded-full bg-[#002147] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {pref.rank}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                                {pref.courseCode}
                              </span>
                              <span className="font-bold text-slate-900">{pref.courseTitle}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {catInfo?.name} · Credits: {pref.credits} · Theory: {pref.theoryHours}h · Lab: {pref.practicalHours}h
                            </p>
                          </div>
                        </div>

                        <span className="font-bold text-xs text-slate-700">
                          Rank #{pref.rank}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setSelectedFacultyId(null)}
                className="text-xs"
              >
                Close View
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
