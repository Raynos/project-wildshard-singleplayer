import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { length, mix, reference, smoothstep, vec4 } from 'three/tsl';
import { Scope } from '../src/engine/app/scope';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { FogPatchRegistry, installFogPatch, materialNodeFogOf, type NodeFogPatch } from '../src/engine/render/fogPatches';
import { noLookChunks, scopeLookChunks } from '../src/engine/render/regionLook';
import { installAtmosphere } from '../src/engine/world/Atmosphere';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(graph: GraphIr, fog: THREE.Fog, region?: NodeFogPatch): THREE.WebGLProgramParametersWithUniforms {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const sampled = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const handler = new EngineNodesHandler(), material = compileGraph(graph, { textures: () => sampled }).material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.fog = fog; scene.add(object);
  const scope = new Scope('fog-region');
  if (region !== undefined) {
    const root = new THREE.Group(); root.position.set(40, 0, 60); root.add(object); scene.add(root);
    const scoped = scopeLookChunks(root, noLookChunks('fog-region'), scope, {}, { fog: { order: 300, install: () => { throw new Error('Sweep must not repeat the classic install'); }, node: region } });
    expect(scoped.sweep()).toBe(1);
    expect(materialNodeFogOf(material)?.node).toBe(region);
  } handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { scope.dispose(); expect(materialNodeFogOf(material)).toBeUndefined(); geometry.dispose(); material.dispose(); sampled.dispose(); }
}


test('node fog follows the ordered page or scoped region replacement without changing classic chunks', () => {
  const chunks = { ...THREE.ShaderChunk };
  try {
    installAtmosphere();
    const classic = THREE.ShaderChunk.fog_fragment;
    const tint = { value: new THREE.Color(0.2, 0.4, 0.6) }, near = { value: 20 }, far = { value: 120 };
    let pageCalls = 0, regionCalls = 0;
    const page: NodeFogPatch = (out, ctx) => {
      pageCalls++;
      const amount = smoothstep(reference('value', 'float', near), reference('value', 'float', far), length(ctx.position.sub(ctx.camera)));
      return vec4(mix(out.rgb, reference('value', 'color', tint), amount), out.a);
    };
    const region: NodeFogPatch = (out, ctx) => {
      regionCalls++;
      return vec4(mix(out.rgb, ctx.engine.rgb, smoothstep(0, 100, length(ctx.position.sub(ctx.camera)))), out.a);
    };
    let classicInstalls = 0;
    installFogPatch('test.distance', 300, () => { classicInstalls++; }, 'test.distance', page);
    const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } };
    const fog = new THREE.Fog(0x123456, 1, 100);
    const shader = program(graph, fog);
    expect(pageCalls).toBeGreaterThan(0);
    expect(Object.values(shader.uniforms).some(u => u.value === tint.value)).toBe(true);
    tint.value.setRGB(0.6, 0.4, 0.2);
    expect(Object.values(shader.uniforms).some(u => u.value === tint.value)).toBe(true);
    expect(shader.fragmentShader).toContain('smoothstep(');
    const beforeRegion = pageCalls;
    const scopedShader = program(graph, fog, region);
    expect(Object.values(scopedShader.uniforms).some(u => u.value instanceof THREE.Vector3 && u.value.x === 40 && u.value.z === 60)).toBe(true);
    expect(regionCalls).toBeGreaterThan(0);
    expect(pageCalls).toBe(beforeRegion);
    expect(THREE.ShaderChunk.fog_fragment).toBe(classic);
    const registry = new FogPatchRegistry();
    registry.install('classic', 100, () => { classicInstalls++; });
    expect(classicInstalls).toBe(2);
    expect(registry.patches()).toEqual([{ id: 'classic', order: 100 }]);
    expect(() => registry.install('late', 50, () => { throw new Error('Must not run'); }, undefined, region)).toThrow('installs after');
    expect(registry.patches()).toEqual([{ id: 'classic', order: 100 }]);
  } finally { Object.assign(THREE.ShaderChunk, chunks); }
});
