import type { LoadingReport } from '../admin-data/types.mjs';

interface Capture { shard: string; cache: 'cold' | 'warm'; status: string; playMs: number | null; tapToOriginMs: number }
interface Analysis { base: string; phases: readonly (readonly [string, number])[]; longTasks: readonly { atMs: number; durMs: number; appLeaf: readonly (readonly [string, number])[] }[] }
export function loadingReport(pin: string, device: string, captures: readonly Capture[], analyses: readonly Analysis[]): LoadingReport;
/** Label one measured CPU rate; mixed or missing rates cannot silently inherit a historical ruler. */
export function loadingDevice(captures: readonly { cpu: unknown }[]): string;
