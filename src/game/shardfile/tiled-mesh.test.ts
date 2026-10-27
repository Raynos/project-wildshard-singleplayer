import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { tiledMesh } from './tiledMesh';
import { tileKey } from './tileContent';
import { tileOf } from './tileOrder';

// Tile streaming T3: a merged recipe mesh keeps one draw; its index holds only the resident tiles' triangles. A made-up
// mesh with one small triangle at each of three spots, two of them in the same tile.
const spots: readonly (readonly [number, number])[] = [[-200, -200], [-190, -195], [100, 150]];
function made(): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(spots.flatMap(([x, z]) => [x, 0, z, x + 1, 0, z, x, 0, z + 1])), 3));
  return new Mesh(geometry, new MeshBasicMaterial());
}
const key = (x: number, z: number): number => tileKey(tileOf(x, z));

test('a merged mesh draws only its resident tiles, one draw throughout', () => {
  const mesh = made(), content = tiledMesh('rocks.shore', mesh, new Matrix4()), scope = new Scope('tiles');
  if (content === null) throw new Error('expected a tiled mesh');
  const near = key(-200, -200), far = key(100, 150);
  expect([...content.tiles()].sort((a, b) => a - b)).toEqual([near, far].sort((a, b) => a - b));
  expect(mesh.geometry.drawRange.count).toBe(0);
  const nearScope = scope.child('near'), farScope = scope.child('far');
  void content.attach(far, farScope);
  expect(mesh.geometry.drawRange.count).toBe(3);
  expect(Array.from(mesh.geometry.index?.array.slice(0, 3) ?? [])).toEqual([6, 7, 8]);
  void content.attach(near, nearScope);
  expect(mesh.geometry.drawRange.count).toBe(9);
  farScope.dispose();
  expect(mesh.geometry.drawRange.count).toBe(6);
  expect(Array.from(mesh.geometry.index?.array.slice(0, 6) ?? [])).toEqual([0, 1, 2, 3, 4, 5]);
  scope.dispose();
  expect(mesh.geometry.drawRange.count).toBe(0);
});

test('static content wholly in one tile follows that tile (a frozen weld mesh)', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from([-200, 0, -200, -199, 0, -200, -200, 0, -199]), 3));
  const mesh = new Mesh(geometry, new MeshBasicMaterial()), scope = new Scope('weld');
  expect(tiledMesh('weld.hut', mesh, new Matrix4())).toBeNull();
  const content = tiledMesh('weld.hut', mesh, new Matrix4(), { single: true });
  if (content === null) throw new Error('expected a single-tile weld mesh');
  expect([...content.tiles()]).toEqual([key(-200, -200)]);
  expect(mesh.geometry.drawRange.count).toBe(0);
  const held = scope.child('tile');
  void content.attach(key(-200, -200), held);
  expect(mesh.geometry.drawRange.count).toBe(3);
  held.dispose();
  expect(mesh.geometry.drawRange.count).toBe(0);
  scope.dispose();
});

test('the cell transform places the triangles; a mesh in one tile stays whole', () => {
  const moved = tiledMesh('wreck.root', made(), new Matrix4().makeTranslation(50, 0, 0));
  expect(moved === null ? null : [...moved.tiles()].sort((a, b) => a - b)).toEqual([key(-150, -200), key(150, 150)].sort((a, b) => a - b));
  expect(key(-150, -200)).not.toBe(key(-200, -200));
  const one = new BufferGeometry();
  one.setAttribute('position', new BufferAttribute(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  expect(tiledMesh('trolley', new Mesh(one, new MeshBasicMaterial()), new Matrix4())).toBeNull();
});

test('an instanced part draws only its resident tiles\' instances, every channel alike, one draw', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  const seeds = new InstancedBufferAttribute(Float32Array.from([10, 20, 30]), 1);
  geometry.setAttribute('aSeed', seeds);
  const mesh = new InstancedMesh(geometry, new MeshBasicMaterial(), 3);
  spots.forEach(([x, z], i) => { mesh.setMatrixAt(i, new Matrix4().makeTranslation(x, 0, z)); });
  const content = tiledMesh('palms', mesh, new Matrix4()), scope = new Scope('tiles');
  if (content === null) throw new Error('expected tiled instances');
  const near = key(-200, -200), far = key(100, 150), seed = (): number[] => Array.from(seeds.array.slice(0, mesh.count));
  expect(mesh.count).toBe(0);
  const farScope = scope.child('far'), nearScope = scope.child('near');
  void content.attach(far, farScope);
  expect(mesh.count).toBe(1); expect(seed()).toEqual([30]); expect(mesh.instanceMatrix.array[12]).toBe(100);
  void content.attach(near, nearScope);
  expect(mesh.count).toBe(3); expect(seed()).toEqual([10, 20, 30]);
  farScope.dispose();
  expect(mesh.count).toBe(2); expect(seed()).toEqual([10, 20]); expect(mesh.instanceMatrix.array[12]).toBe(-200);
  scope.dispose();
  expect(mesh.count).toBe(0);
  // its channels are dynamic: a GPU-only release (static attributes only) never drops their CPU copies
  expect(seeds.usage).toBe(DynamicDrawUsage); expect(mesh.instanceMatrix.usage).toBe(DynamicDrawUsage);
  // a part with a per-frame hook of its own (a culler owns its count) stays whole
  const culled = new InstancedMesh(geometry, new MeshBasicMaterial(), 3);
  spots.forEach(([x, z], i) => { culled.setMatrixAt(i, new Matrix4().makeTranslation(x, 0, z)); });
  culled.onBeforeRender = () => undefined;
  expect(tiledMesh('culled', culled, new Matrix4())).toBeNull();
});

test('an instanced part whose channel holds fewer instances, or whose geometry another part compacts, stays whole', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(Float32Array.from([10, 20, 30]), 1));
  const place = (mesh: InstancedMesh): InstancedMesh => { spots.forEach(([x, z], i) => { mesh.setMatrixAt(i, new Matrix4().makeTranslation(x, 0, z)); }); return mesh; };
  const first = place(new InstancedMesh(geometry, new MeshBasicMaterial(), 3)), second = place(new InstancedMesh(geometry, new MeshBasicMaterial(), 3));
  expect(tiledMesh('first', first, new Matrix4())).not.toBeNull();
  expect(tiledMesh('second', second, new Matrix4())).toBeNull();
  const short = new BufferGeometry();
  short.setAttribute('position', new BufferAttribute(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  short.setAttribute('aSeed', new InstancedBufferAttribute(Float32Array.from([10, 20]), 1));
  expect(tiledMesh('short', place(new InstancedMesh(short, new MeshBasicMaterial(), 3)), new Matrix4())).toBeNull();
});
