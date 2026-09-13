import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { WorkloadShell } from '@/components/WorkloadShell';
import { useWorkloadData } from '@/lib/workload-store';
import { WorkloadStatusBadge } from '@/components/WorkloadStatusBadge';
import { COURSE_CATEGORIES, type CourseCategory, type Course } from '@/lib/workload-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  GraduationCap,
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Search,
  Sparkles,
  Send,
  SlidersHorizontal,
  Info,
  Calendar,
  Building,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/faculty/dashboard')({
  component: FacultyDashboardPage,
});

function FacultyDashboardPage() {
  const {
    facultyList,
    currentFacultyId,
    setCurrentFacultyId,
    currentFaculty,
    currentFacultyWorkload,
    currentFacultyPreferences,
    courseList,
    submitFacultyPreferences,
  } = useWorkloadData();

  // Tab mode: "preferences" (Submit Subject Preferences) vs "overview" (My Allotted Workload)
  const [activeTab, setActiveTab] = useState<'preferences' | 'overview'>(
    currentFacultyPreferences?.status === 'SUBMITTED' ? 'overview' : 'preferences'
  );

  // Search & category filter in preference selector
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Working cart of selected preferences: [{ courseCode: string, rank: number }]
  const [cart, setCart] = useState<{ courseCode: string; rank: number }[]>(() => {
    if (currentFacultyPreferences?.preferences) {
      return currentFacultyPreferences.preferences.map((p) => ({
        courseCode: p.courseCode,
        rank: p.rank,
      }));
    }
    return [];
  });

  // Sync cart when current faculty or their saved preferences change
  useEffect(() => {
    if (currentFacultyPreferences?.preferences && currentFacultyPreferences.preferences.length > 0) {
      setCart(
        currentFacultyPreferences.preferences.map((p) => ({
          courseCode: p.courseCode,
          rank: p.rank,
        }))
      );
    } else {
      setCart([]);
    }
  }, [currentFacultyId, currentFacultyPreferences]);

  const faculty = currentFaculty;
  const workload = currentFacultyWorkload;

  // Filter courses by faculty's programme
  const availableCourses = courseList.filter((c) => {
    const matchesProgramme = c.programme === (faculty?.programme || 'MCA');
    const matchesSearch =
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat =
      selectedCategoryFilter === 'ALL' || c.category === selectedCategoryFilter;
    return matchesProgramme && matchesSearch && matchesCat;
  });

  // Group available courses by Category
  const categoriesList: CourseCategory[] = ['C', 'D', 'G', 'S', 'P', 'AE'];

  const handleAddPreference = (courseCode: string) => {
    if (cart.some((item) => item.courseCode === courseCode)) {
      toast.info('Subject is already in your preferences list');
      return;
    }
    if (cart.length >= 5) {
      toast.warning('You can select a maximum of 5 ranked preferences');
      return;
    }
    const newRank = cart.length + 1;
    setCart((prev) => [...prev, { courseCode, rank: newRank }]);
    toast.success(`Added ${courseCode} as Preference #${newRank}`);
  };

  const handleRemovePreference = (courseCode: string) => {
    setCart((prev) => {
      const filtered = prev.filter((item) => item.courseCode !== courseCode);
      // Re-index ranks
      return filtered.map((item, idx) => ({ ...item, rank: idx + 1 }));
    });
  };

  const handleMoveRank = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === cart.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const itemA = cart[index];
    const itemB = cart[targetIndex];
    if (!itemA || !itemB) return;

    const newCart = [...cart];
    newCart[index] = itemB;
    newCart[targetIndex] = itemA;

    // Re-index ranks
    const reordered = newCart.map((item, idx) => ({ ...item, rank: idx + 1 }));
    setCart(reordered);
  };

  const handleSubmitPreferences = () => {
    if (cart.length === 0) {
      toast.error('Please select at least 1 subject preference before submitting.');
      return;
    }
    if (faculty) {
      submitFacultyPreferences(faculty.id, cart);
      toast.success('Subject preferences submitted successfully to HOD!');
      setActiveTab('overview');
    }
  };

  return (
    <WorkloadShell
      role="faculty"
      title="Faculty Portal"
      subtitle={`Academic Year 2026-2027 · ${faculty?.programme || 'MCA'} Department`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeTab === 'preferences' ? 'default' : 'outline'}
            onClick={() => setActiveTab('preferences')}
            className={`text-xs h-8 ${activeTab === 'preferences' ? 'bg-[#002147] text-white font-bold' : 'bg-white'}`}
          >
            <Sparkles className="size-3.5 mr-1.5 text-teal-400" />
            Subject Preference Form (1 to 5)
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
            className={`text-xs h-8 ${activeTab === 'overview' ? 'bg-[#002147] text-white font-bold' : 'bg-white'}`}
          >
            <GraduationCap className="size-3.5 mr-1.5" />
            My Allotted Workload &amp; Classes
          </Button>
        </div>
      }
    >
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. TOP INSTITUTIONAL HERO / WELCOME SECTION */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[#002147] text-white p-6 shadow-md border border-blue-900/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30 rounded uppercase tracking-wider">
                Faculty Workspace · Willingness Collection
              </span>
              <span className="text-xs text-blue-200">ID: {faculty?.id}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Welcome, {faculty?.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-200/90 pt-1">
              <span><strong>Designation:</strong> {faculty?.designation}</span>
              <span>·</span>
              <span><strong>Programme:</strong> {faculty?.programme}</span>
              <span>·</span>
              <span><strong>Academic Year:</strong> 2026-2027</span>
              <span>·</span>
              <span><strong>Semester:</strong> Odd Semester</span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-blue-200 font-semibold">Switch Faculty View:</span>
              <select
                value={currentFacultyId}
                onChange={(e) => setCurrentFacultyId(e.target.value)}
                className="h-7 rounded border border-blue-400/50 bg-blue-950 text-white text-xs px-2 font-medium"
              >
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                    {f.name} ({f.designation} · {f.defaultWorkloadHours}h)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-lg border border-white/10 shrink-0 text-right">
            <p className="text-[10px] uppercase font-bold text-teal-300">Preference Status</p>
            <div className="mt-1">
              <WorkloadStatusBadge
                status={currentFacultyPreferences?.status || 'PENDING'}
                size="default"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. SUMMARY METRIC CARDS (Exact prompt format) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* DEFAULT HOURS */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Default Hours
          </p>
          <p className="text-3xl font-black text-slate-900 mt-1">
            {workload?.defaultHours || 18}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Institutional Standard</p>
        </div>

        {/* ALLOCATED HOURS */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Allocated Hours
          </p>
          <p className="text-3xl font-black text-blue-700 mt-1">
            {workload?.allocatedHours || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {workload?.theoryHours || 0}h Theory + {workload?.practicalHours || 0}h Lab
          </p>
        </div>

        {/* REMAINING HOURS */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Remaining Hours
          </p>
          <p className="text-3xl font-black text-amber-600 mt-1">
            {workload?.remainingHours || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Underload buffer</p>
        </div>

        {/* STATUS */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Workload Status
          </p>
          <div className="my-1">
            <WorkloadStatusBadge status={workload?.status || 'UNDERLOADED'} />
          </div>
          <p className="text-[11px] text-slate-400">
            {workload?.status === 'UNDERLOADED'
              ? '4 hours below default capacity'
              : workload?.status === 'BALANCED'
              ? 'Meets capacity requirements'
              : 'Overload assigned'}
          </p>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. TAB 1: DASHBOARD OVERVIEW */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* MY PREFERENCES SECTION */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Sparkles className="size-4 text-teal-600" />
                  My Preferences
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your submitted subject preferences ranked in order of priority (1 to 5).
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveTab('preferences')}
                className="text-xs h-7 gap-1 text-[#002147] border-blue-300 bg-blue-50/50"
              >
                <SlidersHorizontal className="size-3" />
                <span>Edit Preferences</span>
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {cart.map((pref, idx) => {
                const course = courseList.find((c) => c.code === pref.courseCode);
                const catInfo = course ? COURSE_CATEGORIES[course.category] : null;

                return (
                  <div
                    key={pref.courseCode}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:border-blue-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="size-6 rounded-full bg-[#002147] text-white font-bold text-xs flex items-center justify-center">
                          {pref.rank}
                        </span>
                        {catInfo && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${catInfo.badgeColor}`}
                          >
                            {catInfo.name}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs font-bold text-blue-700">
                        {pref.courseCode}
                      </p>
                      <p className="font-semibold text-xs text-slate-900 mt-1 leading-snug">
                        {course?.title || pref.courseCode}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between">
                      <span>L: {course?.theoryHours_L || 3} P: {course?.practicalHours_P || 2}</span>
                      <span className="font-bold text-slate-700">Credits: {course?.credits_C || 4}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MY ALLOCATED SUBJECTS TABLE */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <BookOpen className="size-4 text-[#002147]" />
                  My Allocated Subjects
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official subjects allocated by the Head of Department for this academic session.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
                {workload?.allocatedCoursesCount || 0} Assigned Courses
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="text-[11px] font-bold text-slate-600 bg-slate-100 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Subject Code</th>
                    <th className="px-4 py-3">Subject Name</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3 text-center">Students</th>
                    <th className="px-4 py-3 text-center">Role</th>
                    <th className="px-4 py-3 text-center">Theory</th>
                    <th className="px-4 py-3 text-center">Practical</th>
                    <th className="px-4 py-3 text-center">Total Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {!workload?.allocatedSubjects || workload.allocatedSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No subjects currently allocated by HOD.
                      </td>
                    </tr>
                  ) : (
                    workload.allocatedSubjects.map((sub, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-700">
                          {sub.courseCode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {sub.courseTitle}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {sub.section}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {sub.studentCount}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border">
                            {sub.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-800">
                          {sub.theoryHours} hrs
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold text-slate-800">
                          {sub.practicalHours} hrs
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-blue-900 bg-blue-50 border border-blue-200">
                            {sub.totalHours} hrs
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 4. TAB 2: SUBJECT PREFERENCE SELECTION MODULE */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Syllabus Course Catalog Grouped by Category */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Available Syllabus Curriculum
                </h3>
                <p className="text-xs text-slate-500">
                  Select subjects according to your teaching expertise from SRM 2025 Syllabus.
                </p>
              </div>

              {/* Search & Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400" />
                  <Input
                    placeholder="Search subject..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-7 text-xs bg-slate-50 rounded-md"
                  />
                </div>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
                >
                  <option value="ALL">All Categories</option>
                  <option value="C">Professional Core (C)</option>
                  <option value="D">Discipline Elective (D)</option>
                  <option value="G">Generic Elective (G)</option>
                  <option value="S">Skill Enhancement (S)</option>
                  <option value="AE">Ability Enhancement (AE)</option>
                </select>
              </div>
            </div>

            {/* Render Category Blocks */}
            {categoriesList.map((catKey) => {
              const catInfo = COURSE_CATEGORIES[catKey];
              const coursesInCat = availableCourses.filter((c) => c.category === catKey);

              if (coursesInCat.length === 0) return null;

              return (
                <div
                  key={catKey}
                  className={`rounded-xl border ${catInfo.borderLight} bg-white shadow-sm overflow-hidden`}
                >
                  {/* Category Header */}
                  <div
                    className={`px-4 py-2.5 ${catInfo.bgLight} border-b ${catInfo.borderLight} flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${catInfo.badgeColor}`}>
                        {catKey}
                      </span>
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${catInfo.textColor}`}>
                        {catInfo.name}
                      </h4>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      {coursesInCat.length} subjects
                    </span>
                  </div>

                  {/* Course Cards Grid */}
                  <div className="p-4 grid gap-3 sm:grid-cols-2">
                    {coursesInCat.map((course) => {
                      const isAdded = cart.some((p) => p.courseCode === course.code);
                      const currentRank = cart.find((p) => p.courseCode === course.code)?.rank;

                      return (
                        <div
                          key={course.code}
                          className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between ${
                            isAdded
                              ? 'border-teal-400 bg-teal-50/40 ring-1 ring-teal-400'
                              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                                {course.code}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500 font-mono">
                                Sem {course.semester}
                              </span>
                            </div>
                            <h5 className="font-bold text-xs text-slate-900 mt-2 leading-snug">
                              {course.title}
                            </h5>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between">
                            {/* L T P C badges */}
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600">
                              <span>L <strong>{course.theoryHours_L}</strong></span>
                              <span>T <strong>{course.tutorialHours_T}</strong></span>
                              <span>P <strong>{course.practicalHours_P}</strong></span>
                              <span>C <strong>{course.credits_C}</strong></span>
                            </div>

                            {/* Add CTA */}
                            {isAdded ? (
                              <span className="px-2 py-1 text-[11px] font-bold rounded bg-teal-600 text-white flex items-center gap-1">
                                <CheckCircle2 className="size-3" />
                                Rank #{currentRank}
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleAddPreference(course.code)}
                                className="h-7 px-2.5 text-xs bg-[#002147] hover:bg-[#001833] text-white"
                              >
                                <Plus className="size-3 mr-1" /> Add Preference
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right 1 Col: Ranked Preference Cart */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sticky top-20">
              <div className="border-b pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Preference Ranking
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Order from 1 (Highest) to 5.
                  </p>
                </div>
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                  {cart.length} / 5 Selected
                </span>
              </div>

              {/* Cart Items */}
              <div className="py-3 space-y-2 max-h-96 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed">
                    <Info className="size-6 mx-auto mb-1 opacity-50" />
                    <p className="text-xs">No subjects selected.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Click "[ Add Preference ]" on courses to rank them.</p>
                  </div>
                ) : (
                  cart.map((item, idx) => {
                    const course = courseList.find((c) => c.code === item.courseCode);
                    return (
                      <div
                        key={item.courseCode}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="size-6 rounded-full bg-[#002147] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {item.rank}
                          </span>
                          <div>
                            <p className="font-mono text-xs font-bold text-blue-700">
                              {item.courseCode}
                            </p>
                            <p className="text-xs font-semibold text-slate-900 truncate w-36 sm:w-44" title={course?.title}>
                              {course?.title || item.courseCode}
                            </p>
                          </div>
                        </div>

                        {/* Reorder and remove buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveRank(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveRank(idx, 'down')}
                            disabled={idx === cart.length - 1}
                            className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemovePreference(item.courseCode)}
                            className="p-1 rounded hover:bg-red-100 text-red-600"
                            title="Remove"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Notice */}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-800 leading-relaxed mb-3">
                <strong>Note:</strong> Preferences submitted indicate willingness and expertise. Final class &amp; lab allocations are confirmed by the Head of Department.
              </div>

              {/* Submit CTA */}
              <Button
                onClick={handleSubmitPreferences}
                disabled={cart.length === 0}
                className="w-full bg-[#002147] hover:bg-[#001833] text-white gap-1.5"
              >
                <Send className="size-4 text-teal-300" />
                Submit Preferences to HOD
              </Button>
            </div>
          </div>
        </div>
      )}
    </WorkloadShell>
  );
}
