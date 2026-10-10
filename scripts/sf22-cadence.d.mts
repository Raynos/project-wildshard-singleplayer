/** Observed spacing between distinct frame-interval timestamps, or null when no spacing is established. */
export function observedTimestampQuantum(intervals: readonly number[]): number | null;
/** Same-session standing comparison within one observed timestamp quantum, with the original 33.3 ms limit. */
export function cadenceWithinQuantum(crossingP95: number, standingP95: readonly number[], quantum: number | null, limit?: number): boolean;
/** Browser rAF interval between completed draws and the number of unobserved draws in that interval. */
export interface RafCadenceFrame { rafDt: number; missedFrames: number }
/** Apply unchanged absolute/standing cadence bounds to rAF intervals only, refusing any incomplete counter coverage. */
export function rafCadenceWithinQuantum(crossing: readonly RafCadenceFrame[], standing: readonly (readonly RafCadenceFrame[])[], quantum: number | null, limit?: number): boolean;
