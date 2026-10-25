import { expect, test } from 'vitest';
import * as THREE from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { GroundMerge } from './groundMerge';

// Tile streaming P1 (draws): a splat ground's resident tiles draw as one merged mesh per material; a coarse tile leaves out
// the quadrants its fine tiles cover, and the merge follows its members' tile scopes.
const settle = (): Promise<void> => new Promise(resolve => { queueMicrotask(resolve); });
function tile(x: number, z: number): THREE.Mesh {
  // two triangles: one in the tile's -x -z quadrant, one in its +x +z quadrant (a coarse tile is 125 m from (x, z))
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x + 1, 0, z + 1, x + 2, 0, z + 1, x + 1, 0, z + 2, x + 100, 0, z + 100, x + 101, 0, z + 100, x + 100, 0, z + 101], 3));
  g.setAttribute('splat', new THREE.Float32BufferAttribute(Array.from({ length: 24 }, () => 0.25), 4));
  g.setIndex([0, 2, 1, 3, 5, 4]);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial());
}

test('fine tiles draw as one mesh; tiles leave with their scopes; the last takes the mesh', async () => {
  const parent = new THREE.Group(), material = new THREE.MeshBasicMaterial(), merge = new GroundMerge(parent, material, 'ground.fine');
  const a = new Scope('a'), b = new Scope('b'), ta = tile(-250, -250), tb = tile(-125, -250);
  merge.add(ta, a); merge.add(tb, b); await settle();
  expect([ta.visible, tb.visible]).toEqual([false, false]);
  expect(parent.children).toHaveLength(1);
  const merged = merge.mesh; if (merged === null) throw new Error('no merged mesh');
  expect(merged.material).toBe(material);
  expect(merged.geometry.getIndex()?.count).toBe(12);
  expect(Object.keys(merged.geometry.attributes).sort()).toEqual(['position', 'splat']);
  a.dispose(); await settle();
  expect(merge.mesh?.geometry.getIndex()?.count).toBe(6);
  b.dispose(); await settle();
  expect(merge.mesh).toBeNull(); expect(parent.children).toHaveLength(0);
});

test('a coarse tile leaves out the quadrants fine tiles cover', async () => {
  const parent = new THREE.Group(), merge = new GroundMerge(parent, new THREE.MeshBasicMaterial(), 'ground.coarse'), scope = new Scope('c');
  const hide = merge.add(tile(-250, -250), scope, { x: 0, z: 0 }); await settle();
  expect(merge.mesh?.geometry.getIndex()?.count).toBe(6);
  hide(new Set([0])); await settle();                      // the -x -z quadrant: its triangle goes
  expect(merge.mesh?.geometry.getIndex()?.count).toBe(3);
  hide(new Set([0, 1, 2, 3])); await settle();             // all four: the tile draws nothing
  expect(merge.mesh).toBeNull();
  scope.dispose();
});

test('tiles draw one mesh per 250 m block; a change rebuilds only its block', async () => {
  const parent = new THREE.Group(), merge = new GroundMerge(parent, new THREE.MeshBasicMaterial(), 'ground.fine');
  const a = new Scope('a'), b = new Scope('b'), c = new Scope('c');
  merge.add(tile(-250, -250), a); merge.add(tile(10, -250), b); await settle();
  expect(merge.meshes).toHaveLength(2); expect(parent.children).toHaveLength(2);
  const [west, east] = merge.meshes;
  merge.add(tile(-125, -250), c); await settle();                // joins the west block
  expect(merge.meshes).toHaveLength(2);
  expect(merge.meshes).toContain(east);                           // the east block kept its mesh
  expect(merge.meshes).not.toContain(west);
  expect(merge.meshes.map(mesh => mesh.geometry.getIndex()?.count ?? 0).sort((x, y) => x - y)).toEqual([6, 12]);
  b.dispose(); await settle();
  expect(merge.meshes).toHaveLength(1); expect(merge.size).toBe(2);
  a.dispose(); c.dispose(); await settle();
  expect(merge.meshes).toHaveLength(0); expect(parent.children).toHaveLength(0);
});
