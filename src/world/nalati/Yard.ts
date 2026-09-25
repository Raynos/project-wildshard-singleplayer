/**
 * Yard — trodden earth for the camps (the camp 9-angle round, gap #8): a draped decal over the terrain, textured with
 * the painted `path` tile (src/world/nalatiTextures.ts), whose alpha is the wear map — a worn ring inside the yurts,
 * paths from every door to the hearth, the track in from the road, bare patches at the hitching rail, the stove, the
 * kazan and the corral gate — broken at the edges by noise so it bleeds into the grass instead of ending on a line.
 * One mesh, one draw call, transparent (no depth write), a hair above the ground.
 *
 *   const yard = buildYardDecal(ctx, { x, z, half: 24 }, wear);   // wear: (x, z) → 0..1
 *   wearDisc(x, z, r) / wearPath(ax, az, bx, bz, w)                // the shapes, combine with Math.max
 */
import * as THREE from 'three';
import { Noise2D, smoothstep } from '../../core/noise';
import { painterlyMaterial } from '../painterly';
import { loadNalatiTexture, TEX_METRES } from '../nalatiTextures';
import type { Sky } from '../Sky';
import type { Ground } from './types';

const edge = new Noise2D(0x7a2d);

/** a worn disc: 1 inside r·0.75 → 0 at r, the rim ragged by noise */
export function wearDisc(cx: number, cz: number, r: number): (x: number, z: number) => number {
  return (x, z) => {
    const d = Math.hypot(x - cx, z - cz) + edge.get(x * 0.35, z * 0.35) * r * 0.22 + edge.get(x * 1.3, z * 1.3) * 0.35;
    return 1 - smoothstep(r * 0.72, r, d);
  };
}

/** a worn path from a to b, `w` metres wide, wobbling a little */
export function wearPath(ax: number, az: number, bx: number, bz: number, w: number): (x: number, z: number) => number {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
  return (x, z) => {
    const t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / l2));
    const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t)) + edge.get(x * 0.6 + 7, z * 0.6) * w * 0.35;
    return 1 - smoothstep(w * 0.35, w * 0.6, d);
  };
}

export function buildYardDecal(sky: Sky, ground: Ground, area: { x: number; z: number; half: number }, wear: (x: number, z: number) => number, cell = 0.8): THREE.Mesh {
  const n = Math.ceil((area.half * 2) / cell);
  const pos: number[] = [], col: number[] = [], uv: number[] = [], idx: number[] = [];
  const x0 = area.x - area.half, z0 = area.z - area.half, tm = TEX_METRES.path * 1.3;
  const keep: boolean[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const x = x0 + i * cell, z = z0 + j * cell;
    const a = Math.min(1, wear(x, z));
    pos.push(x, ground(x, z) + 0.035, z);
    // the earth is a touch darker and warmer where it is most worn (packed, dung-dark), paler at the fringe
    const k = 0.92 + 0.12 * edge.get(x * 0.9, z * 0.9);
    // the tile is a warm orange earth: pull it toward a paler, more neutral dust so it sits with the painted grass
    col.push(k * (0.9 - a * 0.06), k * (0.95 - a * 0.06), k * (1.02 - a * 0.04), a * 0.78);
    uv.push(x / tm, z / tm);
    keep.push(a > 0.01);
  }
  const w = n + 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
    if (!keep[a] && !keep[b] && !keep[c] && !keep[d]) continue;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mat = painterlyMaterial(sky, { rim: 0, bands: 0.6, transparent: true, depthWrite: false });
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
  const white = new THREE.DataTexture(new Uint8Array([200, 160, 120, 255]), 1, 1);
  white.colorSpace = THREE.SRGBColorSpace; white.needsUpdate = true;
  mat.map = white;
  loadNalatiTexture('path').then((t) => { mat.map = t; return t; }).catch(() => null);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.name = 'nalati-yard';
  return mesh;
}
