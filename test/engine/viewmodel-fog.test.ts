// A viewmodel material (fixIBL) replaces the prototype hook that hands every fogged material the shared fog uniforms. It
// must attach them itself: a level fog's own samplers (Nalati's fogCloudTex / fogLutV2) left unbound read texture unit 0,
// where the shadow map's sampler2DShadow sits — "two textures of different types use the same sampler location" (E357).
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fixIBL } from '../../src/engine/combat/view/ranged';
import { addFogUniforms, fogUniforms } from '../../src/engine/world/Atmosphere';

describe('viewmodel fog uniforms', () => {
  it('fixIBL keeps the IBL fix and attaches the engine and level fog uniforms', () => {
    const levelFog = { fogTestTex: { value: new THREE.Texture() } };
    addFogUniforms(levelFog);
    const mat = new THREE.MeshPhysicalMaterial();
    fixIBL(mat, 'viewmodel');
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, fragmentShader: '#include <lights_fragment_begin>', vertexShader: '' };
    Reflect.apply(mat.onBeforeCompile.bind(mat), undefined, [shader, null]);
    expect(shader.uniforms['fogTestTex']).toBe(levelFog.fogTestTex);
    expect(shader.uniforms['fogSunDir']).toBe(fogUniforms.fogSunDir);
    expect(shader.fragmentShader).toContain('material.dfg = texture2D( dfgLUT');
    expect(mat.customProgramCacheKey()).toBe('viewmodel|dfgfix');
  });
});
