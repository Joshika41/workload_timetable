import { DAYS, PERIODS, type Slot } from "@/lib/erp-data";

interface Props {
  grid: (Slot | null)[][];
  showSection?: boolean;
  showFaculty?: boolean;
}

/** Strict 5 day x exactly 6 period grid. */
export function TimetableGrid({ grid, showSection = false, showFaculty = false }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="w-28 border-r border-primary-foreground/15 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">
              Day
            </th>
            {PERIODS.map((p) => (
              <th
                key={p}
                className="border-r border-primary-foreground/15 px-3 py-2.5 text-center text-xs font-semibold last:border-r-0"
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day, d) => (
            <tr key={day} className="border-t border-border even:bg-muted/40">
              <th className="border-r border-border px-3 py-2.5 text-left text-xs font-semibold text-foreground">
                {day}
              </th>
              {Array.from({ length: 6 }).map((_, p) => {
                const slot = grid[d]?.[p] ?? null;
                return (
                  <td
                    key={p}
                    className="h-20 border-r border-border px-2 py-2 align-top text-center last:border-r-0"
                  >
                    {slot ? (
                      <div className="flex h-full flex-col items-center justify-center gap-0.5">
                        <span className="text-[13px] font-semibold leading-tight text-foreground">
                          {slot.subject}
                        </span>
                        <span className="rounded bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                          {slot.venue}
                        </span>
                        {showSection ? (
                          <span className="text-[11px] text-muted-foreground">{slot.section}</span>
                        ) : null}
                        {showFaculty ? (
                          <span className="text-[11px] text-muted-foreground">{slot.faculty}</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
