// Summarize one observed GL census without equating capacities with RAM.
import * as v from 'valibot';

const resource = v.looseObject({ id: v.string(), kind: v.picklist(['buffer', 'texture', 'renderbuffer']),
  bytes: v.pipe(v.number(), v.integer(), v.minValue(0)), owner: v.string(), asset: v.string(), labelled: v.boolean() });
const census = v.looseObject({ observed: v.looseObject({ totalBytes: v.number(), reconciled: v.boolean(),
  contexts: v.array(v.looseObject({ resources: v.array(resource) })) }),
  nodes: v.array(v.object({ path: v.string(), type: v.string(), buffers: v.array(v.string()) })),
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
  return { gpu: bytes, total, ramCapacity: data.allocation.totals.ram, allocatorClaims: data.allocation.accountedBytes };
}
