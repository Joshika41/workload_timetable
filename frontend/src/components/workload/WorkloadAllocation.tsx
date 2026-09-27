import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

export default function WorkloadAllocation({ workspaceId }: { workspaceId: string }) {
  const [allocations, setAllocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllocations = async () => {
      try {
        const res = await apiClient.get('/workload/faculty', { params: { workspace_id: workspaceId } });
        setAllocations(res.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load workload summary");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllocations();
  }, [workspaceId]);

  const handleExportPDF = async () => {
    try {
      const res = await apiClient.get('/workload/export.pdf', {
        params: { workspace_id: workspaceId },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Workload_${workspaceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Workload Details Matrix</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Summary of all finalized workload allocations for faculty.
          </p>
        </div>
        
        <div className="flex gap-4">
          <Button variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <FileSpreadsheet className="size-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={handleExportPDF} className="bg-[#002147] hover:bg-blue-900 text-white font-bold">
            <Download className="size-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-medium">Loading matrix data...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold">Faculty Name</th>
                <th className="px-6 py-4 font-bold">Designation</th>
                <th className="px-6 py-4 font-bold">Allocated Subjects</th>
                <th className="px-6 py-4 font-bold">Total Theory Hours</th>
                <th className="px-6 py-4 font-bold">Total Practical Hours</th>
                <th className="px-6 py-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No faculty found for this department.
                  </td>
                </tr>
              ) : (
                allocations.map((alloc: any) => (
                  <tr key={alloc.faculty_id} className="bg-white border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">{alloc.faculty_name}</td>
                    <td className="px-6 py-4 font-medium text-slate-600">{alloc.designation}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div className="flex flex-col gap-1">
                        {alloc.assignments.length === 0 ? (
                          <span className="text-slate-400 italic">None</span>
                        ) : (
                          alloc.assignments.map((a: any, idx: number) => (
                            <span key={idx} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold w-fit">
                              {a.subject_name} ({a.subject_code}) - {a.section}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{alloc.total_theory_hours}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{alloc.total_practical_hours}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        alloc.status === 'Allocated' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {alloc.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
