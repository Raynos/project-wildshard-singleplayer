import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { tiledMesh } from '../src/game/shardfile/tiledMesh';
import { tileKey } from '../src/game/shardfile/tileContent';
import { tileOf } from '../src/game/shardfile/tileOrder';

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

test('the cell transform places the triangles; a mesh in one tile stays whole', () => {
  const moved = tiledMesh('wreck.root', made(), new Matrix4().makeTranslation(50, 0, 0));
  expect(moved === null ? null : [...moved.tiles()].sort((a, b) => a - b)).toEqual([key(-150, -200), key(150, 150)].sort((a, b) => a - b));
  expect(key(-150, -200)).not.toBe(key(-200, -200));
  const one = new BufferGeometry();
  one.setAttribute('position', new BufferAttribute(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]), 3));
  expect(tiledMesh('trolley', new Mesh(one, new MeshBasicMaterial()), new Matrix4())).toBeNull();
});
