import families from '../data/coveFamilies.json' with { type: 'json' };
import { ISLAND_LOOK } from './islandRows';

export type CoveFamily = keyof typeof families;
export function coveFamilyOf(proto: string): CoveFamily | undefined {
  const stem = proto.replace(/\d+$/, '');
  return Object.hasOwn(families, stem) ? stem as CoveFamily : undefined;
}
/** G913: a family's `fold` draws a proto's copies as another of its protos, one instanced draw fewer each (the copies,
 *  their tints and their colliders stay; the ground wear still reads every proto) */
const folds: ReadonlyMap<string, string> = new Map(Object.values(families).flatMap(f => 'fold' in f ? Object.entries(f.fold) : []));
export const coveDrawnProto = (proto: string): string => folds.get(proto) ?? proto;
/** Complete authored model recipes; the entered page only binds native sources. */
export const COVE_MODELS: { key: string; look: string; merge?: true; model: { id: string; name: string; file: string; category: string; pipeline: string | string[]; defaults: { proto: string; }; variants: { id: string; label: string; params: { proto: string; }; }[]; parts: Record<string, { geometry: string; material: string; clone: boolean; castShadow: boolean; receiveShadow: boolean; }[]>; specimenMaterial: string; lods: { from: number; parts: Record<string, { geometry: string; material: string; clone: boolean; castShadow: boolean; receiveShadow: boolean; }[]>; }[]; }; }[] = Object.entries(families).map(([key, f]) => {
  const protos = f.protos.filter(proto => !folds.has(proto));
  const parts = (far: boolean) => Object.fromEntries(protos.map(proto => [proto, [{ geometry: `${proto}${far ? '_lo' : ''}`, material: f.look, clone: true, castShadow: f.look === 'cast', receiveShadow: true }]]));
  // FC12: a family with no LODs marked `merge` draws as one mesh per material (format/bakedTiles)
  const row = { key, look: f.look, model: {
    id: `driftwood-isle/cove-${key}`, name: f.name, file: 'src/shards/driftwood-isle/generators/coveModels.ts', category: 'nature', pipeline: f.pipeline,
    defaults: { proto: protos[0] ?? '' }, variants: protos.map((proto, i) => ({ id: proto, label: `${f.name} ${i + 1}`, params: { proto } })),
    parts: parts(false), specimenMaterial: 'cast', lods: 'far' in f && f.far ? [{ from: ISLAND_LOOK.lod, parts: parts(true) }] : [],
  } };
  return 'merge' in f && f.merge ? Object.assign(row, { merge: true as const }) : row;
});
