import { afterEach, expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector2, type Material, type Uniform, type Vector4 } from 'three';
import { Scope } from '../app/scope';
import { coarseMaskOrigin, coarseTileMask } from './coarseTileMask';
import { installNodeCoarseMask } from '../render/nodeCoarseMask';

// NF2: Nine's coarse facade graph compiled one masked program per coarse tile (20 of its 95). A node material's masked
// variant is now shared by every tile drawing that surface; each tile's draw writes its own origin and mask first.
const masked: { material: Material; origin: Uniform<Vector2>; mask: Uniform<Vector4> }[] = [];
installNodeCoarseMask((material, origin, mask) => {
  if (Reflect.get(material, 'isNodeMaterial') !== true) return false;
  masked.push({ material, origin, mask }); return true;
});
afterEach(() => { masked.length = 0; });

/** a node material's marker, kept through `clone()` as three's NodeMaterial keeps it */
class NodeLike extends MeshBasicMaterial { readonly isNodeMaterial = true; }
const nodeLike = (): MeshBasicMaterial => new NodeLike();
const draw = (mesh: Mesh): void => {
  const hook: unknown = Reflect.get(mesh, 'onBeforeRender');
  if (typeof hook !== 'function') throw new Error('Expected a draw hook');
  // the mask hook reads only its own tile; the wrapped default hook ignores its renderer arguments
  Reflect.apply(hook, mesh, []);
};

test('coarse tiles drawing one node surface share one masked variant, each draw carrying its own tile', () => {
  const base = nodeLike(), geometry = new BoxGeometry(), first = new Scope('coarse-a'), second = new Scope('coarse-b');
  const rootA = new Group(), rootB = new Group(), a = new Mesh(geometry, base), b = new Mesh(geometry, base);
  rootA.add(a); rootB.add(b); rootB.position.set(10, 0, 0); rootB.updateMatrixWorld(true); rootA.updateMatrixWorld(true);
  const maskA = coarseTileMask(rootA, 0, 1, first), maskB = coarseTileMask(rootB, 3, 2, second);
  expect(a.material).toBe(b.material); expect(a.material).not.toBe(base); expect(masked).toHaveLength(1);
  const shared = masked[0]; if (shared === undefined) throw new Error('Expected the shared mask');
  maskA(new Set([1])); maskB(new Set([0, 2]));
  draw(a);
  expect(shared.origin.value.toArray()).toEqual(coarseMaskOrigin(rootA.matrixWorld, 0, 1, new Vector2()).toArray());
  expect(shared.mask.value.toArray()).toEqual([0, 1, 0, 0]);
  draw(b);
  expect(shared.origin.value.toArray()).toEqual(coarseMaskOrigin(rootB.matrixWorld, 3, 2, new Vector2()).toArray());
  expect(shared.mask.value.toArray()).toEqual([1, 0, 1, 0]);
  draw(a); expect(shared.mask.value.toArray()).toEqual([0, 1, 0, 0]);
  // the variant lives while any tile uses it, and goes with the last
  let disposed = 0; shared.material.addEventListener('dispose', () => { disposed++; });
  first.dispose(); expect(a.material).toBe(base); expect(disposed).toBe(0);
  second.dispose(); expect(b.material).toBe(base); expect(disposed).toBe(1);
  // a later tile builds a fresh shared variant
  const third = new Scope('coarse-c'), rootC = new Group(), c = new Mesh(geometry, base); rootC.add(c);
  coarseTileMask(rootC, 1, 1, third);
  expect(c.material).not.toBe(shared.material); expect(masked).toHaveLength(2);
  third.dispose(); geometry.dispose(); base.dispose();
});

test('classic materials keep one masked variant per tile', () => {
  const base = new MeshBasicMaterial(), geometry = new BoxGeometry(), first = new Scope('classic-a'), second = new Scope('classic-b');
  const rootA = new Group(), rootB = new Group(), a = new Mesh(geometry, base), b = new Mesh(geometry, base);
  rootA.add(a); rootB.add(b);
  coarseTileMask(rootA, 0, 0, first); coarseTileMask(rootB, 1, 0, second);
  expect(a.material).not.toBe(b.material); expect(masked).toHaveLength(0);
  first.dispose(); second.dispose(); geometry.dispose(); base.dispose();
});
