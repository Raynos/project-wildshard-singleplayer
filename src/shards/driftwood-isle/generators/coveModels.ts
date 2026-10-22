import families from '../data/coveFamilies.json' with { type: 'json' };
import { ISLAND_LOOK } from './islandRows';

export type CoveFamily = keyof typeof families;
export function coveFamilyOf(proto: string): CoveFamily | undefined {
  const stem = proto.replace(/\d+$/, '');
  return Object.hasOwn(families, stem) ? stem as CoveFamily : undefined;
}
/** Complete authored model recipes; the entered page only binds native sources. */
export const COVE_MODELS = Object.entries(families).map(([key, f]) => {
  const parts = (far: boolean) => Object.fromEntries(f.protos.map(proto => [proto, [{ geometry: `${proto}${far ? '_lo' : ''}`, material: f.look, clone: true, castShadow: f.look === 'cast', receiveShadow: true }]]));
  return { key, look: f.look, model: {
    id: `driftwood-isle/cove-${key}`, name: f.name, file: 'src/shards/driftwood-isle/generators/coveModels.ts', category: 'nature', pipeline: f.pipeline,
    defaults: { proto: f.protos[0] ?? '' }, variants: f.protos.map((proto, i) => ({ id: proto, label: `${f.name} ${i + 1}`, params: { proto } })),
    parts: parts(false), specimenMaterial: 'cast', lods: 'far' in f && f.far ? [{ from: ISLAND_LOOK.lod, parts: parts(true) }] : [],
  } };
});
