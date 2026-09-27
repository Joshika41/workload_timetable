import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Layers, Eye, Download, Printer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/api/client';
import { workloadApi } from '@/api/workloadApi';

export const Route = createFileRoute('/admin/timetables')({
  component: AdminClassMatrixPage,
});

function AdminClassMatrixPage() {
  const { activeWorkspace } = useWorkspace();
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<any | null>(null);

  useEffect(() => {
    if (!activeWorkspace) return;

    // Fetch matrix data (which gives us subjects allocated to each section)
    workloadApi.getClassMatrix(activeWorkspace.workspace_id)
      .then(setMatrixData)
      .catch(console.error);

    // Fetch allocations to check finalization status
    apiClient.get('/allocation', { params: { workspace_id: activeWorkspace.workspace_id } })
      .then(res => setAllocations(res.data))
      .catch(console.error);
      
  }, [activeWorkspace]);

  if (!activeWorkspace) return null;

  const isWorkspaceFinalized = allocations.length > 0 && allocations.every(a => a.status === 'FINALIZED');

  const sectionRows = ((activeWorkspace as any).sections || []).map((sec: any) => {
    const secAllocs = allocations.filter(a => a.section_id === sec.id);
    const fullyAllocatedCount = secAllocs.length;
    return {
      section_id: sec.id,
      section_name: sec.name,
      total_subjects: secAllocs.length > 0 ? secAllocs.length : '-', // We can refine this if we know expected total
      fully_allocated: fullyAllocatedCount,
      allocations: secAllocs
    };
  });

  return (
    <WorkloadShell
      role="admin"
      title="Class-Wise Matrix"
      subtitle="Section-by-section breakdown of subject allocations and assigned faculty"
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.history.back()}
            className="h-8 gap-1 text-xs border-slate-200 bg-white"
          >
            <ArrowLeft className="size-3.5" /> Back
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="h-8 gap-1 text-xs border-slate-300 bg-white hover:bg-slate-100"
          >
            <Printer className="size-3.5" /> Print
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs bg-[#002147] hover:bg-[#001833] text-white"
          >
            <Download className="size-3.5" /> Export Excel
          </Button>
        </div>
      }
    >
      {!isWorkspaceFinalized ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center mt-4">
          <h3 className="text-lg font-bold text-amber-800 mb-2">Subject Allocation Not Finalized</h3>
          <p className="text-amber-700 max-w-md mx-auto">
            The Class-Wise Matrix can only be viewed after you have finalized the subject allocations for this academic context. Please complete the subject allocation process first.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-4">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wider text-sm">
              <Layers className="size-4 text-[#002147]" />
              Class-Wise Matrix
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                <tr>
                  <th className="px-6 py-4">Programme</th>
                  <th className="px-6 py-4 text-center">Year</th>
                  <th className="px-6 py-4 text-center">Semester</th>
                  <th className="px-6 py-4 font-bold text-slate-800">Section</th>
                  <th className="px-6 py-4 text-center">Total Subjects</th>
                  <th className="px-6 py-4 text-center">Fully Allocated</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sectionRows.map(row => (
                  <tr key={row.section_id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-slate-700">{activeWorkspace.programme_name}</td>
                    <td className="px-6 py-4 text-center text-slate-600">Year {activeWorkspace.programme_year}</td>
                    <td className="px-6 py-4 text-center text-slate-600">Sem {activeWorkspace.semester}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{row.section_name}</td>
                    <td className="px-6 py-4 text-center font-mono text-slate-700">{row.total_subjects}</td>
                    <td className="px-6 py-4 text-center font-mono text-emerald-700 font-semibold">{row.fully_allocated}</td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSection(row)}
                        className="text-xs h-8 border-slate-300 text-[#002147] hover:bg-slate-50"
                      >
                        <Eye className="size-3.5 mr-1.5" /> View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Matrix Detail Modal */}
      <Dialog open={!!selectedSection} onOpenChange={(open) => !open && setSelectedSection(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-50">
          {selectedSection && (
            <>
              <div className="bg-[#002147] p-6 text-white flex justify-between items-center">
                <div>
                  <DialogTitle className="text-xl font-bold">Class-Wise Allocation Matrix</DialogTitle>
                  <p className="text-sm text-blue-200 mt-2">{activeWorkspace.programme_name} · Year {activeWorkspace.programme_year} · {selectedSection.section_name}</p>
                </div>
              </div>
              
              <div className="p-6">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-bold">
                      <tr>
                        <th className="px-6 py-3">Subject Code</th>
                        <th className="px-6 py-3">Subject Name</th>
                        <th className="px-6 py-3">Main Faculty</th>
                        <th className="px-6 py-3">Assistant / IN-2</th>
                        <th className="px-6 py-3 text-center">T / P Hrs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSection.allocations.map((alloc: any) => {
                        const main = alloc.components.find((c: any) => c.role === 'MAIN');
                        const asst = alloc.components.find((c: any) => c.role === 'ASSISTANT');
                        
                        return (
                          <tr key={alloc.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 font-mono font-medium text-blue-700">{alloc.subject_code}</td>
                            <td className="px-6 py-4 font-semibold text-slate-800">{alloc.subject_name}</td>
                            <td className="px-6 py-4 text-slate-900 font-medium">
                              {main?.faculty_name || '-'}
                            </td>
                            <td className="px-6 py-4 text-slate-600 text-xs">
                              {asst?.faculty_name || '-'}
                            </td>
                            <td className="px-6 py-4 text-center font-mono text-slate-700">
                              {(main?.theory_hours || 0) + (asst?.theory_hours || 0)} / {(main?.practical_hours || 0) + (asst?.practical_hours || 0)}
                            </td>
                          </tr>
                        );
                      })}
                      {selectedSection.allocations.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                            No allocations found for this section.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-8 flex justify-end">
                  <Button onClick={() => setSelectedSection(null)} className="bg-[#002147] hover:bg-[#001833] text-white px-8">
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
