// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed linear-fog data fixture.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { Scope } from '@wildshard/engine/app/scope';
import { dataLook, DATA_LOOK_DAY, sampleLook } from '@wildshard/engine/render/dataLook';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import type { SkyBackdrop, SkyBackdropContext, LookComposeContext } from '@wildshard/engine/render/look';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { legacyDouble } from './fake/FakeGame';

const source = () => parseShardfile(JSON.parse(readFileSync('test/fixtures/shardfile/look-linear.json', 'utf8')));
const compile = (material: THREE.Material) => {
  const shader = { vertexShader: '', fragmentShader: '#include <fog_fragment>', uniforms: {} as Record<string, THREE.IUniform> };
  Reflect.apply(material.onBeforeCompile.bind(material), undefined, [shader, null]);
  return shader;
};
it('keeps the template 60–180 m slope, interpolates distances and refuses mixed modes', () => {
  const shard = source(), keys = shard.look.keys;
  expect(sampleLook(keys, 0.5)).toMatchObject({ fogNear: 60, fogFar: 180, fogDensity: 0 });
  const first = keys[0]; if (first === undefined) throw new Error('Missing fixture key');
  first.fog.near = 40; first.fog.far = 140;
  expect(sampleLook(keys, 0.125)).toMatchObject({ fogNear: 50, fogFar: 160 });
  delete first.fog.near; delete first.fog.far;
  expect(() => parseShardfile(shard)).toThrow();
});
it('patches existing and future materials, follows fog distances and restores inheritance at unload', async () => {
  const scope = new Scope('linear-fog-test'), scene = new THREE.Scene(), before = Object.getOwnPropertyDescriptor(THREE.Material.prototype, 'onBeforeCompile');
  const existing = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry();
  // An existing material already captured the inherited hook when its own patch was registered.
  patchShader(existing, 'fixture.own', PATCH_ORDER.material, (shader) => { shader.uniforms['own'] = new THREE.Uniform(1); }, { scope });
  scene.add(new THREE.Mesh(geometry, existing));
  const look = dataLook({ day: DATA_LOOK_DAY, dayOverride: 0.5, keys: source().look.keys, lut: null });
  if (look.mode !== 'extend' || look.backdrop === undefined) throw new Error('Missing look ports');
  look.compose(legacyDouble<LookComposeContext>({ scope, scene, engineChain: () => [] }));
  const late = new THREE.MeshStandardMaterial(), a = compile(existing), b = compile(late);
  expect(a.uniforms['own']?.value).toBe(1);
  expect(a.fragmentShader).toContain('(length(vFogWorldPos - cameraPosition) - wsLookFogNear) / (wsLookFogFar - wsLookFogNear)');
  expect(a.fragmentShader.match(/uniform float wsLookFogNear/gu)).toHaveLength(1);
  expect(b.fragmentShader).toBe(a.fragmentShader);
  const built: SkyBackdrop = await look.backdrop(legacyDouble<SkyBackdropContext>({ sky: legacyDouble<SkyRig>({ setKeyLight: () => undefined }) }));
  const fog = new THREE.Fog(0, 1, 2), hemi = new THREE.HemisphereLight();
  let underwater = false;
  Reflect.apply(built.bind, undefined, [{ fog, hemi, fogU: { fogDistDensity: new THREE.Uniform(0), fogHeightDensity: new THREE.Uniform(0), fogSunColor: new THREE.Uniform(new THREE.Color()) }, underwater: () => underwater }]);
  expect([fog.near, fog.far]).toEqual([60, 180]);
  expect(a.uniforms['wsLookFogNear']?.value).toBe(60);
  expect(a.uniforms['wsLookFogFar']?.value).toBe(180);
  expect(a.uniforms['wsLookFogEnabled']?.value).toBe(1);
  underwater = true; built.update(0, new THREE.PerspectiveCamera());
  expect(a.uniforms['wsLookFogEnabled']?.value).toBe(0);
  scope.dispose();
  expect(Object.getOwnPropertyDescriptor(THREE.Material.prototype, 'onBeforeCompile')).toEqual(before);
  expect(compile(existing).fragmentShader).toBe('#include <fog_fragment>');
  existing.dispose(); late.dispose(); geometry.dispose();
  if (built.clouds instanceof THREE.Mesh) {
    const domeGeometry: unknown = built.clouds.geometry, material: unknown = built.clouds.material;
    if (domeGeometry instanceof THREE.BufferGeometry) domeGeometry.dispose();
    if (material instanceof THREE.Material) material.dispose();
  }
});
