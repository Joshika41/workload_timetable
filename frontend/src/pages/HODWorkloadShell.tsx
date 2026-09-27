import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, BookOpen, Grid, CheckCircle } from 'lucide-react';
import { academicApi } from '@/api/academicApi';

// Sub-components to be implemented
import PreferenceManagement from '@/components/workload/PreferenceManagement';
import WorkloadAllocation from '@/components/workload/WorkloadAllocation';
import ClassWiseMatrix from '@/components/workload/ClassWiseMatrix';

export default function HODWorkloadShell() {
  const { workspaceId } = useParams();
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'preferences' | 'allocation' | 'matrix'>('preferences');
  const [workspaceInfo, setWorkspaceInfo] = useState<any>(null);
  
  useEffect(() => {
    if (workspaceId) {
      apiClient.get('/academic-workspaces').then(res => {
        const ws = res.data.find((w: any) => w.workspace_id === workspaceId);
        setWorkspaceInfo(ws);
      }).catch(console.error);
    }
  }, [workspaceId]);

  const tabs = [
    { id: 'preferences', label: 'Preference Management', icon: Users },
    { id: 'allocation', label: 'Workload Allocation', icon: BookOpen },
    { id: 'matrix', label: 'Class Wise Matrix', icon: Grid },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#002147] text-white px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-blue-200 hover:text-white hover:bg-white/10 -ml-2"
            onClick={() => navigate('/admin')}
          >
            <ArrowLeft className="size-5 mr-2" />
            Back to Dashboard
          </Button>
          <div className="h-6 w-px bg-white/20 mx-2"></div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Workspace Management</h1>
            <p className="text-xs text-blue-300 font-medium">HOD Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs text-blue-300">HOD</p>
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
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all whitespace-nowrap flex-1 justify-center ${
                  isActive 
                    ? 'bg-[#002147] text-white shadow-md shadow-blue-900/20' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`size-5 ${isActive ? 'text-blue-300' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1">
          {activeTab === 'preferences' && <PreferenceManagement workspaceId={workspaceId!} workspaceInfo={workspaceInfo} />}
          {activeTab === 'allocation' && <WorkloadAllocation workspaceId={workspaceId!} />}
          {activeTab === 'matrix' && <ClassWiseMatrix workspaceId={workspaceId!} />}
        </div>
      </main>
    </div>
  );
}
