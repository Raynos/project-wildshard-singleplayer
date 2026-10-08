import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ownUniforms } from '../../src/engine/render/shaderPatches';

// G226: a region's material compiles under the neutral page shell without its home look's chunk patches
const KEY = 'g226_own_uniforms_pars';
const chunks: Record<string, string> = THREE.ShaderChunk;
const stage = (body: string) => ({ vertexShader: 'void main() {}', fragmentShader: `#include <${KEY}>\nvoid main() { ${body} }`, uniforms: {} as Record<string, THREE.IUniform> });
const own = { uNight: { type: 'float', uniform: { value: 0.25 } }, uZenith: { type: 'vec3', uniform: { value: new THREE.Color() } } };

describe('ownUniforms (G226)', () => {
  it('declares and binds what the resolved stage lacks, just before main', () => {
    chunks[KEY] = '';
    try {
      const s = stage('gl_FragColor = vec4(uZenith * uNight, 1.0);');
      expect(ownUniforms(s, 'fragment', own)).toEqual(['uNight', 'uZenith']);
      expect(s.fragmentShader).toBe(`#include <${KEY}>\nuniform float uNight;\nuniform vec3 uZenith;\nvoid main() { gl_FragColor = vec4(uZenith * uNight, 1.0); }`);
      expect(s.uniforms['uNight']).toBe(own.uNight.uniform);
      expect(s.uniforms['uZenith']).toBe(own.uZenith.uniform);
    } finally { Reflect.deleteProperty(chunks, KEY); }
  });

  it('leaves the source byte-identical when an installed chunk (nested, inside an #if) declares them', () => {
    chunks[KEY] = `#include <${KEY}_inner>`;
    chunks[`${KEY}_inner`] = '#ifndef NO_TOON\nuniform float uNight;\n#endif\n#ifdef USE_FOG\n  uniform vec3 uZenith; uniform vec3 uNear;\n#endif';
    try {
      const s = stage('');
      const before = s.fragmentShader;
      expect(ownUniforms(s, 'fragment', own)).toEqual([]);
      expect(s.fragmentShader).toBe(before);
      expect(Object.keys(s.uniforms)).toEqual([]);
    } finally { Reflect.deleteProperty(chunks, KEY); Reflect.deleteProperty(chunks, `${KEY}_inner`); }
  });

  it('refuses a stage with no main', () => {
    expect(() => ownUniforms({ vertexShader: '', fragmentShader: 'float x;', uniforms: {} }, 'fragment', own)).toThrow(/no void main/u);
  });
});
