import { CONTENT_CAPS as C } from '@wildshard/engine/core/config';
import { DEFAULT_GRAPH_BUDGET, validateGraph } from '@wildshard/engine/core/materialGraph';
import { SCRIPT_LIMITS } from '@wildshard/engine/script/host';
import { memoryTargetWarnings, nearbyContentCost, worstContentCost } from './budget';
import type { Shardfile } from './schema';
import { runtimeAccountedBytes } from '../grid/runtimeCost';

/** Native offline observations; script execution is timed separately from physics and checkpoint/IPC work. */
export interface PerformanceObservations {
  scripts: { p95Micros: number; maxMicros: number; samples: number };
  fuel: { p95: number; max: number; samples: number };
}
/** A report issue distinguishes tradeable memory targets from enforceable complete totals and execution budgets. */
export interface PerformanceIssue { metric: string; actual: number; limit: number; severity: 'warning' | 'refusal' }
/** Build-time estimates retain units, their scope, and the measured execution samples they use. */
export interface PerformanceReport {
  slug: string; policy: 'refuse' | 'warn'; pass: boolean;
  native: { resident: number; evidence: string | null; unmeasuredViewAndDownload: boolean };
  memory: { near: ReturnType<typeof nearbyContentCost>; worst: ReturnType<typeof worstContentCost>; playingLimit: number; loadingLimit: number };
  views: { name: string; x: number; z: number; draws: number; triangles: number }[];
  graphs: { id: string; nodes: number; samplers: number; instructions: number }[];
  scripts: PerformanceObservations;
  download: { critical: number; tiles: number; library: number; far: number; total: number; playable: number };
  estimatedPlayable: { seconds: number; bytesPerSecond: number; setupSeconds: number };
  issues: PerformanceIssue[];
}

function closure(source: Shardfile, roots: readonly string[]): Set<string> {
  const files = new Map(source.files.map(file => [file.hash, file])), found = new Set<string>(), pending = [...roots];
  while (pending.length > 0) {
    const ref = pending.pop(); if (ref === undefined || found.has(ref)) continue;
    found.add(ref); pending.push(...files.get(ref)?.dependencies ?? []);
  }
  return found;
}
function totals(source: Shardfile, refs: Iterable<string>): { bytes: number; draws: number; triangles: number } {
  const files = new Map(source.files.map(file => [file.hash, file]));
  let bytes = 0, draws = 0, triangles = 0;
  for (const ref of refs) {
    const shared = ref.startsWith('commons:') ? ref.slice(8) : null;
    const file = files.get(ref), row = shared === null ? file : source.requires.commonsCosts[shared];
    if (row === undefined) throw new Error(`Report requires admitted cost for ${ref}`);
    const wire = shared === null ? file?.compressed : source.requires.commonsWire[shared];
    if (wire === undefined) throw new Error(`Report requires admitted wire size for ${ref}`);
    bytes += wire; draws += row.draws; triangles += row.triangles;
  }
  return { bytes, draws, triangles };
}
const near = (tile: Shardfile['tiles'][number], x: number, z: number): boolean => {
  const dx = Math.max(tile.bounds.min[0] - x, x - tile.bounds.max[0], 0), dz = Math.max(tile.bounds.min[2] - z, z - tile.bounds.max[2], 0);
  return dx * dx + dz * dz <= C.nearRadius ** 2;
};

/** Cheap target grading before asset reads; format integrity and total-memory admission remain separate. */
export function performanceTargetIssues(source: Shardfile, policy: 'refuse' | 'warn' = 'refuse'): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const check = (metric: string, actual: number, limit: number): void => {
    if (actual > limit) issues.push({ metric, actual, limit, severity: policy === 'warn' ? 'warning' : 'refusal' });
  };
  check('library download budget bytes', source.budgets.library.compressed, C.library.compressed);
  check('critical download budget bytes', source.budgets.sim.compressed, C.sim.compressed);
  check('library download bytes', totals(source, closure(source, source.library)).bytes, C.library.compressed);
  check('critical download bytes', totals(source, closure(source, source.critical)).bytes, C.sim.compressed);
  for (const tile of source.tiles) {
    const cap = tile.lod === 0 ? C.l0 : C.l1, id = `tile ${tile.lod}/${tile.x}/${tile.z}`;
    check(`${id} download bytes`, tile.compressed, cap.compressed); check(`${id} draws`, tile.draws, cap.draws); check(`${id} triangles`, tile.triangles, cap.triangles);
  }
  if (source.far !== null) {
    check('far download bytes', source.far.compressed, C.far.compressed); check('far draws', source.far.draws, C.far.draws); check('far triangles', source.far.triangles, C.far.triangles);
  }
  return issues;
}

/** Report deterministic declared bounds and measured native execution; the caller supplies trusted provenance policy. */
export function performanceReport(source: Shardfile, observations: PerformanceObservations, policy: 'refuse' | 'warn' = 'refuse'): PerformanceReport {
  const native = { resident: source.runtime?.cost === undefined ? 0 : runtimeAccountedBytes(source.runtime.cost), evidence: source.runtime?.cost?.evidence ?? null, unmeasuredViewAndDownload: source.runtime !== null };
  const commons = native.resident + Object.values(source.requires.commonsCosts).reduce((sum, row) => sum + row.decoded + row.gpu, 0);
  const worst = worstContentCost(source, commons), spawn = source.spawn;
  const memory = { near: nearbyContentCost(source, spawn.x, spawn.z, commons), worst, playingLimit: C.playing, loadingLimit: C.loading };
  const issues: PerformanceIssue[] = memoryTargetWarnings(source).map(row => ({ metric: `${row.category} resident target (tradeable)`, actual: row.bytes, limit: row.target, severity: 'warning' }));
  issues.push(...performanceTargetIssues(source, policy));
  const check = (metric: string, actual: number, limit: number): void => {
    if (!Number.isFinite(actual) || actual < 0 || actual > limit) issues.push({ metric, actual, limit, severity: policy === 'warn' ? 'warning' : 'refusal' });
  };
  if (native.unmeasuredViewAndDownload) check('native view/download measurement required', 1, 0);
  if (source.runtime !== null && source.runtime.cost === undefined) check('native resident measurement required', 1, 0);
  check('worst playing total bytes', worst.playing, C.playing); check('worst loading total bytes', worst.loading, C.loading);
  const library = closure(source, source.library), critical = closure(source, source.critical);
  const tileRoots = source.tiles.flatMap(tile => tile.files), farRoots = source.far?.files ?? [];
  const playable = closure(source, [...source.critical, ...source.library, ...farRoots, ...source.tiles.filter(tile => tile.lod === 1 || near(tile, spawn.x, spawn.z)).flatMap(tile => tile.files)]);
  const download = { critical: totals(source, critical).bytes, tiles: totals(source, closure(source, tileRoots)).bytes,
    library: totals(source, library).bytes, far: totals(source, closure(source, farRoots)).bytes,
    total: totals(source, closure(source, [...source.critical, ...source.library, ...tileRoots, ...farRoots])).bytes, playable: totals(source, playable).bytes };
  const libraryView = totals(source, library);
  const views = [['spawn', spawn.x, spawn.z], ['worst memory', ...worst.location]].map(([name, x, z]) => {
    if (typeof name !== 'string' || typeof x !== 'number' || typeof z !== 'number') throw new Error('Invalid report view');
    const tiles = source.tiles.filter(tile => tile.lod === 1 || near(tile, x, z));
    return { name, x, z, draws: libraryView.draws + (source.far?.draws ?? 0) + tiles.reduce((sum, tile) => sum + tile.draws, 0),
      triangles: libraryView.triangles + (source.far?.triangles ?? 0) + tiles.reduce((sum, tile) => sum + tile.triangles, 0) };
  });
  const graphs: PerformanceReport['graphs'] = [];
  // inline graphs (a graph file is checked with its bytes at product admission; a preset is engine-owned, under its own budget)
  for (const [id, material] of Object.entries(source.look.materials)) if (material.family === 'graph' && 'graph' in material) {
    const result = validateGraph(material.graph);
    if (!result.ok) throw new Error(`Report requires an admitted material graph: ${id}`);
    graphs.push({ id, ...result.cost });
    for (const metric of ['nodes', 'samplers', 'instructions'] as const) check(`graph ${id} ${metric}`, result.cost[metric], DEFAULT_GRAPH_BUDGET[metric]);
  }
  const scriptLimit = Math.min(source.serverBudget.tickMicros, 1_000_000 / 60 / 4);
  for (const [group, data] of ([['scripts', observations.scripts], ['fuel', observations.fuel]] as const)) for (const [metric, value] of Object.entries(data)) {
    if (!Number.isFinite(value) || value < 0) check(`invalid measured ${group}.${metric}`, value, 0);
  }
  check('script CPU p95 us/tick', observations.scripts.p95Micros, scriptLimit);
  check('script fuel/tick', observations.fuel.max, SCRIPT_LIMITS.fuelPerTick);
  if (observations.scripts.samples < 60 || observations.fuel.samples < 60) check('missing execution samples', 60, Math.min(observations.scripts.samples, observations.fuel.samples));
  // An explicit cold-network estimate, not a measured phone loading claim. The guide names both assumptions.
  const bytesPerSecond = 1_000_000, setupSeconds = 1;
  return { slug: source.identity.slug, policy, pass: !issues.some(issue => issue.severity === 'refusal'), native, memory, views, graphs, scripts: observations, download,
    estimatedPlayable: { seconds: setupSeconds + download.playable / bytesPerSecond, bytesPerSecond, setupSeconds }, issues };
}

/** Human-readable card keeps estimates visibly distinct from measurements and prints every enforced limit. */
export function performanceReportLines(report: PerformanceReport): string[] {
  const mb = (bytes: number): string => `${(bytes / 1_000_000).toFixed(3)} MB`;
  return [`PERFORMANCE REPORT ${report.slug}: ${report.pass ? 'PASS' : 'REFUSED'} (${report.policy})`,
    `native runtime: charged ${mb(report.native.resident)}${report.native.evidence === null ? '' : ` from ${report.native.evidence}`}; ${report.native.unmeasuredViewAndDownload ? 'view/download remainder UNMEASURED (port required)' : 'none'}`,
    `estimated memory near player (${report.memory.near.location.join(', ')}): play ${mb(report.memory.near.playing)}, load ${mb(report.memory.near.loading)}`,
    `estimated worst grid memory (${report.memory.worst.location.join(', ')}): play ${mb(report.memory.worst.playing)} / ${mb(report.memory.playingLimit)}, load ${mb(report.memory.worst.loading)} / ${mb(report.memory.loadingLimit)}`,
    ...report.views.map(view => `declared view bounds ${view.name} (${view.x}, ${view.z}): ${view.draws} draws, ${view.triangles} triangles (before frustum/occlusion; excludes engine/native recipes)`),
    ...report.graphs.map(graph => `graph ${graph.id}: ${graph.nodes}/${DEFAULT_GRAPH_BUDGET.nodes} nodes, ${graph.samplers}/${DEFAULT_GRAPH_BUDGET.samplers} samplers, ${graph.instructions}/${DEFAULT_GRAPH_BUDGET.instructions} instructions`),
    ...(report.graphs.length === 0 ? ['graphs: 0 authored graphs; platform family shader presets'] : []),
    report.scripts.scripts.samples === 0 ? 'scripts CPU/fuel: UNMEASURED (execution proof required)' : `measured scripts (${report.scripts.scripts.samples} ticks): p95 ${report.scripts.scripts.p95Micros.toFixed(1)} us/tick, max ${report.scripts.scripts.maxMicros.toFixed(1)} us/tick; fuel p95 ${report.scripts.fuel.p95}, max ${report.scripts.fuel.max}/${SCRIPT_LIMITS.fuelPerTick}`,
    `download closures: critical ${mb(report.download.critical)}, tiles ${mb(report.download.tiles)}, library ${mb(report.download.library)}, far ${mb(report.download.far)}, unique total ${mb(report.download.total)}`,
    `estimated playable ${report.estimatedPlayable.seconds.toFixed(3)} s: ${mb(report.download.playable)} at ${mb(report.estimatedPlayable.bytesPerSecond)}/s + ${report.estimatedPlayable.setupSeconds} s setup (assumptions, not a phone reading)`,
    ...report.issues.map(issue => `${issue.severity.toUpperCase()}: ${issue.metric}: ${issue.actual} > ${issue.limit}`)];
}
