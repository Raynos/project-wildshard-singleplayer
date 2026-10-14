import MILL_REST from '../data/millRest.generated.json' with { type: 'json' };
import HEROES from '../data/heroLibrary.generated.json' with { type: 'json' };
import { ISLET_POOL } from '../data/restFiles';
import { SKY_RIG_LIBRARY } from '../data/rigLibrary';
import { SKY_MESHES, MODEL_URLS, FAN_POOL, type SkyMeshName } from '../data/files';
import REST_POOLS from '../data/restPools.generated.json' with { type: 'json' };
import BRIDGES from '../data/bridgeRest.generated.json' with { type: 'json' };
import { SKY_AO_FLOOR } from '../data/modelFrames';
import { createModelLibrary } from '@wildshard/sdk/looks/modelLibrary';
import { MeshStandardMaterial, type Texture } from 'three';

/** Shared admission and caching over authored rest primitives, original atlases and existing rigs. */
export const SKY_LIBRARY = createModelLibrary<SkyMeshName, never>({ meshes: SKY_MESHES, preparedMeshes: SKY_MESHES, meshUrls: MODEL_URLS, hd: [], hdUrls: {}, aoFloor: SKY_AO_FLOOR, hdLooks: {},
  geometryPools: [FAN_POOL, ...REST_POOLS, BRIDGES.pool, ISLET_POOL, MILL_REST], rigs: SKY_RIG_LIBRARY, rigLoad: 'manual', mappedFallback: { roughness: 0.85, metalness: 0 } }, '[far-reach]');
export const HERO_LIBRARY = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, aoFloor: SKY_AO_FLOOR, hdLooks: {},
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
