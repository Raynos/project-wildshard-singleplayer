import { expect, test } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { scopeLookChunks, type LookChunks } from '../src/engine/render/regionLook';
import { copyShaderPatches } from '../src/engine/render/shaderPatches';

// A grid cell clip variant copies its source's patches (region look included); the region look's per-frame sweep then
// reached the variant as a new material and patched it again: its key gained a second `|look:` and it linked again.
test('a patch copy of a swept material keeps one region look', () => {
  const look: LookChunks = { id: 'copy-look', chunks: { fog_fragment: '// region fog' }, uniforms: [] };
  const scope = new Scope('region-look-copies'), root = new THREE.Group(), material = new THREE.MeshLambertMaterial(), geometry = new THREE.PlaneGeometry();
  try {
    root.add(new THREE.Mesh(geometry, material));
    const scoped = scopeLookChunks(root, look, scope);
    expect(scoped.sweep()).toBe(1);
    const looks = (m: THREE.Material): number => m.customProgramCacheKey().split('|look:copy-look').length - 1;
    expect(looks(material)).toBe(1);
    const variant = material.clone(); copyShaderPatches(material, variant);
    root.add(new THREE.Mesh(geometry, variant));
    expect(scoped.sweep()).toBe(0);
    expect(looks(variant)).toBe(1);
    // a material the look has not reached is still patched
    const late = new THREE.MeshLambertMaterial(); root.add(new THREE.Mesh(geometry, late));
    expect(scoped.sweep()).toBe(1); expect(looks(late)).toBe(1);
    late.dispose(); variant.dispose();
  } finally { scope.dispose(); material.dispose(); geometry.dispose(); }
});
