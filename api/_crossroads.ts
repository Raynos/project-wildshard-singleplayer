import { CROSSROADS_CONFIG } from '../src/engine/core/crossroads.js';

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): string => typeof value === 'string' ? value.slice(0, max) : '';
function matches(value: unknown, expected: unknown): boolean {
  return object(expected) ? object(value) && Object.entries(expected).every(([key, item]) => matches(value[key], item)) : value === expected;
}
function numbers(value: unknown, keys: readonly string[]): Record<string, number> | null {
  if (!object(value)) return null;
  const result: Record<string, number> = {};
  for (const key of keys) if (value[key] !== undefined) {
    const n = value[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e12) return null;
    result[key] = n;
  }
  return result;
}
export interface CrossroadsReading {
  rigVersion: 1; run: string; series: string; iteration: number; stage: 'started' | 'complete' | 'error' | 'context-loss' | 'interrupted' | 'summary';
  summary?: { runs: number; completed: number; contextLosses: number; errors: number; posted: number; overCapRuns: number };
  config: typeof CROSSROADS_CONFIG;
  context: { userAgent: string; viewport: [number, number]; dpr: number; standalone: boolean; origin: 'hosted' | 'local' };
  stats: { phase: string; memoryKind: 'accounted-content-excludes-engine-base'; format: string; contextLost: boolean; error: string; withinCaps: boolean;
    accounted: Record<string, Record<string, number>>; frames: Record<string, Record<string, number>>;
    churn: Record<string, number>; info: { memory: Record<string, number>; drawingBuffer: [number, number]; jsHeapMB: number | null } } | null;
}
const pair = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 32768);
/** Accept only the fixed experiment and bounded summaries; raw arrays, URLs and arbitrary client fields never persist. */
export function cleanCrossroads(value: unknown): CrossroadsReading | null {
  if (!object(value) || value['rigVersion'] !== 1 || !matches(value['config'], CROSSROADS_CONFIG)) return null;
  const run = text(value['run'], 64), series = text(value['series'], 64), iteration = value['iteration'], stage = value['stage'], c = value['context'];
  if (!series || typeof iteration !== 'number' || !Number.isInteger(iteration) || (stage === 'summary' ? iteration !== 0 || run !== `${series}/summary` : iteration < 1 || iteration > 3 || run !== `${series}/${iteration}`) || (stage !== 'started' && stage !== 'complete' && stage !== 'error' && stage !== 'context-loss' && stage !== 'interrupted' && stage !== 'summary') || !object(c)) return null;
  const ua = text(c['userAgent'], 256), viewport = c['viewport'], dpr = c['dpr'], standalone = c['standalone'], origin = c['origin'];
  if (!ua || !pair(viewport) || typeof dpr !== 'number' || !Number.isFinite(dpr) || dpr <= 0 || dpr > 10 || typeof standalone !== 'boolean' || (origin !== 'hosted' && origin !== 'local')) return null;
  const result: CrossroadsReading = { rigVersion: 1, run, series, iteration, stage, config: CROSSROADS_CONFIG,
    context: { userAgent: ua, viewport, dpr, standalone, origin }, stats: null };
  if (stage === 'summary') {
    const summary = value['summary'];
    if (!object(summary)) return null;
    const { runs, completed, contextLosses, errors, posted, overCapRuns } = summary;
    const valid = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 3;
    if (!valid(runs) || !valid(completed) || !valid(contextLosses) || !valid(errors) || !valid(posted) || !valid(overCapRuns) || completed + contextLosses + errors !== runs || posted > runs || overCapRuns > runs) return null;
    result.summary = { runs, completed, contextLosses, errors, posted, overCapRuns }; return result;
  }
  if (stage === 'started' || stage === 'interrupted') return result;
  const s = value['stats']; if (!object(s)) return null;
  const accounted: Record<string, Record<string, number>> = {}, frames: Record<string, Record<string, number>> = {};
  for (const key of ['l0', 'l1', 'far', 'lib', 'sim', 'total']) {
    const a = object(s['accounted']) ? s['accounted'][key] : undefined;
    if (a === undefined) continue;
    const clean = numbers(a, ['count', 'gpuGeomB', 'gpuTexB', 'cpuB', 'padB', 'jsCopyB', 'tris', 'draws', 'overCap', 'residentMB']);
    if (!clean) return null; accounted[key] = clean;
  }
  for (const key of ['empty', 'settle', 'measure']) {
    const f = object(s['frames']) ? s['frames'][key] : undefined;
    if (f === undefined || f === null) continue;
    const clean = numbers(f, ['frames', 'fps', 'p50ms', 'p95ms', 'p99ms', 'under33pct', 'under17pct', 'renderCpuP50ms', 'renderCpuP95ms', 'calls', 'triangles']);
    if (!clean) return null; frames[key] = clean;
  }
  const format = text(s['format'], 16), error = text(s['error'], 240), contextLost = s['contextLost'] === true;
  if (stage === 'complete' && (s['phase'] !== 'done' || error || contextLost || !['astc4x4', 'bc3', 'rgba8'].includes(format) || (frames['measure']?.['frames'] ?? 0) < 1 || (accounted['total']?.['residentMB'] ?? 0) <= 0)) return null;
  if (stage === 'complete') {
    const counts = { l0: CROSSROADS_CONFIG.n0, l1: CROSSROADS_CONFIG.n1, far: CROSSROADS_CONFIG.nf, lib: CROSSROADS_CONFIG.libs, sim: CROSSROADS_CONFIG.sims };
    for (const [key, count] of Object.entries(counts)) if (accounted[key]?.['count'] !== count) return null;
    for (const field of ['gpuGeomB', 'gpuTexB', 'cpuB', 'jsCopyB']) {
      let sum = 0;
      for (const key of Object.keys(counts)) { const n = accounted[key]?.[field]; if (n === undefined) return null; sum += n; }
      if (accounted['total']?.[field] !== sum) return null;
    }
    const total = accounted['total'];
    if (!total || total['residentMB'] !== Math.round(((total['gpuGeomB'] ?? 0) + (total['gpuTexB'] ?? 0) + (total['cpuB'] ?? 0)) / 1e4) / 100) return null;
  }
  const rawInfo = object(s['info']) ? s['info'] : {}, memory = numbers(rawInfo['memory'] ?? {}, ['geometries', 'textures']);
  if (!memory) return null;
  const drawingBuffer = pair(rawInfo['drawingBuffer']) ? rawInfo['drawingBuffer'] : viewport;
  const heap = rawInfo['jsHeapMB'];
  if (heap !== undefined && heap !== null && (typeof heap !== 'number' || !Number.isFinite(heap) || heap < 0 || heap > 100_000)) return null;
  const churn = s['churn'] === undefined ? {} : numbers(s['churn'], ['swaps', 'liveMax', 'buildMsP50', 'buildMsMax']);
  if (!churn) return null;
  result.stats = { phase: text(s['phase'], 16), memoryKind: 'accounted-content-excludes-engine-base', format, contextLost, error,
    withinCaps: ['l0', 'l1', 'far', 'lib', 'sim'].every((key) => accounted[key]?.['overCap'] === 0), accounted, frames, churn,
    info: { memory, drawingBuffer, jsHeapMB: typeof heap === 'number' ? heap : null } };
  return result;
}
