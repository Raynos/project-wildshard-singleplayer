import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { ToonLook } from '../src/engine/render/families/toon';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(graph: GraphIr, toon: ToonLook): THREE.WebGLProgramParametersWithUniforms {
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
  const handler = new EngineNodesHandler(), material = compileGraph(graph, { toon, textures: () => sampled }).material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera); const light = new THREE.DirectionalLight(0xffffff, 1); scene.add(light); handler.updateLights([light]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); material.dispose(); sampled.dispose(); }
}


test('toon graph lighting borrows the family bands without authored-name collisions', () => {
  const look = new ToonLook({ faceEdge: [0.15, 0.3], shadowEdge: [0.6, 0.85] });
  const graph: GraphIr = { version: 1, kind: 'material', model: 'toon',
    params: { face: { type: 'float', value: 0.2 } }, nodes: {
      face: { op: 'param', param: 'face' }, colour: { op: 'combine', in: ['face', 0.3, 0.4] },
    }, stages: { surface: { colour: 'colour', roughness: 0.3 } } };
  const shader = program(graph, look);
  expect(shader.fragmentShader).toContain('smoothstep(');
  expect(Object.values(shader.uniforms).some(uniform => uniform.value === look.uniforms.famToonFace.value)).toBe(true);
  expect(Object.values(shader.uniforms).some(uniform => uniform.value === look.uniforms.famToonShadow.value)).toBe(true);
  const compiled = compileGraph(graph, { toon: look });
  try {
    compiled.setParam('face', 0.7);
    expect(look.uniforms.famToonFace.value.toArray()).toEqual([0.15, 0.3]);
    const clock = look.uniforms.famToonTime.value; look.tick(0.25);
    expect(look.uniforms.famToonTime.value).toBe(clock + 0.25);
    expect(validateGraph({ ...graph, stages: { ...graph.stages, lighting: { sun: [1, 1, 1] } } }).ok).toBe(false);
  } finally { compiled.material.dispose(); }
});
