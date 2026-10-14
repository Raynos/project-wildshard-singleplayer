import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { compileGraph } from '../src/engine/render/graph/compile';
import { bindGraphMeshMap, graphMeshMapBase } from '../src/engine/render/graphBackend';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(graph: GraphIr, source: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
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
  const handler = new EngineNodesHandler(), compiled = compileGraph(graph, { textures: () => sampled }), scope = new Scope('pbr-loan');
  const material = bindGraphMeshMap(compiled.material, source, scope);
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); scope.dispose(); compiled.material.dispose(); sampled.dispose(); }
}


test('mapped lit graphs retain native PBR slots and shared uniforms', () => {
  const normal = new THREE.DataTexture(), roughness = new THREE.DataTexture(), ao = new THREE.DataTexture();
  const source = new THREE.MeshStandardMaterial({ normalMap: normal, roughnessMap: roughness, aoMap: ao, normalScale: new THREE.Vector2(0.5, 0.7), aoMapIntensity: 0.6 });
  const other = new THREE.MeshStandardMaterial({ normalMap: ao });
  const graph: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {},
    stages: { surface: { colour: [0.2, 0.3, 0.4], roughness: 0.4, occlusion: 0.8 } } };
  const compiled = compileGraph(graph), scope = new Scope('map-owner');
  try {
    const mapped = bindGraphMeshMap(compiled.material, source, scope);
    expect(bindGraphMeshMap(compiled.material, source, scope)).toBe(mapped);
    expect(bindGraphMeshMap(compiled.material, other, scope)).not.toBe(mapped);
    expect(graphMeshMapBase(mapped)).toBe(compiled.material);
    expect(Reflect.get(mapped, 'normalMap')).toBe(normal);
    expect(Reflect.get(mapped, 'roughnessMap')).toBe(roughness);
    expect(Reflect.get(mapped, 'aoMap')).toBe(ao);
    const scale: unknown = Reflect.get(mapped, 'normalScale');
    expect(scale).not.toBe(source.normalScale);
    if (!(scale instanceof THREE.Vector2)) throw new Error('Missing normal scale');
    expect(scale.toArray()).toEqual([0.5, 0.7]);
    const shader = program(graph, source);
    for (const texture of [normal, roughness, ao]) expect(Object.values(shader.uniforms).some(uniform => uniform.value === texture)).toBe(true);
    expect(source.normalMap).toBe(normal);
  } finally { scope.dispose(); compiled.material.dispose(); source.dispose(); other.dispose(); normal.dispose(); roughness.dispose(); ao.dispose(); }
});
