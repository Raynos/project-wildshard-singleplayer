

/** Native living graphs are separate from the sealed shell/specimen inventory. */
import * as v from 'valibot';
import { WorldSceneWeldSchema, type WorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { BuildingLifeRowsSchema , type BuildingLifeRows as BuildingLifeRowsType } from '@wildshard/format/buildings';
import { nameBlob , type NamedBlob as NamedBlobType } from '@wildshard/sdk/blobs';
import baked from '../data/cabinLivingScenes.generated.json' with { type: 'json' };
import { pineCabins } from './bake-pine-cabins.mjs';

const cabins = pineCabins().rows;


const id = v.string(), geometry = v.object({ key: id, id, source: v.object({ library: id, model: id }) });
export const CabinLivingProfileSchema: v.ObjectSchema<{ readonly tier: v.PicklistSchema<["phone", "desktop"], undefined>; readonly shadow: v.BooleanSchema<undefined>; readonly shared: v.BooleanSchema<undefined>; readonly file: v.StringSchema<undefined>; readonly graph: v.GenericSchema<unknown, WorldSceneWeld>; readonly life: v.GenericSchema<unknown, BuildingLifeRowsType>; readonly geometry: v.ArraySchema<v.ObjectSchema<{ readonly key: v.StringSchema<undefined>; readonly id: v.StringSchema<undefined>; readonly source: v.ObjectSchema<{ readonly library: v.StringSchema<undefined>; readonly model: v.StringSchema<undefined>; }, undefined>; }, undefined>, undefined>; }, undefined> = v.object({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), shared: v.boolean(), file: id,
  graph: WorldSceneWeldSchema, life: BuildingLifeRowsSchema, geometry: v.array(geometry) });
const rows = v.parse(v.object({ profiles: v.array(CabinLivingProfileSchema), geometry: v.array(v.object({ id, library: id, file: id, attributes: v.record(id, id) })) }), baked);
if (rows.profiles.length !== 8 || new Set(rows.profiles.map(row => `${row.tier}/${String(row.shadow)}/${String(row.shared)}`)).size !== 8) throw new Error('Missing complete cabin living topology');
export const CABIN_LIVING_LIBRARIES: { id: string; kind: "owned"; models: { id: string; file: string; attributes: Record<string, string>; }[]; }[] = [...new Set(rows.geometry.map(row => row.library))].map(library => ({ id: library, kind: 'owned' as const,
  models: rows.geometry.filter(row => row.library === library).map(({ library: _library, ...row }) => row) }));
export const CABIN_LIVING_BLOBS: NamedBlobType[] = rows.profiles.map(row => nameBlob(row.file, 'json', new TextEncoder().encode(JSON.stringify({ graph: row.graph, life: row.life, geometry: row.geometry }))));
/** Native facts consumed by world wiring, quests, the map and the collection wall. */
export const CABIN_SITES: { buildings: { id: string; index: number; root: string; standalone: boolean; }[]; roofs: { x: number; z: number; rot: number; w: number; d: number; }[]; } = {
  buildings: [...cabins.buildings.filter(row => !row.hamlet), ...cabins.buildings.filter(row => row.hamlet)].map(row => ({ id: row.id, index: row.index, root: `cabins.${row.id}.root`, standalone: !row.hamlet })),
  roofs: cabins.buildings.filter(row => row.hamlet).map(row => ({ x: row.at[0], z: row.at[2], rot: row.rot, w: row.size[1] + 1, d: row.size[0] + 1 })),
};
export type CabinSites = typeof CABIN_SITES;
export type CabinLivingProfile = v.InferOutput<typeof CabinLivingProfileSchema>;
/** Shell admission makes the live graph's native geometry available before either graph hydrates. */
export function cabinLivingResources(tier: 'phone' | 'desktop', shadow: boolean): WorldSceneWeld['resources'] {
  const resources = new Map(rows.profiles.filter(row => row.tier === tier && row.shadow === shadow).flatMap(row => row.geometry).map(row => [row.id, { id: row.id, kind: 'geometry' as const, source: row.source }]));
  return [...resources.values()];
}
