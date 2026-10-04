export function compareCounts(baseline: Record<string, unknown>, current: Record<string, Record<string, number>>, hard: Set<string>, paths?: string[], update?: boolean, defer?: boolean): { failures: string[]; warnings: string[] };
export function hardRules(file: string): Set<string>;
