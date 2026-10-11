import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { installScopeEnvironment, scopeEnvironment } from '../src/engine/app/scopeEnvironment';
import { runPrecompile } from '../src/engine/render/precompile';

afterEach(() => { vi.restoreAllMocks(); });

it.each([false, true])('retains drawn program and uniform bindings while a future variant links, including a thrown compile: %s', async (fails) => {
  const prior = scopeEnvironment();
  installScopeEnvironment({ targetKind: () => 'other', frame: paint => { queueMicrotask(() => { paint(0); }); return 0; }, cancelFrame: () => undefined });
  vi.spyOn(performance, 'now').mockReturnValue(0);
  let paints = 0, resolved = 0;
  const liveProgram = { isReady: () => true, getUniforms: () => ({ seq: [] }) };
  const futureProgram = { isReady: () => paints >= 2, getUniforms: () => {
    if (paints < 2) throw new Error('Unfinished future program reached a draw');
    resolved++;
    return { seq: [] };
  } };
  const liveLights = [new THREE.PointLight()], futureLights = [new THREE.PointLight(), new THREE.PointLight()];
  const uniforms = { pointLights: { value: liveLights } }, programs = new Map([['live', liveProgram]]);
  const selected = { currentProgram: liveProgram, __version: 0, uniforms, uniformsList: ['pointLights'], lightsStateVersion: 1, programs };
  const before = { ...selected };
  const material = new THREE.MeshBasicMaterial(), geometry = new THREE.PlaneGeometry(), root = new THREE.Group();
  root.add(new THREE.Mesh(geometry, material));
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Renderer prototype required');
  const issued = [liveProgram];
  const commands = { extensions: { has: () => true }, info: { programs: issued },
    properties: { get: () => selected }, getRenderTarget: () => null, setRenderTarget: () => undefined,
    compile: () => {
      programs.set('future', futureProgram); issued.push(futureProgram);
      selected.currentProgram = futureProgram;
      selected.uniforms.pointLights.value = futureLights;
      selected.uniformsList = ['future']; selected.lightsStateVersion = 2;
      Reflect.set(selected, 'numClippingPlanes', 7);
      if (fails) throw new Error('Failed future compile');
    } };
  for (const [key, value] of Object.entries(commands)) Reflect.set(renderer, key, value);
  try {
    const preparing = runPrecompile(renderer, new THREE.PerspectiveCamera(), [{ label: 'future lighting', root, target: null, rt: null }], 1,
      undefined, [], () => true, true, () => {
        paints++;
        expect(selected).toEqual(before);
        expect(selected.uniforms.pointLights.value).toBe(liveLights);
        expect(Object.hasOwn(selected, 'numClippingPlanes')).toBe(false);
        selected.currentProgram.getUniforms(); // the real draw's existing selection remains safe at every painted wait
        return Promise.resolve();
      });
    if (fails) await expect(preparing).rejects.toThrow('Failed future compile');
    else { await preparing; expect(resolved).toBe(1); expect(paints).toBeGreaterThanOrEqual(2); }
    expect(selected.currentProgram).toBe(liveProgram);
    expect(selected.uniforms).toBe(uniforms);
    expect(selected.uniforms.pointLights.value).toBe(liveLights);
    expect(selected.uniformsList).toBe(before.uniformsList);
    expect(programs.get('future')).toBe(futureProgram);
  } finally { material.dispose(); geometry.dispose(); installScopeEnvironment(prior); }
});
