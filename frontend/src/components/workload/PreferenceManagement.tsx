import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { User, CheckCircle, Clock, AlertCircle, Edit, Save } from 'lucide-react';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

export default function PreferenceManagement({ workspaceId, workspaceInfo }: { workspaceId: string, workspaceInfo?: any }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null);

  // Form State
  const [allocatingItemId, setAllocatingItemId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    section_id: '',
    role: 'MAIN',
    theory_hours: 0,
    practical_hours: 0,
  });

  const submittedCount = submissions.length;
  
  useEffect(() => {
    fetchSubmissions();
  }, [workspaceId]);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/coordinator/preferences', { params: { workspace_id: workspaceId } });
      setSubmissions(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeWorkload = async () => {
    try {
      await apiClient.post(`/workload/finalize`, null, { params: { workspace_id: workspaceId } });
      toast.success('Workload finalized successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to finalize');
    }
  };

  const handleAllocate = async (item: any) => {
    if (!formData.section_id) {
      toast.error("Please select a section");
      return;
    }
    try {
      await apiClient.post('/allocations', {
        section_id: parseInt(formData.section_id),
        subject_id: item.subject_id,
        components: [
          {
            faculty_id: selectedFaculty.faculty_id,
            role: formData.role,
            theory_hours: Number(formData.theory_hours),
            practical_hours: Number(formData.practical_hours)
          }
        ]
      }, { params: { workspace_id: workspaceId } });
      
      // Auto-approve the faculty submission review status
      if (selectedFaculty.review_status !== 'APPROVED') {
        await apiClient.patch(`/coordinator/preferences/submissions/${selectedFaculty.id}/review`, {
          review_status: 'APPROVED'
        });
        
        // Update local state
        setSubmissions(prev => prev.map(s => s.id === selectedFaculty.id ? {...s, review_status: 'APPROVED'} : s));
        setSelectedFaculty({...selectedFaculty, review_status: 'APPROVED'});
      }
      
      toast.success('Allocation submitted successfully');
      setAllocatingItemId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to allocate');
    }
  };

  const sections = workspaceInfo?.sections || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500 mb-1">Total Submissions</p>
            <h3 className="text-3xl font-black text-slate-900">{submittedCount}</h3>
          </div>
          <div className="size-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <CheckCircle className="size-6" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-500 mb-1">Pending Review</p>
            <h3 className="text-3xl font-black text-amber-600">
              {submissions.filter(s => s.review_status !== 'APPROVED').length}
            </h3>
          </div>
          <div className="size-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock className="size-6" />
          </div>
        </div>

        <div className="bg-[#002147] p-6 rounded-2xl shadow-sm flex flex-col justify-center items-start text-white relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
            <CheckCircle className="size-32" />
          </div>
          <p className="text-sm font-bold text-blue-200 mb-2 relative z-10">Workspace Action</p>
          <Button 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold relative z-10"
            onClick={handleFinalizeWorkload}
          >
            Finalize Workload
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Faculty List */}
        <div className="w-full lg:w-1/3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="font-bold text-slate-900">Faculty Submissions</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {isLoading ? (
              <p className="p-4 text-slate-500 text-center">Loading...</p>
            ) : submissions.length === 0 ? (
              <p className="p-4 text-slate-500 text-center">No preferences submitted yet.</p>
            ) : (
              submissions.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedFaculty(sub)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                    selectedFaculty?.id === sub.id 
                      ? 'border-blue-300 bg-blue-50 shadow-sm' 
                      : 'border-slate-100 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <User className="size-5" />
                    </div>
                    <div>
                      <p className={`font-bold ${selectedFaculty?.id === sub.id ? 'text-blue-900' : 'text-slate-900'}`}>
                        {sub.faculty_name}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">Status: {sub.review_status}</p>
                    </div>
                  </div>
                  <ChevronRightIcon className={`size-5 ${selectedFaculty?.id === sub.id ? 'text-blue-500' : 'text-slate-300'}`} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Faculty Details & Allocation */}
        <div className="w-full lg:w-2/3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[600px] overflow-hidden">
          {selectedFaculty ? (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-full bg-[#002147] flex items-center justify-center text-white">
                    <User className="size-7" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{selectedFaculty.faculty_name}</h2>
                    <p className="text-sm font-semibold text-slate-500">Subject Preferences & Allocation</p>
                  </div>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                  selectedFaculty.review_status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {selectedFaculty.review_status}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-white">
                <h3 className="font-bold text-slate-900 mb-4">Preferred Subjects</h3>
                <div className="space-y-4">
                  {selectedFaculty.items.map((item: any, idx: number) => {
                    const isAllocating = allocatingItemId === item.id;
                    return (
                      <div key={item.id} className="p-4 rounded-xl border border-slate-200 hover:shadow-md transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-3 items-center">
                            <span className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900 text-lg">{item.subject_name}</p>
                              <p className="text-xs font-semibold text-slate-500">{item.subject_code} • {item.category}</p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant={isAllocating ? 'outline' : 'default'}
                            className={!isAllocating ? "bg-indigo-600 hover:bg-indigo-700 text-white font-bold" : ""}
                            onClick={() => {
                              if (isAllocating) {
                                setAllocatingItemId(null);
                              } else {
                                setAllocatingItemId(item.id);
                                setFormData({ section_id: '', role: 'MAIN', theory_hours: 0, practical_hours: 0 });
                              }
                            }}
                          >
                            {isAllocating ? 'Cancel' : 'Allocate Now'}
                          </Button>
                        </div>
                        
                        {isAllocating && (
                          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                              <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Section</label>
                                <select 
                                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  value={formData.section_id}
                                  onChange={e => setFormData({...formData, section_id: e.target.value})}
                                >
                                  <option value="">-- Select Section --</option>
                                  {sections.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                                <select 
                                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  value={formData.role}
                                  onChange={e => setFormData({...formData, role: e.target.value})}
                                >
                                  <option value="MAIN">Main In-charge</option>
                                  <option value="ASSIST">Assistant</option>
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Theory Hours</label>
                                <input 
                                  type="number" min="0" 
                                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  value={formData.theory_hours}
                                  onChange={e => setFormData({...formData, theory_hours: Number(e.target.value)})}
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1">Practical Hours</label>
                                <input 
                                  type="number" min="0" 
                                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                  value={formData.practical_hours}
                                  onChange={e => setFormData({...formData, practical_hours: Number(e.target.value)})}
                                />
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              onClick={() => handleAllocate(item)}
                            >
                              Submit Allocation
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <AlertCircle className="size-16 mb-4 text-slate-200" />
              <h3 className="text-xl font-bold text-slate-600 mb-2">No Faculty Selected</h3>
              <p className="text-sm font-medium">Select a faculty from the list on the left to review their preferences and allocate workload.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronRightIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
