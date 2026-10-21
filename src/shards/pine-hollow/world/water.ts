import type * as THREE from 'three';
import { PineWaterSurface } from './poolSurface';
import waterRows from '../data/waterLook.json' with { type: 'json' };
import { lentLook, setLentParam } from '@wildshard/sdk/looks/lentLooks';

const { looks: WATER_LOOKS, surfaces: WATER_SURFACES } = waterRows;

/**
 * Pine Hollow's water at run time: the lent water looks (../data/waterLook.json) and the live params they read: each fading
 * body's alpha (the rain's rings are the rain presentation's).
 */

/** a drawn water surface (data/waterLook.json WATER_SURFACES) of `geometry` on the water-surface host */
export function pineWaterSurface(kind: keyof typeof WATER_SURFACES, geometry: THREE.BufferGeometry): THREE.Mesh {
  return drawPineWater(kind, geometry).mesh;
}
/** Bind a mutable surface to its admitted per-vertex bed. */
export function drawPineWater(kind: keyof typeof WATER_SURFACES, geometry: THREE.BufferGeometry, ground?: readonly number[]): PineWaterSurface {
  const row = WATER_SURFACES[kind];
  return new PineWaterSurface(row, { material: lentLook(row.look) }).draw(geometry, ground === undefined ? {} : { ground });
}
/** scale a water look's alpha */
export function setWaterFade(look: keyof typeof WATER_LOOKS, fade: number): void { setLentParam(WATER_LOOKS[look], 'fade', fade); }
