import { expect, test } from 'vitest';
import * as THREE from 'three';
import { chunkShadowCastersSliced } from '../src/engine/world/shadowChunks';
import golden from './fixtures/shadow-chunks-golden.json' with { type: 'json' };

// E153 / SF67: shadow casters split into the same pieces, the same index order and the same bounds as before the
// array reads (a Float32 non-indexed sheet and an indexed sheet of normalized Int16 positions, which keeps the accessors)

function fixture(): THREE.Scene {
  const scene = new THREE.Scene();
  // a wavy non-indexed sheet (Float32 positions) and an indexed sheet with normalized Int16 positions, both island-wide
  const sheet = new THREE.PlaneGeometry(240, 180, 48, 36).toNonIndexed(); sheet.rotateX(-Math.PI / 2);
  const p = sheet.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, Math.sin(p.getX(i) * 0.05) * 4 + Math.cos(p.getZ(i) * 0.07) * 3);
  const a = new THREE.Mesh(sheet, new THREE.MeshStandardMaterial()); a.name = 'sheet'; a.castShadow = true; a.position.set(10, 0, -5);
  const grid = new THREE.PlaneGeometry(200, 200, 40, 40); grid.rotateX(-Math.PI / 2);
  const src = grid.getAttribute('position'), packed = new Int16Array(src.count * 3);
  for (let i = 0; i < src.count; i++) { packed[3 * i] = Math.round(src.getX(i) / 100 * 32767); packed[3 * i + 1] = Math.round(Math.sin(i) * 3000); packed[3 * i + 2] = Math.round(src.getZ(i) / 100 * 32767); }
  grid.setAttribute('position', new THREE.BufferAttribute(packed, 3, true));
  const b = new THREE.Mesh(grid, new THREE.MeshStandardMaterial()); b.name = 'grid'; b.castShadow = true; b.scale.setScalar(100);
  scene.add(a, b);
  return scene;
}
async function pieces(scene: THREE.Scene): Promise<unknown> {
  const report = await chunkShadowCastersSliced(scene, () => null);
  const rows: unknown[] = [];
  scene.traverse(o => {
    if (!(o instanceof THREE.Mesh) || !o.name.includes('-shadow-pieces-')) return;
    const g: unknown = o.geometry;
    if (!(g instanceof THREE.BufferGeometry)) return;
    const index = g.index?.array ?? [];
    let sum = 0; for (let i = g.drawRange.start; i < g.drawRange.start + g.drawRange.count; i++) sum = (sum * 31 + (index[i] ?? 0)) % 1_000_000_007;
    const s = g.boundingSphere;
    rows.push([o.name, g.drawRange.start, g.drawRange.count, sum, s === null ? null : [s.center.x, s.center.y, s.center.z, s.radius].map(n => Math.round(n * 1e6) / 1e6)]);
  });
  return { report, rows };
}

test('shadow chunking makes the recorded pieces, and a second walk adds none', async () => {
  const scene = fixture();
  expect(await pieces(scene)).toEqual(golden);
  const again = await chunkShadowCastersSliced(scene, () => null);
  expect(again).toEqual({ meshes: 0, pieces: 0, tris: 0 });
});
