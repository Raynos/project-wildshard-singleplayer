/** Refuse invalid commands before the harness acquires heavy resources. */
export function validateFrameFloorArgs(args: readonly string[]): void;
/** Page CPU throttle for profiles or explicit EP10 4x; never a Simulator floor override. */
export function frameFloorChromiumCpuRate(args: readonly string[]): number;
/** Parse a route:start:end selection in whole seconds, bounded to twenty seconds. */
export function parseSafariWindow(value: string): { route: string; fromMs: number; toMs: number } | null;

/** Report-only mode is explicit; ordinary floor enforcement is unchanged. */
export function frameFloorDrawBudgetMode(args: readonly string[]): 'enforce' | 'report-only';
