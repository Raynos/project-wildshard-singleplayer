import { admitScriptContract, type ScriptContract } from './scriptContract';
import { prepareGlbBuffers } from './glbBuffers';
import { parseGlbData } from './glbCost';
import { parseKtx2 } from './ktx2Cost';
import { indexRecordingAac } from '@wildshard/format/aacIndex';
import { bilinearTerrainSamplers, decodeTerrainTile, isTerrainTileData, terrainTileCost, terrainTileHeight } from "@wildshard/format/terrainTileBytes";
import { decodeMeshCollision, isMeshCollisionData, meshCollisionCost } from "@wildshard/format/meshCollisionBytes";
import type { GlbVertex } from "@wildshard/format/glbTriangles";
import type { OverdrawEstimate } from "@wildshard/format/overdraw";
import { parseImageAsset } from "@wildshard/format/stillImage";
import { journalImageRefs } from './compendiumRows';
import type { Shardfile } from "@wildshard/format/shardSchema";
import type { ShardTerrain } from "@wildshard/format/terrain";
import { worstContentCost, memoryTargetWarnings, nearbyContentCost } from "@wildshard/format/budget";
import { CONTENT_CAPS as C, MEMORY_GATES } from '@wildshard/format/contentBounds';
import { DEFAULT_GRAPH_BUDGET } from "@wildshard/format/materialGraph";
import { SCRIPT_LIMITS } from '@wildshard/format/scriptLimits';
import { runtimeAccountedBytes } from "@wildshard/format/runtimeCost";
import { MemoryAdmission } from './memoryAdmission';
import { nearPlaceholderRoots } from '@wildshard/format/nearPlaceholder';

/** Actual costs derived from a bounded parser, never trusted from the author declaration. */
import { isNavigationData, navigationCost } from '@wildshard/format/navigationBytes';

/** Admitted decoded CPU bytes, GPU bytes, triangle count and draw count charged to the asset budget. */
export interface AssetCost { decoded: number; gpu: number; triangles: number; draws: number }
const MAX_BYTES = 25_000_000;
function requireRange(bytes: Uint8Array, offset: number, size: number): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > bytes.length) throw new Error('asset truncated or oversized');
}
function json(bytes: Uint8Array): unknown { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }

/** Parse self-contained GLB 2 without following URLs or allocating accessor-sized arrays. */
export function parseGlb(bytes: Uint8Array): AssetCost { return parseGlbData(bytes); }
/** Prepare compressed-asset decoding before synchronous byte admission; importing schemas never waits for Wasm. */
export function prepareAssetDecoders(): Promise<void> { return prepareGlbBuffers(); }
/** Inspect exact static triangles only after the bounded GLB parser admits the complete payload. */
export function visitGlbTriangles(bytes: Uint8Array, visit: (triangle: readonly GlbVertex[]) => void): void { parseGlbData(bytes, visit); }
/** Shared byte-derived raster estimate; no author-supplied overdraw number is accepted. */
export function assetOverdraw(requestedKind: string, bytes: Uint8Array, script?: ScriptContract): OverdrawEstimate {
  const kind = requestedKind === 'commons' ? commonsKind(bytes) : requestedKind;
  const estimate: OverdrawEstimate = { layers: 0, blendedLayers: 0, maskedLayers: 0, basis: 'primitive-bounds' };
  if (kind === 'glb') parseGlbData(bytes, undefined, estimate);
  else { assetCost(kind, bytes, script); if (isTerrainTileData(bytes)) estimate.layers = 1; }
  return estimate;
}
/** Admit bounded PCM WAV or indexed AAC-LC without decoding; charge full float32 sample residency. */
export function parseAudio(bytes: Uint8Array): AssetCost {
  requireRange(bytes, 0, 12);
  if (new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp') {
    if (bytes.length > MAX_BYTES) throw new Error('audio byte cap');
    const indexed = indexRecordingAac(bytes);
    if (indexed.mediaFrames / indexed.sampleRate > 180) throw new Error('AAC duration cap');
    // Include priming and the entire final packet: never undercharge packet padding or encoder delay.
    return { decoded: indexed.sizes.length * 1024 * indexed.channels * 4, gpu: 0, triangles: 0, draws: 0 };
  }
  requireRange(bytes, 0, 12); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), tag = (at: number): string => new TextDecoder().decode(bytes.subarray(at, at + 4));
  if (bytes.length > MAX_BYTES || tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || view.getUint32(4, true) + 8 !== bytes.length) throw new Error('invalid WAV header');
  let at = 12, channels = 0, rate = 0, alignment = 0, data = 0;
  while (at < bytes.length) {
    requireRange(bytes, at, 8); const n = view.getUint32(at + 4, true); requireRange(bytes, at + 8, n);
    if (tag(at) === 'fmt ') {
      if (channels !== 0 || n < 16 || view.getUint16(at + 8, true) !== 1) throw new Error('unsupported WAV format');
      channels = view.getUint16(at + 10, true); rate = view.getUint32(at + 12, true); alignment = view.getUint16(at + 20, true); const bits = view.getUint16(at + 22, true);
      if (channels < 1 || channels > 2 || rate < 8000 || rate > 96000 || ![8, 16, 24, 32].includes(bits) || alignment !== channels * bits / 8 || view.getUint32(at + 16, true) !== rate * alignment) throw new Error('WAV channel/rate cap');
    } else if (tag(at) === 'data') { if (data !== 0) throw new Error('duplicate WAV data'); data = n; }
    at += 8 + n + (n % 2);
  }
  if (channels === 0 || data === 0 || data % alignment !== 0 || data / alignment / rate > 180 || at !== bytes.length) throw new Error('WAV duration or data cap');
  return { decoded: data / alignment * channels * 4, gpu: 0, triangles: 0, draws: 0 };
}
function commonsKind(bytes: Uint8Array): 'ktx2' | 'glb' | 'audio' | 'binary' {
  return bytes[0] === 171 ? 'ktx2' : bytes[0] === 103 ? 'glb'
    : bytes[0] === 82 || new TextDecoder().decode(bytes.subarray(4, 8)) === 'ftyp' ? 'audio' : 'binary';
}
/** Select the format parser; binary/JSON/Wasm are bounded before higher-level content validators run. */
export function assetCost(requestedKind: string, bytes: Uint8Array, script?: ScriptContract): AssetCost {
  const kind = requestedKind === 'commons' ? commonsKind(bytes) : requestedKind;
  if (kind === 'image') { const image = parseImageAsset(bytes); return { decoded: image.decoded, gpu: image.gpu, triangles: 0, draws: 0 }; }
  if (kind === 'glb') return parseGlb(bytes);
  if (kind === 'ktx2') return parseKtx2(bytes);
  if (kind === 'audio') return parseAudio(bytes);
  if (bytes.length > MAX_BYTES) throw new Error('asset byte cap');
  if (kind === 'binary' && isNavigationData(bytes)) return navigationCost(bytes);
  if (kind === 'binary' && isTerrainTileData(bytes)) return terrainTileCost(decodeTerrainTile(bytes));
  if (kind === 'binary' && isMeshCollisionData(bytes)) return meshCollisionCost(decodeMeshCollision(bytes));
  if (kind === 'json') { json(bytes); return { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 }; }
  if (kind === 'wasm') {
    if (script === undefined) throw new Error('Wasm needs an explicit script contract');
    admitScriptContract(bytes, script);
  }
  return { decoded: bytes.length, gpu: 0, triangles: 0, draws: 0 };
}

/** Refuse orphan wire assets and require look LUTs in the charged library closure before any asset read. */
export function preflightAssetGraph(source: Pick<Shardfile, 'files' | 'library' | 'critical' | 'tiles' | 'far' | 'look' | 'requires'> & Partial<Pick<Shardfile, 'rows' | 'presentation' | 'map' | 'audio' | 'near'>>): void {
  const files = new Map(source.files.map((file) => [file.hash, file]));
  const closure = (roots: readonly string[]): Set<string> => {
    const found = new Set<string>(), pending = [...roots];
    while (pending.length > 0) {
      const ref = pending.pop(); if (ref === undefined || found.has(ref)) continue;
      found.add(ref); for (const dependency of files.get(ref)?.dependencies ?? []) pending.push(dependency);
    }
    return found;
  };
  const library = closure(source.library), lut = source.look.grade.lut;
  if (lut !== null && !library.has(lut)) throw new Error('Look LUT must be in the charged library closure');
  if (source.map !== undefined && (!library.has(source.map.image) || files.get(source.map.image)?.kind !== 'image')) throw new Error('Map image must be a declared image file in the charged library closure');
  for (const ref of Object.values(source.presentation?.card ?? {})) {
    if (!library.has(ref) || files.get(ref)?.kind !== 'image') throw new Error('Presentation images must be declared image files in the charged library closure');
  }
  for (const ref of Object.values(source.audio?.recordings ?? {})) {
    const shared = ref.startsWith('commons:') && source.requires.commons.includes(ref.slice(8));
    if (!library.has(ref) || (!shared && files.get(ref)?.kind !== 'audio')) throw new Error('Audio recordings must be declared audio in the charged library closure');
  }
  for (const row of source.rows?.compendiums ?? []) {
    if ('kind' in row) {
      for (const ref of journalImageRefs(row)) if (!library.has(ref) || files.get(ref)?.kind !== 'image') throw new Error('Journal image must be a declared image in the charged library closure');
    } else for (const entry of row.entries) {
      if (!entry.sketch.startsWith('data:') && !library.has(entry.sketch)) throw new Error('Compendium sketch hash must be in the charged library closure');
    }
  }
  const reachable = closure([...source.library, ...source.critical, ...source.tiles.flatMap((tile) => tile.files), ...source.far?.files ?? [], ...nearPlaceholderRoots(source.near)]);
  if (source.files.some((file) => !reachable.has(file.hash)) || source.requires.commons.some((hash) => !reachable.has(`commons:${hash}`))) throw new Error('Orphan shardfile asset is not reachable from a bundle root');
}

/** Check baked payloads against the public tile rows and edge profiles, including exact render/collider L0 seams. */
export function validateTerrainAssets(terrain: ShardTerrain, assets: ReadonlyMap<string, Uint8Array>, content: {
  tiles: readonly { lod: number; x: number; z: number; files: readonly string[]; geometricError: number }[];
  critical: readonly string[]; edge: Record<'north' | 'east' | 'south' | 'west', { heights: readonly number[]; colours: readonly (readonly number[])[] }>;
}): void {
  const read = (fileRef: string) => { const bytes = assets.get(fileRef); if (bytes === undefined) throw new Error('Missing terrain file'); return decodeTerrainTile(bytes); };
  const collider = read(terrain.collider);
  const derivedQuery = terrain.form === 'query' && terrain.collider === terrain.sampling.file;
  if (!derivedQuery && (!content.critical.includes(terrain.collider) || collider.colours !== undefined || collider.splat !== undefined || collider.x !== -250 || collider.z !== -250 || collider.size !== 500 || collider.resolution !== 257)) throw new Error('Terrain collider must be a complete critical heightfield');
  if (terrain.sampling !== undefined) {
    if (!content.critical.includes(terrain.sampling.file)) throw new Error('Terrain sampling must be a critical query root');
    bilinearTerrainSamplers(read(terrain.sampling.file), terrain.sampling.normalEpsilon, terrain.sampling.datum);
  }
  if (terrain.form === 'query') return; // Queries install no render seams, road colours or collision.
  const colours = new Map<string, readonly number[]>();
  for (const tile of terrain.tiles) {
    const data = read(tile.file), size = tile.lod === 0 ? 62.5 : 125, row = content.tiles.find((t) => t.lod === tile.lod && t.x === tile.x && t.z === tile.z);
    if (data.colours === undefined || data.size !== size || data.x !== -250 + tile.x * size || data.z !== -250 + tile.z * size || data.resolution !== (tile.lod === 0 ? 33 : 17) || row === undefined || !row.files.includes(tile.file)) throw new Error('Terrain tile payload disagrees with its address');
    for (let z = 0; z < data.resolution; z++) for (let x = 0; x < data.resolution; x++) {
      const height = terrainTileHeight(collider, data.x + x * size / (data.resolution - 1), data.z + z * size / (data.resolution - 1));
      if (Math.abs((data.heights[z * data.resolution + x] ?? Infinity) - height) > 1e-5) throw new Error('Terrain render/collider seam mismatch');
      if (tile.lod === 0) {
        const key = `${tile.x * 32 + x}/${tile.z * 32 + z}`, rgb = [...data.colours.subarray((z * data.resolution + x) * 3, (z * data.resolution + x) * 3 + 3)], prior = colours.get(key);
        if (prior !== undefined && rgb.some((c, i) => c !== prior[i])) throw new Error('Terrain colour seam mismatch');
        colours.set(key, rgb);
      }
    }
    let error = 0;
    for (let z = 0; z <= size / (500 / 256); z++) for (let x = 0; x <= size / (500 / 256); x++) {
      const px = data.x + x * 500 / 256, pz = data.z + z * 500 / 256;
      error = Math.max(error, Math.abs(terrainTileHeight(data, px, pz) - terrainTileHeight(collider, px, pz)));
    }
    if (row.geometricError + 1e-5 < error) throw new Error('Terrain geometric error understated');
  }
  for (const [side, edge] of Object.entries(content.edge)) {
    if (edge.heights.length !== 257 || edge.colours.length !== 257) throw new Error('Terrain edge profile sample count');
    edge.heights.forEach((height, i) => {
      const p = -250 + i * 500 / 256, x = side === 'east' ? 250 : side === 'west' ? -250 : p, z = side === 'north' ? 250 : side === 'south' ? -250 : p;
      if (Math.abs(height - terrainTileHeight(collider, x, z)) > 1e-5) throw new Error('Terrain edge profile mismatch');
      const key = `${Math.round((x + 250) / 500 * 256)}/${Math.round((z + 250) / 500 * 256)}`, rgb = colours.get(key), declared = edge.colours[i];
      if (rgb === undefined || declared?.length !== 3 || rgb.some((c, channel) => c !== declared[channel])) throw new Error('Terrain edge colour mismatch');
    });
    if (edge.heights[128] !== 0) throw new Error('Terrain entry road must meet road height zero');
  }
}

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
  download: { critical: number; tiles: number; library: number; far: number; near?: number; total: number; playable: number };
  estimatedPlayable: { seconds: number; bytesPerSecond: number; setupSeconds: number };
  issues: PerformanceIssue[];
}

function reportCardClosure(source: Shardfile, roots: readonly string[]): Set<string> {
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
  const dx = Math.max((tile.drawBounds ?? tile.bounds).min[0] - x, x - (tile.drawBounds ?? tile.bounds).max[0], 0), dz = Math.max((tile.drawBounds ?? tile.bounds).min[2] - z, z - (tile.drawBounds ?? tile.bounds).max[2], 0);
  return dx * dx + dz * dz <= C.nearRadius ** 2;
};

/** Cheap target grading before asset reads; format integrity and total-memory admission remain separate. */
export function performanceTargetIssues(source: Shardfile, policy: 'refuse' | 'warn' = 'refuse'): PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];
  const check = (metric: string, actual: number, limit: number, provisional = false): void => {
    if (actual > limit) issues.push({ metric, actual, limit, severity: provisional || policy === 'warn' ? 'warning' : 'refusal' });
  };
  const libraryAllowance = source.budgets.library.downloadAllowance ?? C.library.compressed;
  check('library download budget bytes', source.budgets.library.compressed, libraryAllowance);
  check('critical download budget bytes', source.budgets.sim.compressed, C.sim.compressed);
  check('library download bytes', totals(source, reportCardClosure(source, source.library)).bytes, libraryAllowance);
  check('critical download bytes', totals(source, reportCardClosure(source, source.critical)).bytes, C.sim.compressed);
  for (const tile of source.tiles) {
    const cap = tile.lod === 0 ? C.l0 : C.l1, id = `tile ${tile.lod}/${tile.x}/${tile.z}`;
    check(`${id} download bytes`, tile.compressed, cap.compressed, true); check(`${id} draws`, tile.draws, cap.draws, true); check(`${id} triangles`, tile.triangles, cap.triangles, true);
  }
  if (source.far !== null) {
    check('far download bytes', source.far.compressed, C.far.compressed); check('far draws', source.far.draws, C.far.draws); check('far triangles', source.far.triangles, C.far.triangles);
  }
  return issues;
}

/** Check the exact placed prop XZ footprint, even without drawBounds or overhang. Height keeps its own contract. */
export function validatePropDrawBounds(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>): void {
  const props = source.props; if (props === null) return;
  const validate = (ref: string, bounds?: Shardfile['tiles'][number]['bounds']): void => {
    const bytes = assets.get(ref); if (bytes === undefined) throw new Error('Missing prop draw bytes');
    visitGlbTriangles(bytes, triangle => {
      for (const point of triangle) {
        if (Math.abs(point.x) > 250 || Math.abs(point.z) > 250) throw new Error('Prop exceeds cell draw bounds');
        if (bounds !== undefined && (point.x < bounds.min[0] || point.x > bounds.max[0] || point.y < bounds.min[1] || point.y > bounds.max[1] || point.z < bounds.min[2] || point.z > bounds.max[2])) throw new Error('Prop exceeds declared visual draw bounds');
      }
    });
  };
  for (const row of props.tiles) {
    const tile = source.tiles.find(candidate => candidate.lod === row.lod && candidate.x === row.x && candidate.z === row.z);
    if (tile === undefined) throw new Error('Missing prop draw tile');
    for (const ref of [row.file, ...row.additionalFiles ?? []]) validate(ref, tile.drawBounds);
  }
  for (const ref of [...props.panels.map(row => row.file), ...props.wholeLibrary ?? [], ...props.far === null ? [] : [props.far]]) validate(ref);
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
  // G433: while src/format/memoryGates.json is report-only the totals print as warnings and never refuse a build.
  const total = (metric: string, actual: number, limit: number): void => {
    if (MEMORY_GATES.reportOnly && actual > limit) issues.push({ metric: `${metric} (report-only, G433)`, actual, limit, severity: 'warning' }); else check(metric, actual, limit);
  };
  total('worst playing total bytes', worst.playing, C.playing); total('worst loading total bytes', worst.loading, C.loading);
  const library = reportCardClosure(source, source.library), critical = reportCardClosure(source, source.critical);
  const tileRoots = source.tiles.flatMap(tile => tile.files), farRoots = source.far?.files ?? [], nearRoots = nearPlaceholderRoots(source.near);
  const playable = reportCardClosure(source, [...source.critical, ...source.library, ...farRoots, ...source.tiles.filter(tile => tile.lod === 1 || near(tile, spawn.x, spawn.z)).flatMap(tile => tile.files)]);
  const download = { critical: totals(source, critical).bytes, tiles: totals(source, reportCardClosure(source, tileRoots)).bytes,
    library: totals(source, library).bytes, far: totals(source, reportCardClosure(source, farRoots)).bytes,
    ...(source.near === undefined ? {} : { near: totals(source, reportCardClosure(source, nearRoots)).bytes }),
    total: totals(source, reportCardClosure(source, [...source.critical, ...source.library, ...tileRoots, ...farRoots, ...nearRoots])).bytes, playable: totals(source, playable).bytes };
  const libraryView = totals(source, library);
  const views = [['spawn', spawn.x, spawn.z], ['worst memory', ...worst.location]].map(([name, x, z]) => {
    if (typeof name !== 'string' || typeof x !== 'number' || typeof z !== 'number') throw new Error('Invalid report view');
    const tiles = source.tiles.filter(tile => tile.lod === 1 || near(tile, x, z));
    return { name, x, z, draws: libraryView.draws + (source.far?.draws ?? 0) + tiles.reduce((sum, tile) => sum + tile.draws, 0),
      triangles: libraryView.triangles + (source.far?.triangles ?? 0) + tiles.reduce((sum, tile) => sum + tile.triangles, 0) };
  });
  // D74: every material graph is a graph file, costed and held to its budget with its bytes at product admission
  // (graphFileRules); a preset is engine-owned, under its own budget. The report carries no inline graph rows.
  const graphs: PerformanceReport['graphs'] = [];
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
    `download closures: critical ${mb(report.download.critical)}, tiles ${mb(report.download.tiles)}, library ${mb(report.download.library)}, far ${mb(report.download.far)}${report.download.near === undefined ? '' : `, near ${mb(report.download.near)}`}, unique total ${mb(report.download.total)}`,
    `estimated playable ${report.estimatedPlayable.seconds.toFixed(3)} s: ${mb(report.download.playable)} at ${mb(report.estimatedPlayable.bytesPerSecond)}/s + ${report.estimatedPlayable.setupSeconds} s setup (assumptions, not a phone reading)`,
    ...report.issues.map(issue => `${issue.severity.toUpperCase()}: ${issue.metric}: ${issue.actual} > ${issue.limit}`)];
}

/** The memory admission an offline author build uses: strict for `refuse` unless src/format/memoryGates.json is
 * report-only (G433), when an over-envelope total is accepted and printed by the performance report instead. */
export function offlineMemoryAdmission(policy: 'warn' | 'refuse'): MemoryAdmission | undefined {
  return policy === 'warn' || MEMORY_GATES.reportOnly ? new MemoryAdmission(() => true) : undefined;
}
