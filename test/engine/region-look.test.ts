import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { applyLookChunks, captureLookChunks, lookChunksFor, scopeLookChunks } from '../../src/engine/render/regionLook';
import { addFogUniforms, attachFogUniforms } from '../../src/engine/world/Atmosphere';
import { bindLevelSelection, boundLevelLook } from '../../src/engine/level/selection';
import type { LevelSpec } from '../../src/engine/level/spec';
import type { GrassDriver } from '../../src/engine/render/look';

// SF63: a grid region's light model and fog compile on its own materials; the page's chunks never change
const toon = { uToonLift: { value: new THREE.Color(0.1, 0, 0.2) } };
const fogExtra = { uRampStart: { value: 180 } };
const lit = new Set<string>();
const look = (id: string) => ({
  lighting: { install: () => {
    if (lit.has(id)) return; lit.add(id); // a look's install guards itself to run once a page
    THREE.ShaderChunk.lights_physical_pars_fragment += '\nuniform vec3 uToonLift; // toon';
  } },
  fog: { order: 200, install: () => {
    THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG\n  gl_FragColor.rgb *= 0.5; // ${id} ramp\n#endif`;
    THREE.ShaderChunk.fog_pars_fragment += '\nuniform float uRampStart; uniform vec3 uToonLift;';
    addFogUniforms(toon); addFogUniforms(fogExtra);
  } },
});

describe('region look (SF63)', () => {
  it('captures what the installs changed and puts the page chunks and fog uniforms back exactly', () => {
    const page = { lights: THREE.ShaderChunk.lights_physical_pars_fragment, fog: THREE.ShaderChunk.fog_fragment, pars: THREE.ShaderChunk.fog_pars_fragment };
    const chunks = captureLookChunks('test-a', look('a'));
    expect(chunks).not.toBeNull();
    expect(Object.keys(chunks?.chunks ?? {}).sort()).toEqual(['fog_fragment', 'fog_pars_fragment', 'lights_physical_pars_fragment']);
    expect(chunks?.uniforms).toEqual([toon, fogExtra]);
    expect(THREE.ShaderChunk.lights_physical_pars_fragment).toBe(page.lights);
    expect(THREE.ShaderChunk.fog_fragment).toBe(page.fog);
    expect(THREE.ShaderChunk.fog_pars_fragment).toBe(page.pars);
    const shader = { uniforms: {} as Record<string, THREE.IUniform> };
    attachFogUniforms(shader);
    expect(shader.uniforms['uRampStart']).toBeUndefined(); // never left on the page's list
    // cached per level: a second region of the same level gets the same capture though the installs guard themselves
    expect(captureLookChunks('test-a', look('a'))).toBe(chunks);
  });

  it('patches only materials that read an overridden chunk, under a region-keyed program', () => {
    const chunks = captureLookChunks('test-b', look('b'));
    if (chunks === null) throw new Error('no capture');
    const root = new THREE.Group(), scope = new Scope('region');
    const standard = new THREE.MeshStandardMaterial(), basicNoFog = new THREE.MeshBasicMaterial({ fog: false }), basic = new THREE.MeshBasicMaterial();
    const shared = new THREE.MeshStandardMaterial();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), standard), new THREE.Mesh(new THREE.BoxGeometry(), basicNoFog), new THREE.Mesh(new THREE.BoxGeometry(), [basic, shared]));
    expect(lookChunksFor(standard, chunks).has('lights_physical_pars_fragment')).toBe(true);
    expect(lookChunksFor(basicNoFog, chunks).size).toBe(0);
    const keyBefore = standard.customProgramCacheKey();
    const scoped = scopeLookChunks(root, chunks, scope, { isShared: (m) => m === shared });
    expect(scoped.sweep()).toBe(2); // standard + fogged basic; not the fog-less basic, not the shared one
    expect(scoped.sweep()).toBe(0);
    expect(standard.customProgramCacheKey()).toMatch(/\|look:test-b$/u);
    expect(standard.customProgramCacheKey()).not.toBe(keyBefore);
    expect(shared.customProgramCacheKey()).toBe(keyBefore);
    // a material added later is patched by the next sweep
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial()));
    expect(scoped.sweep()).toBe(1);
    scope.dispose();
    expect(standard.customProgramCacheKey()).toBe(keyBefore);
  });

  it('inlines the region text (nested includes too) and keeps one declaration of a uniform a material owned itself', () => {
    const chunks = captureLookChunks('test-c', look('c'));
    if (chunks === null) throw new Error('no capture');
    const shader = {
      vertexShader: 'void main() {}',
      fragmentShader: '#include <fog_pars_fragment>\n#include <lights_physical_pars_fragment>\nuniform vec3 uToonLift;\nvoid main() {\n#include <fog_fragment>\n}',
      uniforms: {} as Record<string, THREE.IUniform>,
    };
    applyLookChunks(shader, chunks);
    expect(shader.fragmentShader).toContain('// c ramp');
    expect(shader.fragmentShader).not.toContain('#include <fog_fragment>');
    expect(shader.fragmentShader.match(/uniform vec3 uToonLift;/g)?.length).toBe(1);
    expect(shader.uniforms['uRampStart']).toBe(fogExtra.uRampStart);
  });

  it('binds a frame level\'s own look parts (its grass driver) and nothing outside a frame', () => {
    const grass: GrassDriver = { build: () => ({ group: new THREE.Group(), update: () => undefined }) };
    expect(boundLevelLook()).toBeUndefined();
    const level = { id: 'region' } as Pick<LevelSpec, 'id'>;
    const leave = bindLevelSelection(level as LevelSpec, { grass });
    expect(boundLevelLook()?.grass).toBe(grass);
    const inner = bindLevelSelection(level as LevelSpec);
    expect(boundLevelLook()).toBeNull();
    inner(); leave();
    expect(boundLevelLook()).toBeUndefined();
  });
});
