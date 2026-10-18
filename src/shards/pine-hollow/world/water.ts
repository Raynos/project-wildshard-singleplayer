import * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import { POND, waterLevel } from '@wildshard/engine/world/Heightfield';
import type { WaterView } from '@wildshard/engine/world/water/view';
import { WaterSurface } from '@wildshard/sdk/looks/waterSurface';
import waterRows from '../data/waterLook.json' with { type: 'json' };
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';

const { looks: WATER_LOOKS, surfaces: WATER_SURFACES } = waterRows;

/**
 * Pine Hollow's water at run time: the lent water looks (../data/waterLook.json) and the live params they read: each fading
 * body's alpha, the rain's rings and Explore's top-down map shot.
 */
const LOOKS = Object.values(WATER_LOOKS);
const isTexture = (v: unknown): v is THREE.Texture => v instanceof THREE.Texture;
let rain = 0;

/** the rain on the water (world/weather.ts's `water` channel owner): 0 … 1 rings on every water surface */
export const waterWeather = { uRainRings: {
  get value(): number { return rain; },
  set value(v: number) { rain = v; for (const id of LOOKS) setLentParam(id, 'rain', v); },
} };

/** the water bodies' reflect hook (world/terrain.ts): the surface reflects like a map reads water in the top-down shot */
export function waterReflect(view: WaterView): void {
  for (const id of LOOKS) setLentParam(id, 'topDown', view === 'top-down' ? 1 : 0);
}

/** a drawn water surface (data/waterLook.json WATER_SURFACES) of `geometry` on the water-surface host */
export function pineWaterSurface(kind: keyof typeof WATER_SURFACES, geometry: THREE.BufferGeometry): THREE.Mesh {
  const row = WATER_SURFACES[kind];
  return new WaterSurface(row, { material: lentLook(row.look) }).draw(geometry).mesh;
}
/** scale a water look's alpha */
export function setWaterFade(look: keyof typeof WATER_LOOKS, fade: number): void { setLentParam(WATER_LOOKS[look], 'fade', fade); }

function lendWaterRipples(ripples: THREE.Texture): void {
  for (const id of LOOKS) { setLentTexture(id, 'ripples', ripples); setLentParam(id, 'rain', rain); }
}

/**
 * After the looks are lent, the pond the session built (engine/world/pond.ts: the mesh `pond`, its skyline probe in userData)
 * wears the pond look instead of the engine's classic water, and every look borrows that water's ripple map.
 * A regional scene has no standalone pond: lend the same shared ripples for its streams without dressing a page-owned pond.
 * The standalone page and any present pond still require their real surface, probe and normal map.
 */
export async function dressPineWater(game: Pick<Game, 'scene' | 'rootScene'>): Promise<void> {
  const mesh = game.scene.getObjectByName('pond');
  if (mesh === undefined && game.scene !== game.rootScene) {
    const { waterTexture } = await import('@wildshard/engine/world/water/ripples');
    lendWaterRipples(waterTexture()); return;
  }
  const old: unknown = mesh instanceof THREE.Mesh ? mesh.material : null;
  const skyline: unknown = mesh?.userData['waterSkyline'], ripples: unknown = old instanceof THREE.MeshPhysicalMaterial ? old.normalMap : null;
  if (!(mesh instanceof THREE.Mesh) || !isTexture(skyline) || !isTexture(ripples)) throw new Error('[pine-hollow] the pond, its skyline probe or its ripples are missing');
  lendWaterRipples(ripples);
  setLentTexture(WATER_LOOKS.pond, 'skyline', skyline);
  setLentParam(WATER_LOOKS.pond, 'skyC', [POND.x, POND.z, waterLevel(), 1]);
  mesh.material = lentLook(WATER_LOOKS.pond);
  if (old instanceof THREE.Material) old.dispose();
}
