/** Refuse invalid commands before the harness acquires heavy resources. */
export function validateFrameFloorArgs(args: readonly string[]): void;
/** Parse a route:start:end selection in whole seconds, bounded to twenty seconds. */
export function parseSafariWindow(value: string): { route: string; fromMs: number; toMs: number } | null;
