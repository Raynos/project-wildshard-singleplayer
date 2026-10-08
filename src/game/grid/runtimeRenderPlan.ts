import type { Scope } from '@wildshard/engine/app/scope';
import type { RingLevel, RingView } from './rings';
import { runtimeAccountedBytes, type RuntimeCost } from './runtimeCost';

/** Immutable shared presentation resource; count retained CPU data and all GPU buffers/mips once by stable id.
 * Per-chunk clones belong to the chunk. The same id must mean the same resource and byte shape across a page. */
export interface RuntimeRenderDependency { readonly id: string; readonly jsBytes: number; readonly gpuBytes: number }
/** One independently disposable component in the 8x8 L0 / 4x4 L1 / one far layout. Components may share a tile.
 * Gameplay, authoritative colliders and actor clocks remain in the whole-shard simulation. */
export interface RuntimeRenderChunk {
  readonly id: string; readonly level: RingLevel; readonly x: number; readonly z: number;
  readonly dependencyIds: readonly string[]; readonly jsBytes: number; readonly gpuBytes: number;
}
/**
 * G208 pure preflight, evaluated before world construction. nonStreamingBytes is already accounted bytes, without
 * another 1.11 conversion. It retains all opaque/unclassified cost (physics, actors, scripts, UI and non-disposable
 * caches). Provenance matches the reviewed whole runtime; the full inventory must cover its cost. That floor is not
 * a substitute for reviewing ownership/residual calculations: eager whole-model/forest allocation cannot be deducted.
 */
export interface RuntimeRenderPlan {
  readonly measurement: Pick<RuntimeCost, 'rev' | 'evidence'>;
  readonly nonStreamingBytes: number;
  readonly dependencies: readonly RuntimeRenderDependency[];
  readonly chunks: readonly RuntimeRenderChunk[];
}
/**
 * The renderer boundary. Component AND dependencies are admitted before prepare receives its construction Scope;
 * never build the whole scene and slice it afterward. Shared resources have declared, refcounted identity and retain
 * no uncharged cache after the last admitted consumer leaves. prepare reports once. upload transfers its prepared
 * payload into an owned view; disposal frees objects/resources before claims. discard frees unpublished or late work,
 * including completion after Scope cancellation. Visual coverage/shadows alone change; sim colliders stay whole-shard.
 */
export interface RuntimeRenderPorts<T> {
  readonly prepare: (chunk: RuntimeRenderChunk, scope: Scope, done: (result: T | Error) => void, dependencies: RuntimeRenderDependencyScopes) => void;
  readonly upload: (chunk: RuntimeRenderChunk, prepared: T, scope: Scope) => RingView;
  readonly discard: (chunk: RuntimeRenderChunk, prepared: T) => void;
}
/** Only this component's admitted dependencies. Allocate once by shared scope identity; cancelled work cannot read it. */
export interface RuntimeRenderDependencyScopes { readonly scope: (dependencyId: string) => Scope }
/** Selected components and their dependency union, with the residual retained until the region disposes. */
export interface RuntimeRenderFootprint {
  readonly nonStreamingBytes: number; readonly chunkJsBytes: number; readonly chunkGpuBytes: number;
  readonly dependencyJsBytes: number; readonly dependencyGpuBytes: number; readonly totalBytes: number;
  readonly chunks: readonly RuntimeRenderChunk[]; readonly dependencies: readonly RuntimeRenderDependency[];
}
/** Immutable checked inventory. Pure costs: no allocation, installed renderer or discount of an existing live claim. */
export interface RuntimeRenderInventory {
  readonly full: RuntimeRenderFootprint; readonly measuredWholeBytes: number;
  readonly measurement: Pick<RuntimeCost, 'rev' | 'evidence'>; readonly nonStreamingBytes: number;
  readonly footprint: (chunkIds: readonly string[]) => RuntimeRenderFootprint;
  readonly tile: (level: RingLevel, x: number, z: number) => readonly RuntimeRenderChunk[];
}
const validId = /^[a-z0-9][a-z0-9._:-]{0,159}$/u;
function bytes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid runtime render byte count');
  return value;
}
function sum(a: number, b: number): number { return bytes(a + b); }
function coordinate(level: RingLevel, x: number, z: number): string {
  const side = { far: 1, l1: 4, l0: 8 }[level];
  if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= side || z >= side) throw new RangeError('Invalid runtime render tile');
  return `${level}:${String(x)}:${String(z)}`;
}
/** Refuse stale, dangling or under-counted preflight before allocation, and snapshot the trusted input. */
export function compileRuntimeRenderPlan(input: RuntimeRenderPlan, measured: RuntimeCost): RuntimeRenderInventory {
  const measuredWholeBytes = runtimeAccountedBytes(measured);
  if (input.measurement.rev !== measured.rev || input.measurement.evidence !== measured.evidence) throw new Error('Runtime render plan differs from its reviewed measurement');
  const nonStreamingBytes = bytes(input.nonStreamingBytes);
  if (nonStreamingBytes === 0 || input.chunks.length === 0) throw new Error('Runtime render plan requires its residual and presentation inventory');
  const dependencies = new Map<string, RuntimeRenderDependency>(), chunks = new Map<string, RuntimeRenderChunk>(), tiles = new Map<string, readonly RuntimeRenderChunk[]>();
  for (const row of input.dependencies) {
    if (!validId.test(row.id) || dependencies.has(row.id)) throw new Error('Invalid or duplicate runtime render dependency');
    dependencies.set(row.id, Object.freeze({ id: row.id, jsBytes: bytes(row.jsBytes), gpuBytes: bytes(row.gpuBytes) }));
  }
  const used = new Set<string>();
  for (const row of input.chunks) {
    if (!validId.test(row.id) || chunks.has(row.id) || dependencies.has(row.id)) throw new Error('Invalid or duplicate runtime render chunk');
    const at = coordinate(row.level, row.x, row.z), refs = new Set(row.dependencyIds);
    if (refs.size !== row.dependencyIds.length) throw new Error('Duplicate runtime render dependency reference');
    for (const id of refs) { if (!dependencies.has(id)) throw new Error('Unknown runtime render dependency'); used.add(id); }
    const chunk = Object.freeze({ id: row.id, level: row.level, x: row.x, z: row.z,
      dependencyIds: Object.freeze([...refs].sort()), jsBytes: bytes(row.jsBytes), gpuBytes: bytes(row.gpuBytes) });
    chunks.set(row.id, chunk); tiles.set(at, [...(tiles.get(at) ?? []), chunk]);
  }
  if (used.size !== dependencies.size) throw new Error('Unused runtime render dependency must stay in the residual');
  const measurement = Object.freeze({ rev: measured.rev, evidence: measured.evidence });
  const footprint = (ids: readonly string[]): RuntimeRenderFootprint => {
    const selected: RuntimeRenderChunk[] = [], shared = new Set<string>();
    let chunkJsBytes = 0, chunkGpuBytes = 0, dependencyJsBytes = 0, dependencyGpuBytes = 0;
    for (const id of [...new Set(ids)].sort()) {
      const chunk = chunks.get(id); if (chunk === undefined) throw new Error('Unknown runtime render chunk');
      selected.push(chunk); chunkJsBytes = sum(chunkJsBytes, chunk.jsBytes); chunkGpuBytes = sum(chunkGpuBytes, chunk.gpuBytes);
      for (const dependency of chunk.dependencyIds) shared.add(dependency);
    }
    const selectedDependencies: RuntimeRenderDependency[] = [];
    for (const id of [...shared].sort()) {
      const dependency = dependencies.get(id); if (dependency === undefined) throw new Error('Unknown runtime render dependency');
      selectedDependencies.push(dependency); dependencyJsBytes = sum(dependencyJsBytes, dependency.jsBytes); dependencyGpuBytes = sum(dependencyGpuBytes, dependency.gpuBytes);
    }
    const totalBytes = sum(sum(sum(nonStreamingBytes, chunkJsBytes), chunkGpuBytes), sum(dependencyJsBytes, dependencyGpuBytes));
    return Object.freeze({ nonStreamingBytes, chunkJsBytes, chunkGpuBytes, dependencyJsBytes, dependencyGpuBytes, totalBytes,
      chunks: Object.freeze(selected), dependencies: Object.freeze(selectedDependencies) });
  };
  const full = footprint([...chunks.keys()]);
  if (full.totalBytes < measuredWholeBytes) throw new RangeError('Runtime render inventory undercounts its measured whole runtime');
  for (const [at, rows] of tiles) tiles.set(at, Object.freeze([...rows].sort((a, b) => a.id.localeCompare(b.id))));
  return Object.freeze({ full, measuredWholeBytes, measurement, nonStreamingBytes, footprint,
    tile: (level: RingLevel, x: number, z: number): readonly RuntimeRenderChunk[] => tiles.get(coordinate(level, x, z)) ?? Object.freeze([]) });
}
