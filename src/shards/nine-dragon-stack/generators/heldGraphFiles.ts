import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { assetCost } from '@wildshard/format/product';
import { viewmodelGraphs } from './viewmodelGraphs';

// Standard material-file references keep the catalogue's JSON walk bounded.
// These are look.materials assets, read by the graph host's file reader.
const graphs = viewmodelGraphs();
const entries = Object.entries(graphs).map(([id, graph]) => {
  const bytes = new TextEncoder().encode(JSON.stringify(graph)), hash = hashImmutableBytes(bytes);
  return [id, { hash, bytes }] as const;
});
export const heldGraphFiles = {
  assets: new Map(entries.map(([, row]) => [row.hash, row.bytes])),
  materials: Object.fromEntries(entries.map(([id, row]) => [id, { family: 'graph' as const, file: row.hash }])),
  files: [...new Map(entries.map(([, { hash, bytes }]) => [hash,
    { hash, kind: 'json' as const, compressed: bytes.length, ...assetCost('json', bytes), dependencies: [], critical: false }])).values()],
  library: [...new Set(entries.map(([, row]) => row.hash))],
  params: Object.fromEntries(Object.entries(graphs).map(([id, graph]) => [id, Object.keys(graph.params ?? {})])),
};
