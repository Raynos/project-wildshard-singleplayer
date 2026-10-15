import * as THREE from 'three';
import type { Game } from '@wildshard/engine/core/Game';
import { POND, waterLevel } from '@wildshard/engine/world/Heightfield';
import type { WaterView } from '@wildshard/engine/world/water/view';
import { WATER_LOOKS, type WaterLook } from '../data/waterLook';
import { pineLook, setPineLookParam, setPineLookTexture } from '../runtime/looks/graphLooks';

/**
 * Pine Hollow's water at run time: the lent water looks (../data/waterLook.ts) and the live params they read: each fading
 * body's alpha, the rain's rings and Explore's top-down map shot.
 */
const LOOKS = Object.values(WATER_LOOKS);
const isTexture = (v: unknown): v is THREE.Texture => v instanceof THREE.Texture;
let rain = 0;

/** the rain on the water (world/weather.ts's `water` channel owner): 0 … 1 rings on every water surface */
export const waterWeather = { uRainRings: {
  get value(): number { return rain; },
  set value(v: number) { rain = v; for (const id of LOOKS) setPineLookParam(id, 'rain', v); },
} };

/** the water bodies' reflect hook (world/terrain.ts): the surface reflects like a map reads water in the top-down shot */
export function waterReflect(view: WaterView): void {
  for (const id of LOOKS) setPineLookParam(id, 'topDown', view === 'top-down' ? 1 : 0);
}

/** a water look; `setWaterFade` scales its alpha */
export function pineWater(look: WaterLook): THREE.Material { return pineLook(WATER_LOOKS[look]); }
export function setWaterFade(look: WaterLook, fade: number): void { setPineLookParam(WATER_LOOKS[look], 'fade', fade); }

/**
 * After the looks are lent, the pond the session built (engine/world/pond.ts: the mesh `pond`, its skyline probe in userData)
 * wears the pond look instead of the engine's classic water, and every look borrows that water's ripple map.
 */
export function dressPineWater(game: Pick<Game, 'rootScene'>): void {
  const mesh = game.rootScene.getObjectByName('pond'), old: unknown = mesh instanceof THREE.Mesh ? mesh.material : null;
  const skyline: unknown = mesh?.userData['waterSkyline'], ripples: unknown = old instanceof THREE.MeshPhysicalMaterial ? old.normalMap : null;
  if (!(mesh instanceof THREE.Mesh) || !isTexture(skyline) || !isTexture(ripples)) throw new Error('[pine-hollow] the pond, its skyline probe or its ripples are missing');
  for (const id of LOOKS) { setPineLookTexture(id, 'ripples', ripples); setPineLookParam(id, 'rain', rain); }
  setPineLookTexture(WATER_LOOKS.pond, 'skyline', skyline);
  setPineLookParam(WATER_LOOKS.pond, 'skyC', [POND.x, POND.z, waterLevel(), 1]);
  mesh.material = pineWater('pond');
  if (old instanceof THREE.Material) old.dispose();
}
