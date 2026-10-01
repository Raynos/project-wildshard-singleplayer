import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PATCH_ORDER, hasProgramKey, patchIds, patchShader, takeForeignHook } from '../../src/engine/render/shaderPatches';

// the hooks read only these three fields; Reflect.apply passes the stand-in the way viewmodel-fog.test.ts does
const compile = (mat: THREE.Material): string => {
  const s = { vertexShader: 'v', fragmentShader: 'f', uniforms: {} as Record<string, THREE.IUniform> };
  Reflect.apply(mat.onBeforeCompile.bind(mat), undefined, [s, null]);
  return `${s.vertexShader}|${s.fragmentShader}|${Object.keys(s.uniforms).join(',')}`;
};

describe('shader-patch registry (E357 X6)', () => {
  it('chain keeps the inherited hook first; replace drops it', () => {
    const proto = Object.getOwnPropertyDescriptor(THREE.Material.prototype, 'onBeforeCompile');
    THREE.Material.prototype.onBeforeCompile = function onBeforeCompile(s) { s.uniforms['fog'] = { value: 1 }; };
    try {
      const chained = new THREE.MeshStandardMaterial(), replaced = new THREE.MeshStandardMaterial();
      patchShader(chained, 'a', PATCH_ORDER.material, (s) => { s.vertexShader += '+a'; });
      patchShader(replaced, 'a', PATCH_ORDER.material, (s) => { s.vertexShader += '+a'; }, { mode: 'replace' });
      expect(compile(chained)).toBe('v+a|f|fog');
      expect(compile(replaced)).toBe('v+a|f|');
      expect(patchIds(chained)).toEqual(['inherited', 'a']);
    } finally { if (proto) Object.defineProperty(THREE.Material.prototype, 'onBeforeCompile', proto); }
  });

  it('runs by order, ties in the order added, and compiles the same source twice', () => {
    const mat = new THREE.MeshStandardMaterial();
    patchShader(mat, 'late', PATCH_ORDER.shadows, (s) => { s.fragmentShader += '+csm'; });
    patchShader(mat, 'one', PATCH_ORDER.material, (s) => { s.fragmentShader += '+1'; }, { mode: 'replace' });
    patchShader(mat, 'two', PATCH_ORDER.decorate, (s) => { s.fragmentShader += '+2'; });
    patchShader(mat, 'three', PATCH_ORDER.decorate, (s) => { s.fragmentShader += '+3'; });
    expect(patchIds(mat)).toEqual(['one', 'two', 'three']);
    expect(compile(mat)).toBe('v|f+1+2+3|');
    expect(compile(mat)).toBe(compile(mat));
  });

  it('a replace on a patched material drops its earlier patches but keeps its key', () => {
    const mat = new THREE.MeshStandardMaterial();
    patchShader(mat, 'first', PATCH_ORDER.material, (s) => { s.fragmentShader += '+first'; }, { mode: 'replace', key: 'k1' });
    patchShader(mat, 'second', PATCH_ORDER.material, (s) => { s.fragmentShader += '+second'; }, { mode: 'replace' });
    expect(compile(mat)).toBe('v|f+second|');
    expect(mat.customProgramCacheKey()).toBe('k1');
  });

  it('keys: a fixed string, one built on the prior key, and three\'s default (the last patch text)', () => {
    const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshStandardMaterial(), plain = new THREE.MeshStandardMaterial();
    const site = (m: THREE.Material): void => { patchShader(m, 'site', PATCH_ORDER.material, (s) => { s.vertexShader += '+site'; }, { mode: 'replace' }); };
    site(a); site(b);
    expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
    expect(hasProgramKey(a)).toBe(false);
    patchShader(a, 'tint', PATCH_ORDER.decorate, (s) => { s.vertexShader += '+tint'; }, { key: (k) => `${k}|tint` });
    expect(a.customProgramCacheKey()).toMatch(/\|tint$/u);
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
    expect(hasProgramKey(a)).toBe(true);
    plain.customProgramCacheKey = () => 'own';
    patchShader(plain, 'csm', PATCH_ORDER.shadows, () => { /* uniforms only */ }, { key: (k) => `${k}|csm` });
    expect(plain.customProgramCacheKey()).toBe('own|csm');
  });

  it('takes a foreign hook without losing the material\'s own patches; undo removes a patch', () => {
    const mat = new THREE.MeshStandardMaterial();
    patchShader(mat, 'own', PATCH_ORDER.material, (s) => { s.fragmentShader += '+own'; }, { mode: 'replace', key: 'own' });
    const foreign = takeForeignHook(mat, () => { mat.onBeforeCompile = (s) => { s.uniforms['csm'] = { value: 0 }; }; });
    patchShader(mat, 'csm', PATCH_ORDER.shadows, (s, r) => { foreign(s, r); }, { key: (k) => `${k}|csm` });
    expect(compile(mat)).toBe('v|f+own|csm');
    expect(mat.customProgramCacheKey()).toBe('own|csm');
    const undo = patchShader(mat, 'cut', PATCH_ORDER.view, (s) => { s.fragmentShader += '+cut'; }, { key: (k) => `${k}|cut` });
    expect(compile(mat)).toBe('v|f+own+cut|csm');
    undo();
    expect(compile(mat)).toBe('v|f+own|csm');
    expect(mat.customProgramCacheKey()).toBe('own|csm');
  });
});
