interface Phase { key: string; label: string; ms: number }
interface Timing { requestedAt: number; readyAt: number; start: number; checkpointEnd: number; commitEnd: number; end: number; from: string | null; to: string | null }
interface Evidence { done: boolean; errors: string[]; timings: Timing[]; rows: Phase[][] }
export function crossingProbeCode(): string;
export function crossingReport(state: Evidence | undefined): { transitions: { from: string | null; to: string | null; wallMs: number; stageMs: number; rows: Phase[] }[]; failures: string[] };
