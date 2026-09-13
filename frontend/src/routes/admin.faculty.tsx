import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkloadData } from '@/lib/workload-store';
import type { FacultyMember, ProgrammeType } from '@/lib/workload-types';
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
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  SlidersHorizontal,
  Mail,
  ShieldCheck,
  Building,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/faculty')({
  component: AdminFacultyMasterPage,
});

function AdminFacultyMasterPage() {
  const {
    facultyList,
    allWorkloads,
    updateFacultyMember,
    addFacultyMember,
    deleteFacultyMember,
  } = useWorkloadData();

  const [searchTerm, setSearchTerm] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');

  // Edit modal
  const [editingFaculty, setEditingFaculty] = useState<FacultyMember | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New faculty state
  const [newFaculty, setNewFaculty] = useState<Partial<FacultyMember>>({
    id: `FAC0${facultyList.length + 1}`,
    name: '',
    designation: 'Assistant Professor',
    department: 'MCA',
    programme: 'MCA',
    facultyType: 'Regular',
    defaultWorkloadHours: 18,
    email: '',
    status: 'ACTIVE',
  });

  const filteredFaculty = facultyList.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProg = programmeFilter === 'ALL' || f.programme === programmeFilter;
    return matchesSearch && matchesProg;
  });

  const handleSaveEdit = () => {
    if (!editingFaculty) return;
    updateFacultyMember(editingFaculty);
    toast.success(`Updated details for ${editingFaculty.name}`);
    setEditingFaculty(null);
  };

  const handleCreateFaculty = () => {
    if (!newFaculty.name || !newFaculty.email) {
      toast.error('Please provide faculty name and email address.');
      return;
    }

    const created: FacultyMember = {
      id: newFaculty.id || `FAC${Date.now().toString().slice(-3)}`,
      name: newFaculty.name,
      designation: newFaculty.designation || 'Assistant Professor',
      department: 'MCA',
      programme: (newFaculty.programme as ProgrammeType) || 'MCA',
      facultyType: newFaculty.facultyType || 'Regular',
      defaultWorkloadHours: newFaculty.defaultWorkloadHours || 18,
      email: newFaculty.email,
      status: 'ACTIVE',
    };

    addFacultyMember(created);
    toast.success(`Added faculty member ${created.name}`);
    setIsAddModalOpen(false);
    setNewFaculty({
      id: `FAC0${facultyList.length + 2}`,
      name: '',
      designation: 'Assistant Professor',
      department: 'MCA',
      programme: 'MCA',
      facultyType: 'Regular',
      defaultWorkloadHours: 18,
      email: '',
      status: 'ACTIVE',
    });
  };

  return (
    <WorkloadShell
      role="admin"
      title="Faculty Master & Workload Configuration"
      subtitle="Maintain staff profiles, designations, departmental programmes, and default workload limits"
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
            onClick={() => setIsAddModalOpen(true)}
            className="h-8 gap-1.5 text-xs bg-[#002147] hover:bg-[#001833] text-white"
          >
            <Plus className="size-3.5 text-teal-300" />
            <span>Add Faculty Member</span>
          </Button>
        </div>
      }
    >
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. FILTER BAR */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-[#002147]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Registered Faculty ({facultyList.length} members)
          </h3>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
            <Input
              placeholder="Search staff name or ID..."
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
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. FACULTY MASTER TABLE */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[850px]">
            <thead className="text-[11px] font-bold text-slate-600 bg-slate-100 uppercase border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Faculty ID</th>
                <th className="px-4 py-3">Faculty Name</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Faculty Type</th>
                <th className="px-4 py-3 text-center">Default Target</th>
                <th className="px-4 py-3 text-center">Allocated (T+P)</th>
                <th className="px-4 py-3 text-center">Remaining Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredFaculty.map((f) => {
                const w = allWorkloads.find((x) => x.facultyId === f.id);

                return (
                  <tr key={f.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-600">
                      {f.id}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {f.name}
                      <span className="block text-[10px] text-slate-400 font-normal font-mono">
                        {f.email}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {f.designation}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-800">{f.programme}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Dept: {f.department}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 border text-slate-700">
                        {f.facultyType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-black text-xs text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        {f.defaultWorkloadHours} hrs
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono font-bold text-slate-800">
                        {w?.allocatedHours || 0} hrs
                      </span>
                      <span className="block text-[10px] text-slate-400 font-mono">
                        (T:{w?.theoryHours || 0}h / P:{w?.practicalHours || 0}h)
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded border ${
                          (w?.remainingHours ?? 0) === 0 && (w?.allocatedHours ?? 0) > 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : (w?.remainingHours ?? 0) > 0
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                      >
                        {w ? `${w.remainingHours} hrs` : `${f.defaultWorkloadHours} hrs`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          w?.status === 'BALANCED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : w?.status === 'OVERLOADED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {w?.status || 'BALANCED'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingFaculty(f)}
                          className="h-7 px-2 text-xs text-blue-700 hover:bg-blue-50"
                        >
                          <Edit2 className="size-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Delete faculty member ${f.name}?`)) {
                              deleteFacultyMember(f.id);
                              toast.success(`Removed ${f.name}`);
                            }
                          }}
                          className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. EDIT FACULTY MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={!!editingFaculty} onOpenChange={(open) => !open && setEditingFaculty(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="size-4 text-blue-600" />
              Edit Faculty Profile
            </DialogTitle>
            <DialogDescription>
              Modify staff details and default weekly workload hour limits.
            </DialogDescription>
          </DialogHeader>

          {editingFaculty && (
            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Faculty Name</label>
                <Input
                  value={editingFaculty.name}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Designation</label>
                  <select
                    value={editingFaculty.designation}
                    onChange={(e) =>
                      setEditingFaculty({ ...editingFaculty, designation: e.target.value })
                    }
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="Professor & HOD">Professor & HOD</option>
                    <option value="Professor">Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Full-Time Scholar (FTS)">Full-Time Scholar (FTS)</option>
                    <option value="Assistant Professor (AP/BSc)">Assistant Professor (AP/BSc)</option>
                    <option value="Adjunct Faculty">Adjunct Faculty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Programme</label>
                  <select
                    value={editingFaculty.programme}
                    onChange={(e) =>
                      setEditingFaculty({
                        ...editingFaculty,
                        programme: e.target.value as ProgrammeType,
                      })
                    }
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="MCA">MCA</option>
                    <option value="MCA GEN AI">MCA GEN AI</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Faculty Type</label>
                  <select
                    value={editingFaculty.facultyType}
                    onChange={(e) =>
                      setEditingFaculty({
                        ...editingFaculty,
                        facultyType: e.target.value as any,
                      })
                    }
                    className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="Regular">Regular</option>
                    <option value="Adjunct">Adjunct</option>
                    <option value="FTS">FTS (Full-Time Scholar)</option>
                    <option value="Visiting">Visiting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-blue-900 mb-1">
                    Default Workload (Hours)
                  </label>
                  <Input
                    type="number"
                    value={editingFaculty.defaultWorkloadHours}
                    onChange={(e) =>
                      setEditingFaculty({
                        ...editingFaculty,
                        defaultWorkloadHours: Number(e.target.value),
                      })
                    }
                    className="h-8 text-xs font-bold text-blue-900 border-blue-300 bg-blue-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address</label>
                <Input
                  value={editingFaculty.email}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, email: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingFaculty(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} className="bg-[#002147] text-white">
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. ADD FACULTY MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4 text-teal-600" />
              Add Faculty Profile
            </DialogTitle>
            <DialogDescription>
              Create a new faculty profile with custom workload configuration limits.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Faculty Name</label>
              <Input
                placeholder="e.g. Dr. A. Sharma"
                value={newFaculty.name}
                onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Designation</label>
                <select
                  value={newFaculty.designation}
                  onChange={(e) =>
                    setNewFaculty({ ...newFaculty, designation: e.target.value })
                  }
                  className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="Professor & HOD">Professor & HOD</option>
                  <option value="Professor">Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Full-Time Scholar (FTS)">Full-Time Scholar (FTS)</option>
                  <option value="Assistant Professor (AP/BSc)">Assistant Professor (AP/BSc)</option>
                  <option value="Adjunct Faculty">Adjunct Faculty</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Programme</label>
                <select
                  value={newFaculty.programme}
                  onChange={(e) =>
                    setNewFaculty({
                      ...newFaculty,
                      programme: e.target.value as ProgrammeType,
                    })
                  }
                  className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="MCA">MCA</option>
                  <option value="MCA GEN AI">MCA GEN AI</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Faculty Type</label>
                <select
                  value={newFaculty.facultyType}
                  onChange={(e) =>
                    setNewFaculty({
                      ...newFaculty,
                      facultyType: e.target.value as any,
                    })
                  }
                  className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="Regular">Regular</option>
                  <option value="Adjunct">Adjunct</option>
                  <option value="FTS">FTS (Full-Time Scholar)</option>
                  <option value="Visiting">Visiting</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-blue-900 mb-1">
                  Default Workload (Hours)
                </label>
                <Input
                  type="number"
                  value={newFaculty.defaultWorkloadHours}
                  onChange={(e) =>
                    setNewFaculty({
                      ...newFaculty,
                      defaultWorkloadHours: Number(e.target.value),
                    })
                  }
                  className="h-8 text-xs font-bold text-blue-900 border-blue-300 bg-blue-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address</label>
              <Input
                placeholder="faculty@srm.edu"
                value={newFaculty.email}
                onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateFaculty} className="bg-[#002147] text-white">
                Create Faculty
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
