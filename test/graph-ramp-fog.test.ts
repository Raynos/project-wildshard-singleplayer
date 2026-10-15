import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { materialNodeFogOf, type NodeFogPatch } from '../src/engine/render/fogPatches';
import { noLookChunks, scopeLookChunks } from '../src/engine/render/regionLook';
import { attachFogUniforms, ColourRampFog, installAtmosphere } from '../src/engine/world/Atmosphere';
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


test('colour ramp fog borrows live level tunables without changing classic chunks', () => {
  const chunks = { ...THREE.ShaderChunk };
  try {
    installAtmosphere();
    const classic = THREE.ShaderChunk.fog_fragment;
    const ramp = { start: { value: 20 }, end: { value: 120 }, near: { value: new THREE.Color(0.3, 0.1, 0.2) }, zenith: { value: new THREE.Color(0.1, 0.2, 0.8) } };
    const patch: NodeFogPatch = { colourRamp: ramp };
    const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } };
    const shader = program(graph, new THREE.Fog(0x123456, 1, 100), patch);
    for (const colour of [ramp.near.value, ramp.zenith.value]) expect(Object.values(shader.uniforms).some(u => u.value === colour)).toBe(true);
    ramp.near.value.setRGB(0.01, 0.02, 0.03);
    expect(Object.values(shader.uniforms).some(u => u.value === ramp.near.value)).toBe(true);
    expect(shader.fragmentShader).toContain('smoothstep(');
    expect(shader.fragmentShader).toContain('pow(');
    expect(shader.fragmentShader).toContain('exp(');
    expect(THREE.ShaderChunk.fog_fragment).toBe(classic);
    ramp.start.value = 1e6; ramp.end.value = 2e6;
    const mapShader = program(graph, new THREE.Fog(0x123456, 1, 100), patch);
    expect(mapShader.fragmentShader).toBe(shader.fragmentShader);
    expect(Object.values(mapShader.uniforms).some(u => u.value === 1e6)).toBe(true);
    expect(Object.values(mapShader.uniforms).some(u => u.value === 2e6)).toBe(true);
  } finally { Object.assign(THREE.ShaderChunk, chunks); }
});

test('a ColourRampFog lends one set of uniforms to the classic chunk, the node and the map shot', () => {
  const chunks = { ...THREE.ShaderChunk };
  try {
    installAtmosphere();
    const engine = THREE.ShaderChunk.fog_fragment;
    const fog = new ColourRampFog({ start: 180, end: 1700, near: [0.5, 0.6, 0.98], zenith: [0.055, 0.2, 0.78] });
    const model = fog.model(200);
    expect(model.order).toBe(200);
    expect(model.node).toEqual({ colourRamp: fog });
    model.install();
    expect(THREE.ShaderChunk.fog_fragment).not.toBe(engine);
    for (const name of ['fogRampStart', 'fogRampEnd', 'fogRampNear', 'fogRampZenith']) {
      expect(THREE.ShaderChunk.fog_fragment).toContain(name);
      expect(THREE.ShaderChunk.fog_pars_fragment).toContain(`uniform ${name === 'fogRampNear' || name === 'fogRampZenith' ? 'vec3' : 'float'} ${name};`);
    }
    const shader = { uniforms: {} as Record<string, THREE.IUniform> };
    attachFogUniforms(shader);
    expect(shader.uniforms['fogRampNear']).toBe(fog.near);
    expect(shader.uniforms['fogRampZenith']).toBe(fog.zenith);
    fog.control.suspend();
    expect(shader.uniforms['fogRampStart']?.value).toBe(1e6);
    fog.control.resume();
    expect([fog.start.value, fog.end.value]).toEqual([180, 1700]);
  } finally { Object.assign(THREE.ShaderChunk, chunks); }
});
