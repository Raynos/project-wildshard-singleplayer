/** Nalati's retained authored stone construction; no runtime bake lookup. */
import * as THREE from 'three';
import type { Rng } from '@wildshard/sdk/random';
import { Noise2D } from './dressingNoise';

/** a smooth lumpy stone: an icosphere (detail 2 = 320 faces, 1 = 80) displaced by seeded noise, squashed. A shard that adds
 *  dressing recipe builds the shape here; smooth normals retain the native arithmetic */
export function blob(r: number, rng: Rng, detail = 1, squash = 0.75, rough = 0.22): THREE.BufferGeometry {
  const g = blobShape(r, rng, detail, squash, rough);
  g.computeVertexNormals();
  return g;
}

/** the blob's welded, displaced shape: indexed, `position` only */
function blobShape(r: number, rng: Rng, detail: number, squash: number, rough: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const merged = mergeVerticesByPos(g);
  const pos = merged.getAttribute('position');
  const ox = rng.range(0, 100), oz = rng.range(0, 100);
  const nz = new Noise2D(rng.int(1, 1e6));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 + rough * (nz.get(x / r * 1.3 + ox, z / r * 1.3 + y / r + oz) * 0.75 + nz.get(x / r * 3 + oz, y / r * 3 - ox) * 0.25);
    pos.setXYZ(i, x * k, y * k * squash, z * k);
  }
  return merged;
}

/** weld an unindexed / seam-split geometry by position (so displacement keeps it watertight and normals smooth) */
export function mergeVerticesByPos(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const src = g.index ? g.toNonIndexed() : g;
  const pos = src.getAttribute('position');
  const map = new Map<string, number>();
  const verts: number[] = [], idx: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let k = map.get(key);
    if (k === undefined) { k = verts.length / 3; verts.push(x, y, z); map.set(key, k); }
    idx.push(k);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(idx);
  if (src !== g) src.dispose();
  g.dispose();
  return out;
}

