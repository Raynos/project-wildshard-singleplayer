/**
 * The glacier's snout (E306 / E315 second pass; was src/shards/nalati-grasslands/world/Bowl.ts `buildGlacier`, verbatim; E323: the first
 * pass dropped its card while it was still drawn): a blue ice cliff at the tongue's foot, from the tongue's last row down
 * into the valley floor, with the dark portal the meltwater stream runs out of. The tongue itself is the terrain (its
 * convex ramp, `GLACIER`), painted as ice per pixel by terrainSurface.ts. Used once.
 *
 * Fitted to the ground: every column of the cliff reads the terrain under the tongue's end (`snoutGeometry(ground)`, world
 * space), so the Explorer's specimen is the real one moved to the origin. One mesh on the POI material, no shadow of its
 * own; walk-through (the stream runs out of it).
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { poiMaterial } from '../world/paint';
import { GLACIER } from '../layout';

const ICE = { mid: new THREE.Color('#bcd6e8'), deep: new THREE.Color('#6f9fc4'), dark: new THREE.Color('#10202c') };

/** the snout's geometry in world space, fitted to `ground` */
export function snoutGeometry(ground: (x: number, z: number) => number): THREE.BufferGeometry {
  const ax = GLACIER.x1 - GLACIER.x0, az = GLACIER.z1 - GLACIER.z0, len = Math.hypot(ax, az);
  const ux = ax / len, uz = az / len, px = -uz, pz = ux;                        // along the flow, and across it
  const at = (t: number, v: number): { x: number; z: number } => ({ x: GLACIER.x0 + ax * t + px * v * GLACIER.half, z: GLACIER.z0 + az * t + pz * v * GLACIER.half });
  // the tongue's surface is the terrain's own (terrainSurface.ts paints the ice, crevasses and moraine per pixel — a
  // vertex-coloured skin over it read quilted); this mesh is only the snout
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const NV = 18, T1 = 0.985;
  const c = new THREE.Color();
  // the snout: an ice cliff from the tongue's last row down to the valley floor, the portal dark in its middle
  const tEnd = T1, drop = 2.5;
  for (let j = 0; j <= NV; j++) {
    const v = ((j / NV) * 2 - 1) * 0.93;
    const top = at(tEnd, v), foot = at(tEnd + 0.03, v * 1.04);
    const yTop = ground(top.x, top.z) + 0.14, yFoot = ground(foot.x, foot.z) - drop;
    for (let k = 0; k <= 4; k++) {
      const f = k / 4;
      pos.push(top.x + (foot.x - top.x) * f, yTop + (yFoot - yTop) * f, top.z + (foot.z - top.z) * f);
      const portal = Math.max(0, 1 - Math.abs(v - 0.1) / 0.16) * (f > 0.45 ? 1 : 0);
      c.copy(ICE.mid).lerp(ICE.deep, 0.35 + f * 0.5).lerp(ICE.dark, portal * 0.9);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < NV; j++) for (let k = 0; k < 4; k++) {
    const a = j * 5 + k, b = a + 5;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** where the snout stands: the middle of the tongue's end, on the ground */
export function snoutAt(ground: (x: number, z: number) => number): { x: number; y: number; z: number } {
  const x = GLACIER.x0 + (GLACIER.x1 - GLACIER.x0) * 0.985, z = GLACIER.z0 + (GLACIER.z1 - GLACIER.z0) * 0.985;
  return { x, y: ground(x, z), z };
}

export const glacierSnout = defineModel<object>({
  id: 'nalati-grasslands/glacier-snout', name: 'Glacier snout', category: 'nature', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/glacierSnout.ts', surface: 'ground',
  defaults: {},
  build: (ctx) => {
    const g = snoutGeometry(heightAt), o = snoutAt(heightAt);
    g.translate(-o.x, -o.y, -o.z);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return [{ geometry: g, material: poiMaterial(ctx.sky), castShadow: false, receiveShadow: true }];
  },
});
