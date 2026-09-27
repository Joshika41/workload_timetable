import { createFileRoute } from "@tanstack/react-router";
import { WorkloadShell } from "@/components/WorkloadShell";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/faculty/timetable")({
  component: FacultyTimetablePage,
});

function FacultyTimetablePage() {
  return (
    <WorkloadShell
      role="faculty"
      title="My Timetable"
      subtitle="Your scheduled classes for this academic context"
    >
      <div className="flex flex-col items-center justify-center p-12 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
        <div className="size-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
          <Clock className="size-10 text-blue-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Your timetable has not been generated yet.</h2>
        <p className="text-slate-500 max-w-md text-center text-sm">
          Once the administrative team finalizes the allocations and generates the schedule, your personalized timetable will appear here.
        </p>
      </div>
    </WorkloadShell>
  );
}
