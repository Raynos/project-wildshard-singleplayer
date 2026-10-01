// E357 S3.2 (07 §6.2): Nalati's painterly look as its LookStrategy — the fog installs after the engine fog, its
// uniforms reach every fogged material, and the 'replace' compose returns today's chain in today's order.
import * as THREE from 'three';
import { RenderPass, EffectPass } from 'postprocessing';
import { describe, expect, it } from 'vitest';
import { installAtmosphere, attachFogUniforms } from '#engine/world/Atmosphere';
import { installPaintedAir, isPaintedAir, paintedAir, patchCloudShadows, NALATI_SKY } from '#shards/nalati-grasslands/look/air';
import { installLookV2Fog, fogLut } from '#shards/nalati-grasslands/look/fog';
import { lookV2Passes } from '#shards/nalati-grasslands/look/grade';

describe('Nalati look strategy', () => {
  it('installs the painted air + panorama fog over the engine fog (slot 300 after 100)', () => {
    installAtmosphere({});
    const engineFog = THREE.ShaderChunk.fog_fragment;
    expect(isPaintedAir()).toBe(false);
    installPaintedAir();
    installLookV2Fog();
    expect(isPaintedAir()).toBe(true);
    expect(THREE.ShaderChunk.fog_fragment).not.toBe(engineFog);
    expect(THREE.ShaderChunk.fog_pars_fragment).toContain('float pCloudShadow()');
    expect(THREE.ShaderChunk.fog_pars_fragment).toContain('uniform sampler2D fogLutV2;');
    const shader = { uniforms: {} as Record<string, THREE.IUniform> };
    attachFogUniforms(shader);
    expect(shader.uniforms['fogAerial']).toBe(paintedAir.fogAerial);
    expect(shader.uniforms['fogCloud']).toBe(paintedAir.fogCloud);
    const lut = shader.uniforms['fogLutV2']?.value as THREE.DataTexture | undefined;
    expect(lut).toBe(fogLut);
    expect(Array.from(lut?.image.data ?? [])).toEqual(Array.from(fogLut.image.data ?? []));
  });

  it('builds no engine cloud layer; the cloud fbm drives the cloud shadows in the sun loop', () => {
    expect(NALATI_SKY.clouds).toBe(false);
    const field = new THREE.Texture();
    patchCloudShadows();
    expect(THREE.ShaderChunk.lights_fragment_begin).toContain('directLight.color *= pCloudShadow();');
    const build = NALATI_SKY.build;
    if (build) Reflect.apply(build, undefined, [null, field]);
    expect(paintedAir.fogCloudTex.value).toBe(field);
    const off = paintedAir.fogCloudOff.value.clone();
    NALATI_SKY.update?.(1);
    expect(paintedAir.fogCloudOff.value.equals(off)).toBe(false);
  });

  it("composes today's chain: RenderPass, then one EffectPass (bloom + grade on desktop)", () => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    for (const tier of ['phone', 'desktop'] as const) {
      const chain = lookV2Passes({ scene, camera, tier });
      expect(chain).toHaveLength(2);
      expect(chain[0]).toBeInstanceOf(RenderPass);
      expect(chain[1]).toBeInstanceOf(EffectPass);
    }
  });
});
