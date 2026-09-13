import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkloadData } from '@/lib/workload-store';
import { COURSE_CATEGORIES, type CourseCategory, type Course, type SectionConfig } from '@/lib/workload-types';
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
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Search,
  Layers,
  GraduationCap,
  Building,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/setup')({
  component: AdminAcademicSetupPage,
});

function AdminAcademicSetupPage() {
  const { courseList, sectionList, addCourse } = useWorkloadData();

  const [activeTab, setActiveTab] = useState<'courses' | 'sections' | 'programmes'>('courses');
  const [searchTerm, setSearchTerm] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Add Course Modal State
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseCategory, setNewCourseCategory] = useState<CourseCategory>('C');
  const [newCourseProgramme, setNewCourseProgramme] = useState<ProgrammeType>('MCA');
  const [newCourseSemester, setNewCourseSemester] = useState<SemesterType>('I');
  const [newTheoryHours, setNewTheoryHours] = useState(0);
  const [newTutorialHours, setNewTutorialHours] = useState(0);
  const [newPracticalHours, setNewPracticalHours] = useState(0);
  const [newCredits, setNewCredits] = useState(0);

  const handleAddCourse = () => {
    if (!newCourseCode || !newCourseTitle) {
      toast.error('Please enter course code and title');
      return;
    }
    
    addCourse({
      code: newCourseCode,
      title: newCourseTitle,
      category: newCourseCategory,
      programme: newCourseProgramme,
      semester: newCourseSemester,
      theoryHours_L: newTheoryHours,
      tutorialHours_T: newTutorialHours,
      practicalHours_P: newPracticalHours,
      credits_C: newCredits,
    });
    
    toast.success('Course added successfully');
    setIsAddCourseModalOpen(false);
    
    // Reset form
    setNewCourseCode('');
    setNewCourseTitle('');
    setNewTheoryHours(0);
    setNewTutorialHours(0);
    setNewPracticalHours(0);
    setNewCredits(0);
  };

  // Filtered courses
  const filteredCourses = courseList.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProg = programmeFilter === 'ALL' || c.programme === programmeFilter;
    const matchesCat = categoryFilter === 'ALL' || c.category === categoryFilter;
    return matchesSearch && matchesProg && matchesCat;
  });

  return (
    <WorkloadShell
      role="admin"
      title="Academic Setup & Course Master"
      subtitle="Configure 2025 SRM MCA & MCA GEN AI curriculum, syllabus categories, and class sections"
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
      {/* 1. SETUP NAVIGATION TABS */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'courses'
                ? 'bg-[#002147] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="size-3.5" />
            Course Master ({courseList.length})
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'sections'
                ? 'bg-[#002147] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="size-3.5" />
            Section / Class Master ({sectionList.length})
          </button>
          <button
            onClick={() => setActiveTab('programmes')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'programmes'
                ? 'bg-[#002147] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="size-3.5" />
            Programmes &amp; Semesters
          </button>
        </div>

        {activeTab === 'courses' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
              <Input
                placeholder="Search code or title..."
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
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
            >
              <option value="ALL">All Categories</option>
              <option value="C">Professional Core (C)</option>
              <option value="D">Discipline Elective (D)</option>
              <option value="G">Generic Elective (G)</option>
              <option value="S">Skill Enhancement (S)</option>
              <option value="AE">Ability Enhancement (AE)</option>
            </select>

            <Button
              size="sm"
              onClick={() => setIsAddCourseModalOpen(true)}
              className="h-8 gap-1.5 text-xs bg-[#002147] hover:bg-[#001833] text-white shrink-0"
            >
              <Plus className="size-3.5 text-teal-300" />
              <span className="hidden sm:inline">Add Course</span>
            </Button>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. TAB A: COURSE MASTER */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[850px]">
              <thead className="text-[11px] font-bold text-slate-600 bg-slate-100 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Course Code</th>
                  <th className="px-4 py-3">Course Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Programme</th>
                  <th className="px-4 py-3 text-center">Semester</th>
                  <th className="px-4 py-3 text-center">Theory (L)</th>
                  <th className="px-4 py-3 text-center">Tutorial (T)</th>
                  <th className="px-4 py-3 text-center">Practical (P)</th>
                  <th className="px-4 py-3 text-center">Credits (C)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCourses.map((c) => {
                  const catInfo = COURSE_CATEGORIES[c.category];

                  return (
                    <tr key={c.code} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-700">
                        {c.code}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {c.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${catInfo?.badgeColor || 'bg-slate-200 text-slate-800'}`}>
                          {catInfo?.name || c.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {c.programme}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-semibold">
                        Sem {c.semester}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">
                        {c.theoryHours_L}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {c.tutorialHours_T}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">
                        {c.practicalHours_P}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-black text-blue-900 bg-blue-50/50">
                        {c.credits_C}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. TAB B: SECTION / CLASS CONFIGURATION (Section 15 in prompt) */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'sections' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Class Section Configuration
            </h3>
            <p className="text-xs text-slate-500">
              Configure student counts, laboratory batching, and cohort settings per section.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sectionList.map((sec) => (
              <div
                key={sec.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-blue-300 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900 font-mono">
                    {sec.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    Sem {sec.semester}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Programme:</span>
                    <strong className="text-slate-800">{sec.programme}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Students:</span>
                    <strong className="font-mono text-slate-900">{sec.studentCount} students</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Lab Batches:</span>
                    <strong className="font-mono text-blue-700">{sec.labBatches} Batches</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Students / Batch:</span>
                    <strong className="font-mono text-slate-700">~{sec.studentsPerBatch || Math.round(sec.studentCount / sec.labBatches)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. TAB C: PROGRAMMES & SEMESTERS OVERVIEW */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'programmes' && (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* MCA */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="size-10 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                MCA
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">Master of Computer Applications</h4>
                <p className="text-xs text-slate-500">2-Year PG Programme · 2025 Regulations</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p><strong>Active Semesters:</strong> Semester I (Odd), Semester II (Even)</p>
              <p><strong>Core Courses:</strong> 10 Professional Core (PCA25C01J to PCA25C10L)</p>
              <p><strong>Electives:</strong> 9 Discipline Electives, 6 Generic Electives</p>
              <p><strong>Total Sections:</strong> 4 Sections (I MCA A, I MCA B, II MCA A, II MCA B)</p>
            </div>
          </div>

          {/* MCA GEN AI */}
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="size-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                AI
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900">MCA in Generative Artificial Intelligence</h4>
                <p className="text-xs text-slate-500">2-Year Specialised PG Programme · 2025 Regulations</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <p><strong>Active Semesters:</strong> Semester I (Odd), Semester II (Even)</p>
              <p><strong>Specialised Courses:</strong> Foundations of Gen AI, Large Language Models, Diffusion Models</p>
              <p><strong>Total Sections:</strong> 4 Sections (I MCA GEN AI A, I MCA GEN AI B, II MCA GEN AI A, II MCA GEN AI B)</p>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. ADD COURSE MODAL */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={isAddCourseModalOpen} onOpenChange={setIsAddCourseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-4 text-teal-600" />
              Add New Course
            </DialogTitle>
            <DialogDescription>
              Enter the course details to add a new subject to the curriculum master.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Code</label>
                <Input
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CAC25101"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Title</label>
                <Input
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  placeholder="e.g. Advanced Data Structures"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Category</label>
                <select
                  value={newCourseCategory}
                  onChange={(e) => setNewCourseCategory(e.target.value as CourseCategory)}
                  className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="C">Core (C)</option>
                  <option value="D">Elective (D)</option>
                  <option value="G">Generic (G)</option>
                  <option value="S">Skill (S)</option>
                  <option value="AE">Ability (AE)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Programme</label>
                <select
                  value={newCourseProgramme}
                  onChange={(e) => setNewCourseProgramme(e.target.value as ProgrammeType)}
                  className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="MCA">MCA</option>
                  <option value="MCA GEN AI">MCA GEN AI</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Semester</label>
                <select
                  value={newCourseSemester}
                  onChange={(e) => setNewCourseSemester(e.target.value as SemesterType)}
                  className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="I">Semester I</option>
                  <option value="II">Semester II</option>
                  <option value="III">Semester III</option>
                  <option value="IV">Semester IV</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Theory (L)</label>
                <Input
                  type="number"
                  value={newTheoryHours}
                  onChange={(e) => setNewTheoryHours(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tutorial (T)</label>
                <Input
                  type="number"
                  value={newTutorialHours}
                  onChange={(e) => setNewTutorialHours(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Practical (P)</label>
                <Input
                  type="number"
                  value={newPracticalHours}
                  onChange={(e) => setNewPracticalHours(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Credits (C)</label>
                <Input
                  type="number"
                  value={newCredits}
                  onChange={(e) => setNewCredits(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddCourseModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddCourse} className="bg-[#002147] text-white">
                Add Course
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </WorkloadShell>
  );
}
