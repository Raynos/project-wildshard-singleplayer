import MILL_REST from '../data/millRest.generated.json' with { type: 'json' };
import HEROES from '../data/heroLibrary.generated.json' with { type: 'json' };
import files from '../boot/assets.generated.json' with { type: 'json' };
import { SKY_RIG_LIBRARY } from '../data/population';
import REST_POOLS from '../data/restPools.generated.json' with { type: 'json' };
import BRIDGES from '../data/bridgeRest.generated.json' with { type: 'json' };
import { createModelLibrary } from '@wildshard/sdk/looks/modelLibrary';
import { MeshStandardMaterial, type Texture } from 'three';

type SkyMeshName = keyof typeof files.MODEL_URLS;
/** Shared admission and caching over authored rest primitives, original atlases and existing rigs. */
export const SKY_LIBRARY = createModelLibrary<SkyMeshName, never>({ meshes: files.SKY_MESHES as SkyMeshName[], preparedMeshes: files.SKY_MESHES as SkyMeshName[], meshUrls: files.MODEL_URLS, hd: [], hdUrls: {}, aoFloor: files.SKY_AO_FLOOR, hdLooks: {},
  geometryPools: [files.FAN_POOL, ...REST_POOLS, BRIDGES.pool, files.ISLET_POOL, MILL_REST], rigs: SKY_RIG_LIBRARY, rigLoad: 'manual', mappedFallback: { roughness: 0.85, metalness: 0 } }, '[far-reach]');
export const HERO_LIBRARY = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, aoFloor: files.SKY_AO_FLOOR, hdLooks: {},
  geometryPools: [HEROES.pool], paintedModels: HEROES.models }, '[far-reach]');
/** Prepared channels and pivots with independent geometry copies for each owner. */
export type SkyHd = NonNullable<ReturnType<typeof HERO_LIBRARY.painted>>;
/** Preload the library and rigs, retaining the caller's yield between painted models. */
export const preloadSkyMeshes = (pause?: () => Promise<void>): Promise<void> => Promise.all([SKY_LIBRARY.preload(), HERO_LIBRARY.preload(pause), SKY_LIBRARY.preloadRigs()]).then(() => undefined);
/** A prepared painted model, or null when unavailable. */
export const skyHd = (name: string): SkyHd | null => HERO_LIBRARY.painted(name);
/** A hero model's matte painted material. */
export const hdMaterial = (map: Texture): MeshStandardMaterial => new MeshStandardMaterial({ map, roughness: 0.85, metalness: 0 });
/** An owned facet-model geometry copy. */
export const skyMesh = SKY_LIBRARY.mesh;
