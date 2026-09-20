/**
 * `?perfload=1` — load-path instrumentation (docs/plans/LOAD-PERF.md, Status table). Logs every
 * program the renderer builds during the `shaders` / `firstFrame` steps with the material it came
 * from, per-batch wall ms, and what the first real frames still had to compile. Everything lands in
 * `window.__perfload` (rows) and `console.info` so a headless run can read it back.
 */
import type * as THREE from 'three';

export const PERFLOAD = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perfload');

/** three's WebGLProgram, the parts the boot reads (r.info.programs is typed as `unknown` entries) */
export interface ProgramLike { type: string; name: string; cacheKey: string; usedTimes: number; id: number; isReady: () => boolean; program: WebGLProgram }
type Programs = readonly ProgramLike[];

export interface PerfRow { phase: string; ms: number; programs: number; detail: string }
export const perfRows: PerfRow[] = [];
/** every painted (t ms, setup, download, step) of the loading screen — the bar's continuity, readable headless */
export const barTrace: [number, number, number, string][] = [];
if (typeof window !== 'undefined') Object.assign(window, { __perfload: perfRows, __perfbar: barTrace });

const programsOf = (r: THREE.WebGLRenderer): Programs => (r.info.programs ?? []) as unknown as Programs;

/** The programs that exist now, as a set (diff against later to see what a render compiled). */
export function snapshotPrograms(r: THREE.WebGLRenderer): Set<ProgramLike> { return new Set(programsOf(r)); }

/** Human-readable id of a program: material type, name, the custom cache key tail, and the depth-packing/light counts. */
export function describeProgram(p: ProgramLike): string {
  const parts = p.cacheKey.split(',');
  const custom = parts[parts.length - 1] ?? '';
  // getProgramCacheKeyParameters order (WebGLPrograms.js): …, numDirLights is index ~? — keep it simple: show the raw tail
  return `${p.type}${p.name ? `/${p.name}` : ''}${custom ? ` [${custom}]` : ''} #${p.id}`;
}

export function newProgramsSince(r: THREE.WebGLRenderer, before: Set<ProgramLike>): ProgramLike[] {
  return programsOf(r).filter((p) => !before.has(p));
}

export function perfLog(phase: string, ms: number, r: THREE.WebGLRenderer, detail: string): void {
  if (!PERFLOAD) return;
  perfRows.push({ phase, ms: Math.round(ms * 10) / 10, programs: programsOf(r).length, detail });
  console.info(`[perfload] ${phase.padEnd(28)} ${String(Math.round(ms)).padStart(6)} ms  programs=${programsOf(r).length}  ${detail}`);
}

/** Every program the renderer holds, one line each (for the final table). */
export function dumpPrograms(r: THREE.WebGLRenderer): string[] { return programsOf(r).map(describeProgram); }

export const parallelCompile = (r: THREE.WebGLRenderer): boolean => r.extensions.has('KHR_parallel_shader_compile');
