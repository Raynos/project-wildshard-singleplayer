export const PHASE_LIMITS: Record<string, number>;
export interface PendingMemory { fields: string[] }
export interface MemoryResult { verdict: string; reason: string; limitGB: number | undefined; growth?: number | null }
export interface MemoryRow extends MemoryResult { shard: string; phase: string; nativeGB: number | undefined; inspectorGB: number | undefined; previousGB: number | null }
export interface SoakSample { seconds: number; gpuBytes: number; heapBytes: number; geometries: number; textures: number; fps: number }
export function memoryVerdict(shard: string, phase: string, nativeGB: number | undefined, inspectorGB: number | undefined, previousGB: number | undefined, pending?: PendingMemory[]): MemoryResult;
export function parseMemoryRun(nativeText: string, inspectorText: string, shard: string, previous?: Record<string, number>, pending?: PendingMemory[]): MemoryRow[];
export function slopeGrowth(samples: SoakSample[], key: 'gpuBytes' | 'heapBytes'): number | null;
export function flakedFields(report: { flaked?: string[]; boot?: { shard: string; tier: string }; fields?: { field: string; verdict: string }[] }): string[];
export function soakVerdict(samples: SoakSample[], errors?: string[], stuck?: object[]): { verdict: string; failures: string[]; gpuGrowthBytes: number | null; heapGrowthBytes: number | null; fpsFirst: number | null; fpsLast: number | null };

export interface DesktopProjection { shard: string; pose: string; m5FrameMs: number | null; projected3060FrameMs: number | null; targetFrameMs: number; verdict: string; source: string; assumption: string; formula: string }
export function desktopProjections(report: { boot?: { shard?: string; tier?: string }; poses?: Record<string, { frameP95Ms?: number }> }, reference: { k3060: number; source: string; assumption: string }): DesktopProjection[];
