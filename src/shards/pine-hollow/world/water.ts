import type * as THREE from 'three';
import type { WaterView } from '@wildshard/engine/world/water/view';
import { WaterSurface } from '@wildshard/game/systems/looks/waterSurface';
import waterRows from '../data/waterLook.json' with { type: 'json' };
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';

const { looks: WATER_LOOKS, surfaces: WATER_SURFACES } = waterRows;

/**
 * Pine Hollow's water at run time: the lent water looks (../data/waterLook.json) and the live params they read: each fading
 * body's alpha and Explore's top-down map shot (the rain's rings are the rain presentation's).
 */
const LOOKS = Object.values(WATER_LOOKS);

/** the water bodies' reflect hook (world/terrain.ts): the surface reflects like a map reads water in the top-down shot */
export function waterReflect(view: WaterView): void {
  for (const id of LOOKS) setLentParam(id, 'topDown', view === 'top-down' ? 1 : 0);
}

/** a drawn water surface (data/waterLook.json WATER_SURFACES) of `geometry` on the water-surface host */
export function pineWaterSurface(kind: keyof typeof WATER_SURFACES, geometry: THREE.BufferGeometry): THREE.Mesh {
  return drawPineWater(kind, geometry).mesh;
}
/** Bind a mutable surface to its admitted per-vertex bed. */
export function drawPineWater(kind: keyof typeof WATER_SURFACES, geometry: THREE.BufferGeometry, ground?: readonly number[]): WaterSurface {
  const row = WATER_SURFACES[kind];
  return new WaterSurface(row, { material: lentLook(row.look) }).draw(geometry, ground === undefined ? {} : { ground });
}
/** scale a water look's alpha */
export function setWaterFade(look: keyof typeof WATER_LOOKS, fade: number): void { setLentParam(WATER_LOOKS[look], 'fade', fade); }
