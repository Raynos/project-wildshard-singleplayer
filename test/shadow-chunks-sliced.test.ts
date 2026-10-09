import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { chunkShadowCasters, chunkShadowCastersSliced } from '../src/engine/world/shadowChunks';

/** An island-sized grid (≥ 40 m radius, enough triangles to cross several pause points). */
function islandScene(): THREE.Scene {
  const scene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(300, 300, 160, 160).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.name = 'island';
  mesh.castShadow = true;
  scene.add(mesh);
  const small = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  small.castShadow = true;
  scene.add(small);
  return scene;
}

function pieces(scene: THREE.Scene): { name: string; start: number; count: number; index: number[] }[] {
  const out: { name: string; start: number; count: number; index: number[] }[] = [];
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.parent === scene) return;
    const g = o.geometry as THREE.BufferGeometry;
    out.push({ name: o.name, start: g.drawRange.start, count: g.drawRange.count, index: out.length === 0 && g.index ? Array.from(g.index.array as ArrayLike<number>) : [] });
  });
  return out;
}

describe('SF67: sliced shadow-caster chunking', () => {
  it('makes exactly the pieces the one-task split makes, pausing along the way', async () => {
    const a = islandScene(), b = islandScene();
    const sync = chunkShadowCasters(a);
    let pauses = 0;
    const sliced = await chunkShadowCastersSliced(b, () => { pauses++; return Promise.resolve(); }, 0);
    expect(sliced).toEqual(sync);
    expect(sync.meshes).toBe(1);
    expect(pauses).toBeGreaterThan(4);
    const pa = pieces(a), pb = pieces(b);
    expect(pb.length).toBe(pa.length);
    expect(pb).toEqual(pa);
  });

  it('runs once: a second pass finds every mesh already chunked', async () => {
    const s = islandScene();
    await chunkShadowCastersSliced(s, () => Promise.resolve(), 0);
    expect(chunkShadowCasters(s)).toEqual({ meshes: 0, pieces: 0, tris: 0 });
  });
});
