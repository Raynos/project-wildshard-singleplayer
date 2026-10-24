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

// The sweep reads a list of the region's material nodes, rebuilt only when something is attached or detached: a swap,
// a node attached deep in the region, an edited material array and a node moved out of it each still land right.
test('the region look reaches swaps, deep attaches and edited arrays, and lets go of detached nodes', () => {
  const look: LookChunks = { id: 'list-look', chunks: { fog_fragment: '// region fog' }, uniforms: [] };
  const scope = new Scope('region-look-list'), root = new THREE.Group(), geometry = new THREE.PlaneGeometry();
  const made: THREE.Material[] = [], fresh = (): THREE.MeshLambertMaterial => { const m = new THREE.MeshLambertMaterial(); made.push(m); return m; };
  const looked = (m: THREE.Material): boolean => m.customProgramCacheKey().includes('|look:list-look');
  try {
    const inner = new THREE.Group(), mesh = new THREE.Mesh(geometry, fresh());
    inner.add(mesh); root.add(inner);
    const scoped = scopeLookChunks(root, look, scope);
    expect(scoped.sweep()).toBe(1);
    expect(scoped.sweep()).toBe(0);
    const swapped = fresh(); mesh.material = swapped;
    expect(scoped.sweep()).toBe(1); expect(looked(swapped)).toBe(true);
    const deep = new THREE.Mesh(geometry, fresh()); mesh.add(deep);
    expect(scoped.sweep()).toBe(1); expect(looked(deep.material)).toBe(true);
    const pair = new THREE.Mesh(geometry, [fresh(), fresh()]); inner.add(pair);
    expect(scoped.sweep()).toBe(2);
    const pushed = fresh(); pair.material.push(pushed);
    expect(scoped.sweep()).toBe(1); expect(looked(pushed)).toBe(true);
    const outside = new THREE.Group(); outside.add(deep);
    const away = fresh(); deep.material = away;
    expect(scoped.sweep()).toBe(0); expect(looked(away)).toBe(false);
    const watches = (o: THREE.Object3D): number => {
      const all: unknown = Reflect.get(o, '_listeners'), list: unknown = typeof all === 'object' && all !== null ? Reflect.get(all, 'childadded') : undefined;
      return Array.isArray(list) ? list.length : 0;
    };
    expect(watches(mesh)).toBe(1);
    scope.dispose();
    expect(watches(mesh)).toBe(0);
  } finally { scope.dispose(); for (const m of made) m.dispose(); geometry.dispose(); }
});
