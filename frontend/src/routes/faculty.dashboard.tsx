import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { PortalShell } from "@/components/PortalShell";
import { facultyNav } from "@/components/portal-nav";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ShoppingCart,
  Info,
  BookOpen,
  Lock,
  Search,
  Award,
  Loader2,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/faculty/dashboard")({
  component: FacultyDashboard,
});

interface Subject {
  subject_code: string;
  course_title: string;
  subject_category: string;
  theory_hours_l: number;
  practical_hours_p: number;
  credits_c: number;
}

interface AwardedSubject {
  subject_code: string;
  course_title?: string;
  cohort_name?: string;
  role_type?: string;
  theory_hours: number;
  lab_hours: number;
}

const CHART_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#818cf8",
  "#7c3aed",
  "#4f46e5",
  "#4338ca",
];
const DONUT_COLORS = ["#6366f1", "#06b6d4"];

const MAX_SELECTIONS = 10;

function FacultyDashboard() {
  const { session } = useAuth();
  const [programType, setProgramType] = useState("UG");
  const [semesterType, setSemesterType] = useState("Odd");
  const [searchTerm, setSearchTerm] = useState("");

  // State transition
  const [isPublished, setIsPublished] = useState(false);
  const [checkingState, setCheckingState] = useState(true);

  // Willingness Form state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Finalized Dashboard state
  const [awardedSubjects, setAwardedSubjects] = useState<AwardedSubject[]>([]);

  // Check lock state on mount
  useEffect(() => {
    async function checkLockState() {
      setCheckingState(true);
      try {
        const res = await api.get("/api/faculty/workload", {
          params: { program_type: programType, semester_type: semesterType },
        });
        if (res.data.is_published || res.data.is_locked) {
          setIsPublished(true);
          setAwardedSubjects(res.data.awarded_subjects || res.data.subjects || []);
        } else {
          setIsPublished(false);
        }
      } catch {
        // If endpoint fails, default to willingness form
        setIsPublished(false);
      } finally {
        setCheckingState(false);
      }
    }
    checkLockState();
  }, [programType, semesterType]);

  // Fetch form data for willingness
  useEffect(() => {
    if (isPublished || checkingState) return;

    async function fetchFormData() {
      setLoading(true);
      try {
        const res = await api.get("/api/faculty/form-data", {
          params: { program_type: programType, semester_type: semesterType },
        });
        setSubjects(res.data.subjects || []);
        setSelectedSubjects([]);
      } catch (err: any) {
        console.error("Failed to fetch form data:", err);
        toast.error("Failed to fetch curriculum data.");
      } finally {
        setLoading(false);
      }
    }
    fetchFormData();
  }, [programType, semesterType, isPublished, checkingState]);

  const handleToggleSubject = (code: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_SELECTIONS) return prev; // Enforce cap
      return [...prev, code];
    });
  };

  const isMaxReached = selectedSubjects.length >= MAX_SELECTIONS;

  const handleSubmit = async () => {
    if (selectedSubjects.length === 0) return;
    setSubmitting(true);
    try {
      await api.post("/api/faculty/submit-cart", {
        program_type: programType,
        semester_type: semesterType,
        subject_codes: selectedSubjects,
      });
      toast.success("Preferences submitted successfully!");
      setSelectedSubjects([]);
    } catch (err: any) {
      toast.error(
        err.message || "Failed to submit preferences."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Filter subjects by search
  const filteredSubjects = subjects.filter((sub) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      sub.subject_code.toLowerCase().includes(term) ||
      sub.course_title.toLowerCase().includes(term) ||
      sub.subject_category?.toLowerCase().includes(term)
    );
  });

  // Chart data for finalized view
  const donutData = useMemo(() => {
    const totalTheory = awardedSubjects.reduce(
      (sum, s) => sum + (s.theory_hours || 0),
      0
    );
    const totalLab = awardedSubjects.reduce(
      (sum, s) => sum + (s.lab_hours || 0),
      0
    );
    return [
      { name: "Theory Hours", value: totalTheory },
      { name: "Lab Hours", value: totalLab },
    ];
  }, [awardedSubjects]);

  const barData = useMemo(() => {
    return awardedSubjects.map((s) => ({
      name: s.subject_code,
      Theory: s.theory_hours || 0,
      Lab: s.lab_hours || 0,
      Total: (s.theory_hours || 0) + (s.lab_hours || 0),
    }));
  }, [awardedSubjects]);

  const totalAwarded = useMemo(() => {
    return awardedSubjects.reduce(
      (sum, s) => sum + (s.theory_hours || 0) + (s.lab_hours || 0),
      0
    );
  }, [awardedSubjects]);

  if (checkingState) {
    return (
      <PortalShell
        role="faculty"
        title={`Welcome, ${session?.name || "Faculty"}`}
        subtitle="Loading your workspace..."
        nav={facultyNav}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary opacity-60" />
        </div>
      </PortalShell>
    );
  }

  // ────────────────────────────────────────────
  // FINALIZED WORKLOAD DASHBOARD (is_published)
  // ────────────────────────────────────────────
  if (isPublished) {
    return (
      <PortalShell
        role="faculty"
        title={`Welcome, ${session?.name || "Faculty"}`}
        subtitle="Your finalized workload allocation"
        nav={facultyNav}
      >
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Lock Banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
            <Lock className="size-5 text-indigo-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">
                Workload Finalized & Published
              </p>
              <p className="text-xs text-indigo-600/70">
                Your teaching allocation has been officially confirmed by
                administration.
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm backdrop-blur-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Total Subjects
              </p>
              <p className="text-3xl font-black text-foreground">
                {awardedSubjects.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm backdrop-blur-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Total Hours
              </p>
              <p className="text-3xl font-black text-primary">
                {totalAwarded}h
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm backdrop-blur-sm">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Session
              </p>
              <p className="text-lg font-bold text-foreground">
                {programType} — {semesterType}
              </p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Donut Chart */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon className="size-5 text-primary" />
                <h3 className="font-bold text-foreground">
                  Hours Breakdown
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={10}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bar Chart */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="size-5 text-primary" />
                <h3 className="font-bold text-foreground">
                  Hours by Subject
                </h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend iconType="circle" iconSize={10} />
                  <Bar
                    dataKey="Theory"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="Lab"
                    fill="#06b6d4"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Awarded Subjects Grid */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center gap-2">
              <Award className="size-5 text-primary" />
              <h3 className="font-bold text-foreground">
                Awarded Subjects & Cohorts
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-muted-foreground bg-muted/30 uppercase">
                  <tr>
                    <th className="px-6 py-3 font-bold tracking-wider">
                      Subject Code
                    </th>
                    <th className="px-6 py-3 font-bold tracking-wider">
                      Course Title
                    </th>
                    <th className="px-6 py-3 font-bold tracking-wider">
                      Cohort
                    </th>
                    <th className="px-6 py-3 font-bold tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 font-bold tracking-wider text-center">
                      Theory
                    </th>
                    <th className="px-6 py-3 font-bold tracking-wider text-center">
                      Lab
                    </th>
                    <th className="px-6 py-3 font-bold tracking-wider text-center">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {awardedSubjects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-muted-foreground"
                      >
                        No awarded subjects found.
                      </td>
                    </tr>
                  ) : (
                    awardedSubjects.map((sub, idx) => (
                      <tr
                        key={`${sub.subject_code}_${idx}`}
                        className={`hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "bg-muted/5" : ""}`}
                      >
                        <td className="px-6 py-3">
                          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                            {sub.subject_code}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-medium text-foreground">
                          {sub.course_title || "-"}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {sub.cohort_name || "-"}
                        </td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                            {sub.role_type || "Main"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center font-mono font-semibold">
                          {sub.theory_hours || 0}h
                        </td>
                        <td className="px-6 py-3 text-center font-mono font-semibold">
                          {sub.lab_hours || 0}h
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className="inline-flex items-center justify-center rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-xs font-bold text-indigo-700">
                            {(sub.theory_hours || 0) + (sub.lab_hours || 0)}h
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
      </PortalShell>
    );
  }

  // ────────────────────────────────────────────
  // WILLINGNESS FORM (not published)
  // ────────────────────────────────────────────
  return (
    <PortalShell
      role="faculty"
      title={`Welcome, ${session?.name || "Faculty"}`}
      subtitle="Select your preferred subjects for the upcoming academic session."
      nav={facultyNav}
    >
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Workspace Session Controls */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active Session Context
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Program:</span>
              <ToggleGroup
                type="single"
                value={programType}
                onValueChange={(v) => v && setProgramType(v)}
                className="bg-muted p-1 rounded-xl"
              >
                <ToggleGroupItem
                  value="UG"
                  className="rounded-lg px-3 text-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
                >
                  UG
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="PG"
                  className="rounded-lg px-3 text-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
                >
                  PG
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Semester:</span>
              <ToggleGroup
                type="single"
                value={semesterType}
                onValueChange={(v) => v && setSemesterType(v)}
                className="bg-muted p-1 rounded-xl"
              >
                <ToggleGroupItem
                  value="Odd"
                  className="rounded-lg px-3 text-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
                >
                  Odd
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="Even"
                  className="rounded-lg px-3 text-sm data-[state=on]:bg-background data-[state=on]:shadow-sm"
                >
                  Even
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Pane: Available Curriculum */}
          <div className="w-full lg:flex-1 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="bg-muted/30 p-4 border-b border-border/50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                <h2 className="font-semibold">Available Curriculum</h2>
              </div>
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm rounded-lg"
                />
              </div>
            </div>

            <div className="p-4">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted-foreground">
                  <Loader2 className="size-6 animate-spin text-primary mr-2" />
                  <span>Loading curriculum data...</span>
                </div>
              ) : filteredSubjects.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  <Info className="size-6 mb-2 opacity-50" />
                  <p className="text-sm">
                    {subjects.length === 0
                      ? "No subjects found for this session."
                      : "No matching subjects."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {filteredSubjects.map((sub) => {
                    const isSelected = selectedSubjects.includes(
                      sub.subject_code
                    );
                    const isDisabled = !isSelected && isMaxReached;
                    return (
                      <div
                        key={sub.subject_code}
                        className={`relative rounded-xl border p-4 transition-all duration-200 ${
                          isDisabled
                            ? "border-border/50 bg-muted/50 opacity-50 cursor-not-allowed"
                            : isSelected
                              ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm cursor-pointer"
                              : "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
                        }`}
                        onClick={() =>
                          !isDisabled && handleToggleSubject(sub.subject_code)
                        }
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <p className="text-xs font-mono text-muted-foreground mb-1">
                              {sub.subject_code}
                            </p>
                            <h3 className="text-sm font-semibold text-foreground leading-tight">
                              {sub.course_title}
                            </h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                                {sub.subject_category}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground border border-border/50">
                                L:{sub.theory_hours_l} P:
                                {sub.practical_hours_p} C:
                                {sub.credits_c}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 mt-1">
                            {isSelected ? (
                              <CheckCircle2 className="size-5 text-primary" />
                            ) : isDisabled ? (
                              <div className="size-5 rounded-full border-2 border-muted-foreground/20 bg-muted" />
                            ) : (
                              <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Willingness Cart */}
          <div className="w-full lg:w-80 shrink-0 sticky top-6">
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
              <div className="bg-primary/10 p-4 border-b border-primary/20 flex items-center gap-2 text-primary">
                <ShoppingCart className="size-5" />
                <h2 className="font-semibold">Willingness Cart</h2>
                <span className="ml-auto rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
                  {selectedSubjects.length}/{MAX_SELECTIONS}
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-4">
                {/* Cap Warning */}
                {isMaxReached && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2 animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">
                        Maximum {MAX_SELECTIONS} subjects reached
                      </p>
                      <p className="text-amber-700/70 mt-0.5">
                        Deselect a subject to choose a different one.
                      </p>
                    </div>
                  </div>
                )}

                {/* Selected Items */}
                <div className="min-h-[120px] max-h-[350px] overflow-y-auto pr-1">
                  {selectedSubjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center mt-8">
                      Your cart is empty. Select subjects from the curriculum.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedSubjects.map((code) => {
                        const sub = subjects.find(
                          (s) => s.subject_code === code
                        );
                        return (
                          <div
                            key={code}
                            className="flex justify-between items-center rounded-lg border bg-muted/20 px-3 py-2 group hover:border-destructive/50 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-mono font-medium">
                                {code}
                              </p>
                              <p
                                className="text-xs text-muted-foreground truncate w-40"
                                title={sub?.course_title}
                              >
                                {sub?.course_title}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSubject(code);
                              }}
                              className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded group-hover:text-destructive group-hover:bg-destructive/10 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mt-2 border-t pt-4">
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className="text-muted-foreground">
                      Selection Progress
                    </span>
                    <span className="font-bold text-foreground">
                      {selectedSubjects.length} / {MAX_SELECTIONS}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isMaxReached ? "bg-amber-500" : "bg-primary"}`}
                      style={{
                        width: `${(selectedSubjects.length / MAX_SELECTIONS) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t bg-muted/10">
                <Button
                  className="w-full rounded-xl"
                  onClick={handleSubmit}
                  disabled={
                    selectedSubjects.length === 0 || submitting
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Preferences"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
