/** Refuse invalid commands before the harness acquires heavy resources. */
export function validateFrameFloorArgs(args: readonly string[]): void;
/** Diagnostic-only page CPU throttle; default1, never a Simulator floor override. */
export function frameFloorChromiumCpuRate(args: readonly string[]): number;
/** Parse a route:start:end selection in whole seconds, bounded to twenty seconds. */
export function parseSafariWindow(value: string): { route: string; fromMs: number; toMs: number } | null;
