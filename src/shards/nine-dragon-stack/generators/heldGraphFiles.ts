import { bakeRawColourTexture } from '@wildshard/sdk/bake/texture';
import { writeImagePixels } from '@wildshard/sdk/bake/image';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { assetCost } from '@wildshard/format/product';
import { viewmodelGraphs } from './viewmodelGraphs';

// Standard material-file references keep the catalogue's JSON walk bounded.
// These are look.materials assets, read by the graph host's file reader.
const standIn = await bakeRawColourTexture(await writeImagePixels({ width: 1, height: 1, pixels: new Uint8ClampedArray([0, 0, 0, 255]) }), { colourSpace: 'linear' });
const texture = hashImmutableBytes(standIn);
const graphs = Object.fromEntries(Object.entries(viewmodelGraphs()).map(([id, graph]) => [id, { ...graph,
  params: Object.fromEntries(Object.entries(graph.params ?? {}).map(([name, param]) => [name, param.type === 'texture' ? { ...param, value: texture } : param])),
}]));
const entries = Object.entries(graphs).map(([id, graph]) => {
  const bytes = new TextEncoder().encode(JSON.stringify(graph)), hash = hashImmutableBytes(bytes);
  const dependencies = Object.values(graph.params).some(param => param.type === 'texture') ? [texture] : [];
  return [id, { hash, bytes, dependencies }] as const;
});
export const heldGraphFiles = {
  assets: new Map([[texture, standIn], ...entries.map(([, row]) => [row.hash, row.bytes] as const)]),
  materials: Object.fromEntries(entries.map(([id, row]) => [id, { family: 'graph' as const, file: row.hash }])),
  files: [{ hash: texture, kind: 'ktx2' as const, compressed: standIn.length, ...assetCost('ktx2', standIn), dependencies: [], critical: false }, ...new Map(entries.map(([, { hash, bytes, dependencies }]) => [hash,
    { hash, kind: 'json' as const, compressed: bytes.length, ...assetCost('json', bytes), dependencies, critical: false }])).values()],
  library: [texture, ...new Set(entries.map(([, row]) => row.hash))],
  params: Object.fromEntries(Object.entries(graphs).map(([id, graph]) => [id, Object.keys(graph.params)])),
};
