import { declaredSceneModels } from '@wildshard/game/shardfile/sceneSources';
import { MeshStandardMaterial, type Texture } from 'three';

/** Native view and declared scenes share the admitted source identities. */
export const SKY_LIBRARY = declaredSceneModels('far-reach', 'sky');
export const HERO_LIBRARY = declaredSceneModels('far-reach', 'heroes');
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
