import { expect, test } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { coarseTileMask } from '../src/engine/world/coarseTileMask';
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
