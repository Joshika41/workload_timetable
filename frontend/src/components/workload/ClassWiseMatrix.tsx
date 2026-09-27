import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Table } from 'lucide-react';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

export default function ClassWiseMatrix({ workspaceId }: { workspaceId: string }) {
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMatrix = async () => {
      try {
        const res = await apiClient.get('/workload/class-matrix', { params: { workspace_id: workspaceId } });
        setMatrixData(res.data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load class matrix');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMatrix();
  }, [workspaceId]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Class Wise Matrix</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Overview of which faculty handles which subjects for each class/section.
          </p>
        </div>
        
        <Button variant="outline" className="text-[#002147] border-slate-300 hover:bg-slate-50">
          <Download className="size-4 mr-2" />
          Export Matrix
        </Button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 font-medium">Loading class matrix...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-bold">Class / Section</th>
                <th className="px-6 py-4 font-bold">Course Name (Code)</th>
                <th className="px-6 py-4 font-bold">Faculty In-charge (MAIN)</th>
                <th className="px-6 py-4 font-bold">Assistants</th>
                <th className="px-6 py-4 font-bold">Category</th>
              </tr>
            </thead>
            <tbody>
              {matrixData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No classes have been allocated yet.
                  </td>
                </tr>
              ) : (
                matrixData.map((row: any, idx: number) => (
                  <tr key={idx} className="bg-white border-b hover:bg-slate-50">
                    <td className="px-6 py-4 font-bold text-slate-900">{row.section_name}</td>
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {row.subject_name} <br/> <span className="text-xs text-slate-400">{row.subject_code}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#002147]">
                      {row.main_faculty.length > 0 ? (
                        row.main_faculty.map((f: any, i: number) => (
                          <div key={i}>{f.name} <span className="text-xs text-slate-500">({f.theory_hours}T, {f.practical_hours}P)</span></div>
                        ))
                      ) : (
                        <span className="text-amber-500 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-600">
                      {row.assistant_faculty.length > 0 ? (
                        row.assistant_faculty.map((f: any, i: number) => (
                          <div key={i}>{f.name} <span className="text-xs text-slate-500">({f.theory_hours}T, {f.practical_hours}P)</span></div>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs italic">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">{row.category}</span>
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
