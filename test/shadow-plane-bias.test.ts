/**
 * Shadow acne fix (E435): three's 5-tap PCF gets the receiver-plane depth bias (src/engine/world/shadowFilter.ts). The
 * patch must land on r186's chunk, keep three's taps, take its derivatives before the frustum branch, and leave the tent
 * (E138) able to install over it on a later level.
 */
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { installPlaneBiasShadowFilter, installShadowFilter, planeBiasShadowFilterOn, tentShadowFilterOn } from '../src/engine/world/shadowFilter';

/** the 2D PCF getShadow's source (the first `sampler2DShadow` getShadow up to its return) */
function pcfGetShadow(chunk: string): string {
  const start = chunk.indexOf('float getShadow( sampler2DShadow shadowMap');
  const end = chunk.indexOf('return mix( 1.0, shadow, shadowIntensity );', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return chunk.slice(start, end);
}

describe('receiver-plane shadow bias', () => {
  const stock = THREE.ShaderChunk.shadowmap_pars_fragment;

  test('patches three r186 PCF: five biased Vogel taps, derivatives before the frustum branch', () => {
    expect(planeBiasShadowFilterOn()).toBe(false);
    expect(installPlaneBiasShadowFilter()).toBe(true);
    expect(planeBiasShadowFilterOn()).toBe(true);
    const body = pcfGetShadow(THREE.ShaderChunk.shadowmap_pars_fragment);
    expect(body.indexOf('dFdx( shadowCoord.xyz )')).toBeGreaterThan(body.indexOf('shadowCoord.z += shadowBias;'));
    expect(body.indexOf('dFdx( shadowCoord.xyz )')).toBeLessThan(body.indexOf('if ( frustumTest )'));
    expect(body.match(/RPB_TAP\( [0-4] \)/g)).toHaveLength(5);
    expect(body).toContain('min( 0.0, dot( vogelDiskSample( k, 5, phi ) * radius, rpbSlope ) )'); // only toward the light
    expect(body).toContain('interleavedGradientNoise( gl_FragCoord.xy ) * PI2'); // three's own rotation, untouched
    expect(body).not.toContain('vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) )'); // no unbiased tap left
    // every other filter (VSM, the basic one, the point shadows) is three's
    const rest = (c: string): string => c.slice(c.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )'));
    expect(rest(THREE.ShaderChunk.shadowmap_pars_fragment)).toBe(rest(stock));
  });

  test('installs once: a later level\'s sky leaves the chunk as it is', () => {
    const once = THREE.ShaderChunk.shadowmap_pars_fragment;
    expect(installPlaneBiasShadowFilter()).toBe(true);
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(once);
  });

  test('the tent still installs over it (a tent shard visited after a plain one)', () => {
    expect(installShadowFilter()).toBe(THREE.PCFShadowMap);
    expect(tentShadowFilterOn()).toBe(true);
    expect(planeBiasShadowFilterOn()).toBe(false);
    const body = pcfGetShadow(THREE.ShaderChunk.shadowmap_pars_fragment);
    expect(body).toContain('TENT_TAP');
    expect(body).not.toContain('RPB_TAP');
    const tented = THREE.ShaderChunk.shadowmap_pars_fragment;
    installShadowFilter(); // and a second tent level does not touch it again
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(tented);
    THREE.ShaderChunk.shadowmap_pars_fragment = stock;
  });
});
