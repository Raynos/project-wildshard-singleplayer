import type { NineHeldProfile } from './heldProfile';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { assetCost } from '@wildshard/sdk/assets';
import { viewmodelGraphs } from './viewmodelGraphs';

interface HeldFile extends ReturnType<typeof assetCost> {
  readonly hash: string; readonly kind: 'ktx2' | 'json'; readonly compressed: number; readonly dependencies: readonly string[]; readonly critical: boolean;
}
/** Exact existing graph inventory; no generated profile is read by consumers. */
export interface HeldGraphFiles {
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly materials: Readonly<Record<string, { readonly family: 'graph'; readonly file: string }>>;
  readonly files: readonly HeldFile[]; readonly library: readonly string[]; readonly params: Readonly<Record<string, readonly string[]>>;
}

// Standard material-file references keep the catalogue's JSON walk bounded.
// These are look.materials assets, read by the graph host's file reader.
/** Material files from this invocation's admitted rig profile and owned black texel. */
export function createHeldGraphFiles(profile: NineHeldProfile): HeldGraphFiles {
const standIn = profile.standIn;
const texture = hashImmutableBytes(standIn);
const graphs = Object.fromEntries(Object.entries(viewmodelGraphs(profile)).map(([id, graph]) => [id, { ...graph,
  params: Object.fromEntries(Object.entries(graph.params ?? {}).map(([name, param]) => [name, param.type === 'texture' ? { ...param, value: texture } : param])),
}]));
const entries = Object.entries(graphs).map(([id, graph]) => {
  const bytes = new TextEncoder().encode(JSON.stringify(graph)), hash = hashImmutableBytes(bytes);
  const dependencies = Object.values(graph.params).some(param => param.type === 'texture') ? [texture] : [];
  return [id, { hash, bytes, dependencies }] as const;
});
return {
  assets: new Map([[texture, standIn], ...entries.map(([, row]) => [row.hash, row.bytes] as const)]),
  materials: Object.fromEntries(entries.map(([id, row]) => [id, { family: 'graph' as const, file: row.hash }])),
  files: [{ hash: texture, kind: 'ktx2' as const, compressed: standIn.length, ...assetCost('ktx2', standIn), dependencies: [], critical: false }, ...new Map(entries.map(([, { hash, bytes, dependencies }]) => [hash,
    { hash, kind: 'json' as const, compressed: bytes.length, ...assetCost('json', bytes), dependencies, critical: false }])).values()],
  library: [texture, ...new Set(entries.map(([, row]) => row.hash))],
  params: Object.fromEntries(Object.entries(graphs).map(([id, graph]) => [id, Object.keys(graph.params)])),
};
}

/** One source profile and its exact derived graph inventory travel together. */
export interface NineHeldInputs { readonly profile: NineHeldProfile; readonly files: HeldGraphFiles }
