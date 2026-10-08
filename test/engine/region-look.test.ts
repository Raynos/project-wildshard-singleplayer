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

  it('reads positions in the region\'s own frame inside its chunks only (fragment stage), the page lines unshifted', () => {
    const lookFrame = {
      fog: { order: 300, install: () => {
        THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n  varying vec3 vFogWorldPos;\n  #include <frame_probe>\n#endif';
        THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n  float edge = max( abs( vFogWorldPos.x ), abs( cameraPosition.z ) );\n#endif';
      } },
    };
    Reflect.set(THREE.ShaderChunk, 'frame_probe', 'float pageProbe() { return cameraPosition.x; }');
    try {
      const chunks = captureLookChunks('test-frame', lookFrame);
      if (chunks === null) throw new Error('no capture');
      const origin = { value: new THREE.Vector3(555, 0, 0) };
      const shader = {
        vertexShader: '#include <fog_pars_vertex>\nvoid main() {\n#include <fog_vertex>\n}',
        fragmentShader: '#version 300 es\n#include <fog_pars_fragment>\nvoid main() {\nvec3 page = cameraPosition;\n#include <fog_fragment>\n}',
        uniforms: {} as Record<string, THREE.IUniform>,
      };
      applyLookChunks(shader, chunks, origin);
      const f = shader.fragmentShader;
      expect(f.startsWith('#version 300 es\nuniform highp vec3 wsLookOrigin;\n')).toBe(true);
      expect(shader.uniforms['wsLookOrigin']).toBe(origin);
      // the declaration keeps its own name, then the shift resumes for the region's lines
      expect(f).toMatch(/#undef vFogWorldPos\nvarying vec3 vFogWorldPos;\n#define cameraPosition/u);
      // the page chunk inside the region's text, and the material's own line, read the page frame
      expect(f).toMatch(/#undef cameraPosition\n#undef vFogWorldPos\n {2}#include <frame_probe>\n#define cameraPosition/u);
      const pageLine = f.indexOf('vec3 page = cameraPosition;'), lastUndef = f.lastIndexOf('#undef cameraPosition', pageLine), lastDefine = f.lastIndexOf('#define cameraPosition', pageLine);
      expect(lastUndef).toBeGreaterThan(lastDefine);
      expect(f.match(/#define vFogWorldPos \( vFogWorldPos - wsLookOrigin \)/gu)?.length).toBe(4); // each region chunk, after its declaration, after the page include
      // the vertex stage is never shifted
      expect(shader.vertexShader).not.toContain('wsLookOrigin');
    } finally { Reflect.deleteProperty(THREE.ShaderChunk, 'frame_probe'); }
  });

  it('builds the sky dressing in the sandbox and runs its per-frame parts only through frame(), until the scope ends', () => {
    const cloud = new THREE.Texture(), field = { value: null as THREE.Texture | null };
    let drift = 0, frames = 0;
    const page = THREE.ShaderChunk.lights_fragment_begin;
    const parts = {
      fog: { order: 300, install: () => { THREE.ShaderChunk.fog_fragment = '#ifdef USE_FOG\n// dressing fog\n#endif'; } },
      sky: { clouds: false, planet: false,
        build: (_sky: unknown, tex: THREE.Texture) => { field.value = tex; THREE.ShaderChunk.lights_fragment_begin += '\n// cloud shadow hook'; },
        update: (dt: number) => { drift += dt; } },
      frame: () => { frames++; },
    };
    const host = { sky: {} as Parameters<NonNullable<typeof parts.sky.build>>[0], cloudField: () => cloud };
    const chunks = captureLookChunks('test-dressing', parts, host as Parameters<typeof captureLookChunks>[2]);
    expect(chunks?.chunks['lights_fragment_begin']).toContain('// cloud shadow hook');
    expect(THREE.ShaderChunk.lights_fragment_begin).toBe(page); // the page's sun loop is put back
    expect(field.value).toBe(cloud); // the dressing's own uniform keeps its value
    if (chunks === null) throw new Error('no capture');
    const root = new THREE.Group(), scope = new Scope('region');
    root.position.set(555, 0, -20);
    const scoped = scopeLookChunks(root, chunks, scope, {}, parts);
    expect(drift).toBe(0);
    scoped.sweep();
    expect(scoped.origin.toArray()).toEqual([555, 0, -20]);
    scoped.frame(0.5, 1); scoped.frame(0.25, 1.25);
    expect(drift).toBe(0.75); expect(frames).toBe(2);
    scope.dispose();
    scoped.frame(1, 2);
    expect(drift).toBe(0.75); expect(frames).toBe(2);
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
