/** Independent Chromium floors, with the G658 M1 steady-state MiB targets. */
export const coreMemoryTargets: readonly Readonly<{shard: string; name: string; limitBytes: number}>[];
/** Compare the original 120-second renderer+GPU reading; missing/errors fail as unknown. */
export function coreMemorySummary(input: unknown): {shard: string; name: string; limitBytes: number; totalBytes: number | null; passed: boolean}[];
