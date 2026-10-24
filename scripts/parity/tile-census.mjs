// Summarize one observed GL census without equating capacities with RAM.
import * as v from 'valibot';

const resource = v.looseObject({ id: v.string(), kind: v.picklist(['buffer', 'texture', 'renderbuffer']),
  bytes: v.pipe(v.number(), v.integer(), v.minValue(0)), owner: v.string(), asset: v.string(), labelled: v.boolean() });
const vector = v.object({ x: v.number(), y: v.number(), z: v.number() });
const census = v.looseObject({ observed: v.looseObject({ totalBytes: v.number(), reconciled: v.boolean(),
  contexts: v.array(v.looseObject({ resources: v.array(resource) })) }),
  nodes: v.array(v.object({ path: v.string(), type: v.string(), buffers: v.array(v.string()),
    cpuBuffers: v.optional(v.array(v.object({ id: v.string(), role: v.string() }))),
    missingCpuRoles: v.optional(v.array(v.string())), worldBounds: v.optional(v.nullable(v.object({ min: vector, max: vector }))) })),
  sceneCpuVersion: v.optional(v.literal(1)),
  cpuBuffers: v.optional(v.array(v.object({ id: v.string(), bytes: v.pipe(v.number(), v.integer(), v.minValue(0)) }))),
  allocation: v.looseObject({ accountedBytes: v.nullable(v.number()), totals: v.object({ gpu: v.number(), ram: v.number() }) }) });

/** These are classification bounds, not measured savings. Unique world buffers
 * can be partitioned; textures and buffers used by several nodes remain shared
 * until their final consumer retires. Unlabelled/unlinked bytes stay unknown.
 * @param {unknown} input @param {readonly string[]} [globalOwners] */
export function summarizeTileCensus(input, globalOwners = []) {
  const data = v.parse(census, input);
  if (!data.observed.reconciled) throw new Error('Unreconciled GL census');
  const resources = data.observed.contexts.flatMap(context => context.resources);
  if (new Set(resources.map(row => row.id)).size !== resources.length) throw new Error('Ambiguous cross-context GL identities');
  /** @type {Map<string, string[]>} */
  const uses = new Map();
  for (const node of data.nodes) for (const id of new Set(node.buffers)) {
    const paths = uses.get(id) ?? []; paths.push(node.path); uses.set(id, paths);
  }
  const bytes = { engine: 0, shardGlobal: 0, tileCandidate: 0, shared: 0, unknown: 0 };
  const always = new Set(globalOwners);
  for (const row of resources) {
    const paths = uses.get(row.id) ?? [];
    const camera = paths.filter(path => path.includes('/PerspectiveCamera/')).length;
    /** @type {keyof typeof bytes} */
    let bucket;
    if (!row.labelled || row.owner === 'unattributed' || row.owner === 'unlabelled') bucket = 'unknown';
    else if (row.owner === 'engine/render-target' || row.kind === 'renderbuffer') bucket = 'engine';
    else if (always.has(row.owner) || row.asset.includes('/assets/horizon/')) bucket = 'shardGlobal';
    else if (camera > 0) bucket = camera === paths.length ? 'engine' : 'shared';
    else if (row.kind === 'buffer' && paths.length === 1) bucket = 'tileCandidate';
    else if (row.kind === 'texture' || paths.length > 1) bucket = 'shared';
    else bucket = 'unknown';
    bytes[bucket] += row.bytes;
  }
  const total = Object.values(bytes).reduce((sum, value) => sum + value, 0);
  if (total !== data.observed.totalBytes) throw new Error('GL resource sizes do not reconcile');
  /** @type {import('./tile-census.mjs').SceneCpuSummary | null} */
  let sceneCpu = null;
  if (data.sceneCpuVersion !== undefined || data.cpuBuffers !== undefined || data.nodes.some(node => node.cpuBuffers !== undefined)) {
    if (data.sceneCpuVersion !== 1 || data.cpuBuffers === undefined) throw new Error('Incomplete scene CPU census');
    const sizes = new Map(data.cpuBuffers.map(row => [row.id, row.bytes]));
    if (sizes.size !== data.cpuBuffers.length) throw new Error('Duplicate scene CPU identity');
    /** @type {Map<string, Set<number>>} */
    const references = new Map();
    let missingCpuRoles = 0, boundedNodes = 0;
    for (const [index, node] of data.nodes.entries()) {
      if (node.cpuBuffers === undefined || node.missingCpuRoles === undefined || node.worldBounds === undefined) throw new Error('Incomplete scene CPU node');
      missingCpuRoles += node.missingCpuRoles.length;
      if (node.worldBounds !== null) {
        const { min, max } = node.worldBounds;
        if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite) || min.x > max.x || min.y > max.y || min.z > max.z) throw new Error('Invalid scene bounds');
        boundedNodes++;
      }
      for (const use of node.cpuBuffers) {
        if (!sizes.has(use.id)) throw new Error('Unknown scene CPU identity');
        const consumers = references.get(use.id) ?? new Set();
        consumers.add(index); references.set(use.id, consumers);
      }
    }
    sceneCpu = { totalBytes: 0, singleNodeBytes: 0, sharedNodeBytes: 0, unlinkedBytes: 0,
      nodes: data.nodes.length, boundedNodes, missingCpuRoles };
    for (const [id, size] of sizes) {
      if (!Number.isSafeInteger(size)) throw new Error('Unsafe scene CPU capacity');
      const consumers = references.get(id)?.size ?? 0;
      sceneCpu.totalBytes += size;
      if (consumers === 0) sceneCpu.unlinkedBytes += size;
      else if (consumers === 1) sceneCpu.singleNodeBytes += size;
      else sceneCpu.sharedNodeBytes += size;
    }
    if (!Number.isSafeInteger(sceneCpu.totalBytes)) throw new Error('Unsafe scene CPU total');
  }
  return { gpu: bytes, total, ramCapacity: data.allocation.totals.ram, allocatorClaims: data.allocation.accountedBytes, sceneCpu };
}
