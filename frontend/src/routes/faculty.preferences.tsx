import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useState, useEffect } from 'react';
import { academicApi } from '@/api/academicApi';
import { preferenceApi } from '@/api/preferenceApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, CheckCircle2, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { PreferenceSubmitRequest } from '@/types/preferences';

export const Route = createFileRoute('/faculty/preferences')({
  component: FacultyPreferencesPage,
});

function FacultyPreferencesPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { activeWorkspace } = useWorkspace();
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<{ id: number; code: string; name: string; category: string; rank: number }[]>([]);
  const [prefStatus, setPrefStatus] = useState<string | null>(null);

  useEffect(() => {
    if (activeWorkspace) {
      academicApi.getSubjects(activeWorkspace.workspace_id)
        .then(setSubjects)
        .catch(console.error);

      preferenceApi.getFacultyPreferences(activeWorkspace.workspace_id)
        .then(res => {
          if (res && res.length > 0) {
            setPrefStatus(res[0].status);
            const searchParams = new URLSearchParams(window.location.search);
            const isEdit = searchParams.get('edit') === 'true';

            if (!isEdit && (res[0]?.status === 'SUBMITTED' || res[0]?.status === 'APPROVED' || res[0]?.status === 'PENDING')) {
              navigate({ to: '/faculty/preferences-success' });
            } else if (isEdit && subjects.length > 0) {
              // Populate cart
              const items = (res[0]?.items || []).map((i: any) => {
                const s = subjects.find(sub => sub.id === i.subject_id);
                return {
                  id: i.subject_id,
                  code: i.subject_code,
                  name: i.subject_name,
                  category: s?.category || 'CORE',
                  rank: i.rank
                };
              });
              items.sort((a: any, b: any) => a.rank - b.rank);
              setCart(items);
            }
          }
        })
        .catch(console.error);
    }
  }, [activeWorkspace, navigate]);

  if (!activeWorkspace) return null;

  const filteredSubjects = subjects.filter(s => 
    s.course_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.course_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = (subject: any) => {
    if (cart.some(c => c.id === subject.id)) {
      toast.info('Already in preferences');
      return;
    }
    setCart(prev => [...prev, { id: subject.id, code: subject.course_code, name: subject.course_name, category: subject.category, rank: prev.length + 1 }]);
  };

  const handleRemove = (id: number) => {
    setCart(prev => {
      const filtered = prev.filter(c => c.id !== id);
      return filtered.map((c, idx) => ({ ...c, rank: idx + 1 }));
    });
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === cart.length - 1) return;
    
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newCart = [...cart];
    const item1 = newCart[index];
    const item2 = newCart[targetIdx];
    if (item1 && item2) {
      newCart[index] = item2;
      newCart[targetIdx] = item1;
    }
    
    setCart(newCart.map((c, idx) => ({ ...c, rank: idx + 1 })));
  };

  const hasCore = cart.some(c => c.category === 'CORE');
  const hasElective = cart.some(c => c.category === 'ELECTIVE');
  const canSubmit = hasCore && hasElective;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Select at least one Core subject and one Elective subject');
      return;
    }
    try {
      const req: PreferenceSubmitRequest = {
        workspace_id: activeWorkspace.workspace_id,
        preferences: cart.map(c => ({ subject_id: c.id, rank: c.rank }))
      };
      await preferenceApi.submitPreferences(req);
      navigate({ to: '/faculty/preferences-success' });
    } catch (e) {
      toast.error('Failed to submit');
    }
  };

  return (
    <WorkloadShell
      role="faculty"
      title="My Subject Preferences"
      subtitle="Select and rank your preferred subjects for the current academic context"
    >
      <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto mt-4">
        
        {/* Left: Available Subjects */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col min-h-[500px]">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Available Subjects</h3>
          
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search subjects by code or name..."
              className="pl-9 bg-slate-50 border-slate-200 h-10"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {filteredSubjects.map(sub => {
              const isSelected = cart.some(c => c.id === sub.id);
              return (
                <div 
                  key={sub.id} 
                  className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                    isSelected ? 'border-teal-500 bg-teal-50/30' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded bg-slate-100 flex items-center justify-center font-bold text-[10px] text-slate-500 shrink-0 mt-0.5">
                      {sub.course_code.substring(0, 3)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{sub.course_code}</p>
                      <p className="text-xs font-semibold text-slate-600 mb-1">{sub.course_name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${sub.category === 'CORE' ? 'bg-indigo-50 text-indigo-700' : 'bg-fuchsia-50 text-fuchsia-700'}`}>{sub.category}</span>
                        <span>T:{sub.theory_hours}</span>
                        <span>P:{sub.practical_hours}</span>
                        <span>Total:{sub.total_hours}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isSelected ? (
                    <div className="flex items-center gap-1.5 text-teal-600 font-bold text-xs bg-teal-50 px-2 py-1 rounded">
                      <CheckCircle2 className="size-3.5" /> Selected
                    </div>
                  ) : (
                    <Button 
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdd(sub)}
                      className="text-xs h-8 border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Select
                    </Button>
                  )}
                </div>
              );
            })}
            
            {filteredSubjects.length === 0 && (
              <div className="text-center py-10 text-sm text-slate-500">
                No subjects found.
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected & Ranked */}
        <div className="w-full lg:w-96 shrink-0 bg-blue-50/50 rounded-xl border border-blue-100 p-6 flex flex-col">
          <h3 className="text-sm font-bold text-blue-900 mb-4">Selected & Ranked</h3>
          
          <div className="flex-1 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-sm text-blue-300 font-medium">
                No subjects selected yet.<br/>Select subjects from the left.
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                  <div className="size-6 shrink-0 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    {item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{item.code}</p>
                    <p className="text-[10px] text-slate-500 truncate">{item.name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleMove(idx, 'up')} disabled={idx === 0} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30">
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button onClick={() => handleMove(idx, 'down')} disabled={idx === cart.length - 1} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30">
                      <ArrowDown className="size-3.5" />
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button onClick={() => handleRemove(item.id)} className="p-1 text-slate-400 hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 mt-4">
            <div className="flex justify-between text-xs mb-3 font-semibold text-slate-600 px-1">
              <div className="flex items-center gap-2">
                CORE
                {hasCore ? <CheckCircle2 className="size-3.5 text-teal-600" /> : <span className="text-red-500">✗</span>}
              </div>
              <div className="flex items-center gap-2">
                ELECTIVE
                {hasElective ? <CheckCircle2 className="size-3.5 text-teal-600" /> : <span className="text-red-500">✗</span>}
              </div>
            </div>
            {!canSubmit && (
              <p className="text-xs text-red-500 mb-3 text-center">
                Select at least one Core subject and one Elective subject to submit your preferences.
              </p>
            )}
            <Button 
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full h-12 bg-[#002147] hover:bg-[#001833] text-white font-bold text-sm shadow-md disabled:opacity-50"
            >
              Submit Preferences
            </Button>
            <p className="text-center text-[10px] text-slate-500 mt-3">
              You can edit your preferences until the HOD finalizes the allocations.
            </p>
          </div>
        </div>

      </div>
    </WorkloadShell>
  );
}
