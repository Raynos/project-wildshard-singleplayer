/**
 * Yard — trodden earth for the camps (the camp 9-angle round, gap #8): a draped decal over the terrain, textured with
 * the painted `path` tile (src/shards/nalati-grasslands/look/nalatiTextures.ts), whose alpha is the wear map — a worn ring inside the yurts,
 * paths from every door to the hearth, the track in from the road, bare patches at the hitching rail, the stove, the
 * kazan and the corral gate — broken at the edges by noise so it bleeds into the grass instead of ending on a line.
 * One mesh, one draw call, transparent (no depth write), a hair above the ground. SHARD-PLATFORM M3 (the places bake): the
 * decal's geometry is baked with its camp (../generators/yard.ts); here is its material, one per camp.
 */
import * as THREE from 'three';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { loadNalatiTexture } from '../look/nalatiTextures';

/** a camp decal's material: the painterly look, transparent, polygon-offset over the ground, the path tile when it lands */
export function yardMaterial(sky: Sky): THREE.MeshLambertMaterial {
  const mat = painterlyMaterial(sky, { rim: 0, bands: 0.6, transparent: true, depthWrite: false });
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
  const white = new THREE.DataTexture(new Uint8Array([200, 160, 120, 255]), 1, 1);
  white.colorSpace = THREE.SRGBColorSpace; white.needsUpdate = true;
  mat.map = white;
  loadNalatiTexture('path').then((t) => { mat.map = t; return t; }).catch(() => null);
  return mat;
}
