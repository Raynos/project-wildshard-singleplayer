import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Object3D, Vector2 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { coarseMaskOrigin, coarseTileMask } from '../src/engine/world/coarseTileMask';
import { PATCH_ORDER, patchShader } from '../src/engine/render/shaderPatches';

// G587 (live 616ea317b): an open plot's survey floor family sets an explicit program key; its coarse tiles' masked
// variants kept that key, so the fine tiles drew with the masked program and the last coarse tile's mask: the floor
// vanished by view direction. A masked variant compiles its own program.
test('a coarse tile mask gives its variant its own program key under a family explicit key', () => {
  const scope = new Scope('coarse-key'), base = new MeshStandardMaterial(), geometry = new BoxGeometry();
  patchShader(base, 'family.measure', PATCH_ORDER.decorate, () => undefined, { key: 'family.pbr.measure.v1', scope });
  const fine = new Mesh(geometry, base), coarse = new Group(), tile = new Mesh(geometry, base); coarse.add(tile);
  coarseTileMask(coarse, 1, 2, scope)(new Set([0, 3]));
  const variant = tile.material;
  if (Array.isArray(variant)) throw new Error('Expected one material');
  expect(variant).not.toBe(base);
  expect(fine.material.customProgramCacheKey()).toBe('family.pbr.measure.v1');
  expect(variant.customProgramCacheKey()).not.toBe(base.customProgramCacheKey());
  expect(variant.customProgramCacheKey()).toContain('coarse-tile-mask');
  scope.dispose(); geometry.dispose(); base.dispose();
});

// Round 38: a grid neighbour's cell root sits translated from the render origin (Night Market at −555, 555); the mask's
// shaders compare world positions, so its origin follows the root's world matrix, not the cell-local corner.
test('a coarse tile mask origin follows its root into world space', () => {
  const cell = new Group(), root = new Group(); cell.position.set(-555, 0, 555); cell.add(root); cell.updateMatrixWorld(true);
  expect(coarseMaskOrigin(root.matrixWorld, 0, 0, new Vector2()).toArray()).toEqual([-805, 305]);
  expect(coarseMaskOrigin(root.matrixWorld, 3, 2, new Vector2()).toArray()).toEqual([-555 + 125, 555]);
  expect(coarseMaskOrigin(new Object3D().matrixWorld, 1, 1, new Vector2()).toArray()).toEqual([-125, -125]);
});

test('a coarse tile mask wraps each mesh draw and restores it with its scope', () => {
  const scope = new Scope('coarse-origin'), geometry = new BoxGeometry(), base = new MeshStandardMaterial(), root = new Group(), tile = new Mesh(geometry, base);
  root.add(tile); const hook = (): unknown => Reflect.get(tile, 'onBeforeRender'), draw = hook();
  coarseTileMask(root, 0, 0, scope);
  expect(hook()).not.toBe(draw);
  scope.dispose();
  expect(hook()).toBe(draw); expect(tile.material).toBe(base);
  geometry.dispose(); base.dispose();
});
