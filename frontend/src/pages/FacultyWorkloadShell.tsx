import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, CheckCircle, ListPlus, GraduationCap, AlertCircle } from 'lucide-react';
import { academicApi } from '@/api/academicApi';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';

export default function FacultyWorkloadShell() {
  const { workspaceId } = useParams();
  const { user, logOut, workspaceFilters } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'preferences' | 'mysubjects'>('preferences');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<any[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<any>(null);
  const [mySubjects, setMySubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchWorkspaceData();
  }, [workspaceId]);

  const fetchWorkspaceData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch available subjects for this workspace
      const subs = await academicApi.getSubjects(workspaceId!);
      setSubjects(subs);

      // 2. Fetch existing preferences for this faculty
      const res = await apiClient.get('/faculty/preferences', { params: { workspace_id: workspaceId } });
      if (res.data && res.data.length > 0) {
        setSubmissionStatus(res.data[0]);
        // Re-select subjects that were previously submitted
        const preselectedIds = res.data[0].items.map((i: any) => i.subject_id);
        setSelectedSubjects(subs.filter((s: any) => preselectedIds.includes(s.id)));
      }

      // 3. Fetch allocated subjects
      const allocRes = await apiClient.get('/workload/my-subjects', { params: { workspace_id: workspaceId } });
      setMySubjects(allocRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load workspace data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSubject = (subject: any) => {
    if (selectedSubjects.find(s => s.id === subject.id)) {
      setSelectedSubjects(selectedSubjects.filter(s => s.id !== subject.id));
    } else {
      setSelectedSubjects([...selectedSubjects, subject]);
    }
  };

  const handleSubmitPreferences = async () => {
    if (selectedSubjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }

    try {
      const payload = {
        workspace_id: workspaceId,
        preferences: selectedSubjects.map((s, idx) => ({
          subject_id: s.id,
          rank: idx + 1
        }))
      };

      await apiClient.post('/faculty/preferences', payload);
      toast.success('Preferences submitted successfully!');
      fetchWorkspaceData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Submission failed. Ensure you chose Core and Elective.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#002147] text-white px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-blue-200 hover:text-white hover:bg-white/10 -ml-2"
            onClick={() => navigate('/faculty')}
          >
            <ArrowLeft className="size-5 mr-2" />
            Back to Dashboard
          </Button>
          <div className="h-6 w-px bg-white/20 mx-2"></div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Faculty Workspace</h1>
            <p className="text-xs text-blue-300 font-medium">Subject Preferences</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-blue-300">Faculty</p>
          </div>
          <Button variant="outline" className="text-[#002147] bg-white hover:bg-slate-100 border-none" onClick={logOut}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-8 flex flex-col gap-6">
        
        {/* Tab Navigation */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex overflow-x-auto">
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all whitespace-nowrap flex-1 justify-center ${
              activeTab === 'preferences'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-900/20' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <ListPlus className={`size-5 ${activeTab === 'preferences' ? 'text-teal-200' : 'text-slate-400'}`} />
            Submit Preferences
          </button>
          
          <button
            onClick={() => setActiveTab('mysubjects')}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all whitespace-nowrap flex-1 justify-center ${
              activeTab === 'mysubjects'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-900/20' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <GraduationCap className={`size-5 ${activeTab === 'mysubjects' ? 'text-teal-200' : 'text-slate-400'}`} />
            My Allocated Subjects
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {isLoading ? (
             <div className="py-20 text-center text-slate-500 font-medium">Loading workspace data...</div>
          ) : activeTab === 'preferences' ? (
            <div className="flex flex-col lg:flex-row gap-8">
              
              {/* Subject Selection */}
              <div className="flex-1">
                <h2 className="text-xl font-black text-slate-900 mb-2">Available Subjects</h2>
                <p className="text-sm font-semibold text-slate-500 mb-6">Select subjects you wish to teach this semester.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subjects.map(sub => {
                    const isSelected = selectedSubjects.find(s => s.id === sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSelectSubject(sub)}
                        className={`text-left p-4 rounded-xl border-2 transition-all flex justify-between items-start ${
                          isSelected 
                            ? 'border-teal-500 bg-teal-50' 
                            : 'border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <p className={`font-bold text-lg mb-1 ${isSelected ? 'text-teal-900' : 'text-slate-900'}`}>
                            {sub.course_name}
                          </p>
                          <p className="text-xs font-semibold text-slate-500">
                            {sub.course_code} • {sub.category}
                          </p>
                          <div className="flex gap-3 mt-3">
                            <span className="text-xs font-bold bg-white px-2 py-1 rounded text-slate-600 border border-slate-200">
                              TH: {sub.theory_hours}
                            </span>
                            <span className="text-xs font-bold bg-white px-2 py-1 rounded text-slate-600 border border-slate-200">
                              PR: {sub.practical_hours}
                            </span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle className="size-5 text-teal-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selection Summary */}
              <div className="w-full lg:w-[350px] shrink-0">
                <div className="sticky top-28 bg-slate-50 rounded-2xl p-6 border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4">Your Preferences</h3>
                  
                  {submissionStatus && submissionStatus.review_status !== 'DENIED' ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                      <p className="text-sm font-bold text-emerald-800 mb-1">Status: {submissionStatus.review_status}</p>
                      <p className="text-xs font-medium text-emerald-600">You have already submitted your preferences for this semester.</p>
                    </div>
                  ) : null}

                  <div className="space-y-3 mb-6">
                    {selectedSubjects.length === 0 ? (
                      <p className="text-sm text-slate-500 italic">No subjects selected yet.</p>
                    ) : (
                      selectedSubjects.map((s, idx) => (
                        <div key={s.id} className="flex gap-3 items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{s.course_name}</p>
                            <p className="text-xs text-slate-500">{s.category}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-200">
                    <Button 
                      className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold"
                      onClick={handleSubmitPreferences}
                      disabled={selectedSubjects.length === 0 || (submissionStatus && submissionStatus.review_status !== 'DENIED')}
                    >
                      Submit to HOD
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-900 mb-2">My Allocated Subjects</h2>
              <p className="text-sm font-semibold text-slate-500 mb-6">These are the subjects you have been allocated to teach this semester.</p>
              
              {mySubjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                   <AlertCircle className="size-12 mb-3 text-slate-300" />
                   <h3 className="text-lg font-bold text-slate-700 mb-1">No Allocations Yet</h3>
                   <p className="text-sm font-medium text-slate-500 max-w-md">
                     Your finalized subjects will appear here once the HOD has completed the workload allocation process for this semester.
                   </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mySubjects.map((sub, idx) => (
                    <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-lg text-slate-900">{sub.subject_name}</p>
                          <p className="text-xs font-semibold text-slate-500">{sub.subject_code} • {sub.section}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${sub.role === 'MAIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                          {sub.role === 'MAIN' ? 'Main In-charge' : 'Assistant'}
                        </span>
                      </div>
                      <div className="mt-auto pt-4 border-t border-slate-100 flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Theory</span>
                          <span className="font-bold text-slate-700">{sub.theory_hours} hrs</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Practical</span>
                          <span className="font-bold text-slate-700">{sub.practical_hours} hrs</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
