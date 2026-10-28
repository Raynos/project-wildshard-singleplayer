

/** Native living graphs are separate from the sealed shell/specimen inventory. */
import { type worldSceneWeldData, worldSceneLivingBakeRows, type AuthorLivingSceneProfile } from '@wildshard/sdk/worldScenes';
import { nameBlob , type NamedBlob as NamedBlobType } from '@wildshard/sdk/blobs';
import { cabinLivingBake } from './bake-cabin-living.mjs';
import { pineCabins } from './bake-pine-cabins.mjs';
import { perSources, type PineSources } from './pineSources';

type WorldSceneWeld = ReturnType<typeof worldSceneWeldData>;

/** Native facts consumed by world wiring, quests, the map and the collection wall. */
export interface CabinSites { buildings: { id: string; index: number; root: string; standalone: boolean; }[]; roofs: { x: number; z: number; rot: number; w: number; d: number; }[]; }
/** The cabin sites over the cabin bake (D65: its grid comes from the program's sources), made once per sources. */
export const cabinSites: (sources: PineSources) => CabinSites = perSources((sources: PineSources): CabinSites => {
  const cabins = pineCabins(sources).rows;
  return {
    buildings: [...cabins.buildings.filter(row => !row.hamlet), ...cabins.buildings.filter(row => row.hamlet)].map(row => ({ id: row.id, index: row.index, root: `cabins.${row.id}.root`, standalone: !row.hamlet })),
    roofs: cabins.buildings.filter(row => row.hamlet).map(row => ({ x: row.at[0], z: row.at[2], rot: row.rot, w: row.size[1] + 1, d: row.size[0] + 1 })),
  };
});
export type CabinLivingProfile = AuthorLivingSceneProfile;
/** The living cabin rows: their libraries and graphs, the living shapes the scene bake does not store, and the shell's
 *  resources (shell admission makes the live graph's native geometry available before either graph hydrates). */
export interface CabinLiving {
  readonly CABIN_LIVING_LIBRARIES: { id: string; kind: 'owned'; models: { id: string; file: string; attributes: Record<string, string>; }[]; }[];
  readonly CABIN_LIVING_BLOBS: NamedBlobType[];
  readonly CABIN_LIVING_SHAPES: [string, Uint8Array][];
  readonly cabinLivingResources: (tier: 'phone' | 'desktop', shadow: boolean) => WorldSceneWeld['resources'];
}
/** GR8: the living cabin rows over the program's bake, made once per sources. */
export const cabinLiving: (sources: PineSources) => Promise<CabinLiving> = perSources(async (sources: PineSources): Promise<CabinLiving> => {
  const bake = await cabinLivingBake(sources), rows = worldSceneLivingBakeRows(bake.rows);
  if (rows.profiles.length !== 8 || new Set(rows.profiles.map(row => `${row.tier}/${String(row.shadow)}/${String(row.shared)}`)).size !== 8) throw new Error('Missing complete cabin living topology');
  return {
    CABIN_LIVING_LIBRARIES: [...new Set(rows.geometry.map(row => row.library))].map(library => ({ id: library, kind: 'owned' as const,
      models: rows.geometry.filter(row => row.library === library).map(({ library: _library, ...row }) => row) })),
    CABIN_LIVING_BLOBS: rows.profiles.map(row => nameBlob(row.file, 'json', new TextEncoder().encode(JSON.stringify({ graph: row.graph, life: row.life, geometry: row.geometry })))),
    CABIN_LIVING_SHAPES: rows.blobs.filter(row => row.kind === 'glb').map((row): [string, Uint8Array] => {
      const bytes = bake.glbs.get(row.source);
      if (bytes === undefined) throw new Error(`Missing baked living cabin shape: ${row.source}`);
      return [row.name, bytes];
    }),
    cabinLivingResources: (tier, shadow) => {
      const resources = new Map(rows.profiles.filter(row => row.tier === tier && row.shadow === shadow).flatMap(row => row.geometry).map(row => [row.id, { id: row.id, kind: 'geometry' as const, source: row.source }]));
      return [...resources.values()];
    },
  };
});
