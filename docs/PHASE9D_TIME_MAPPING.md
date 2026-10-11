# Phase 9D: ERP to KAIROS Time Domain Mapping

## Challenge
KAIROS internally models schedules by hours (e.g., 0=08:00, 1=09:00). SRM University operates on an uneven period block system featuring 45-minute academic units, with non-standard breaks (e.g., a 15-minute break between periods 3 and 4). If directly passed to KAIROS, wall-clock hours fail to align with these discrete teaching units.

## Solution Strategy
The adapter abstracts away wall-clock times completely, substituting discrete mathematical slots that perfectly map to SRM periods.

## Mapping Table

| SRM Period | Time (Wall) | KAIROS Slot | Math Operation (ERP -> KAIROS) |
|------------|-------------|-------------|--------------------------------|
| Period 1   | 08:00       | 0           | P - 1                          |
| Period 2   | 08:45       | 1           | P - 1                          |
| Period 3   | 09:30       | 2           | P - 1                          |
| BREAK      | 10:15       | N/A         | Unmapped / Handled visually    |
| Period 4   | 10:30       | 3           | P - 1                          |
| Period 5   | 11:15       | 4           | P - 1                          |
| Period 6   | 12:00       | 5           | P - 1                          |

## Implementation Details

1. **Duration Preserved**: An ERP `TeachingSession` with `duration_in_periods = 2` becomes a KAIROS `Block` with `length = 2`. The solver natively prevents the block from splitting across slot boundaries, keeping consecutive periods intact.
2. **Break Independence**: Since the break does not consume an academic period, shifting from P3 to P4 is treated as a continuous transition from Slot 2 to Slot 3 for solver logic. The actual "break" time is purely a UI rendering concern.
3. **Availability Indexing**: ERP availability uses a 0-based day index and 1-based period number. KAIROS blackout slots are derived identically (Slot = `avail.period_number - 1`).

This abstraction cleanly avoids the need to rewrite the solver's time horizon constraints while satisfying all local academic requirements.
