import { afterAll, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { GraphIr } from '../src/format/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { frameNodeMaterial, type NodeLayerFrame } from '../src/engine/render/nodeLayerFrame';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

/** A camera-relative card (a sun glow's), additive: the shape a layered backdrop's node dressing takes. */
const CARD: GraphIr = { version: 1, kind: 'material', model: 'unlit', doubleSided: true,
  nodes: { vertex: { op: 'positionGeometry' }, xy: { op: 'swizzle', in: ['vertex'], mask: 'xy' }, local: { op: 'mul', in: ['xy', 40] },
    card: { op: 'cameraRelativeBillboard', in: [[0.3, 0.2, -0.93], 820, 'local'] } },
  stages: { 'vertex.position': { position: 'card' }, surface: { colour: [1, 0.8, 0.5] } },
  effectState: { blend: 'additive', depthWrite: false, fog: false } };

/** Build the classic-renderer GLSL of `graph` without a GPU, `frame` (when given) applied as `BackdropLayer.dress` does. */
function program(graph: GraphIr, frame?: NodeLayerFrame): { vertex: string; fragment: string; framed: boolean; key: string } {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(), material = compileGraph(graph).material;
  handler.setRenderer(renderer);
  const framed = frame === undefined ? false : frameNodeMaterial(material, frame);
  const geometry = new THREE.PlaneGeometry(1, 1), object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try {
    handler.build(material, object, parameters);
    return { vertex: parameters.vertexShader, fragment: parameters.fragmentShader, framed, key: material.customProgramCacheKey() };
  } finally { geometry.dispose(); material.dispose(); }
}

it('draws a graph dressing in a layer frame through material inputs, not GLSL defines', () => {
  const frame: NodeLayerFrame = { view: { value: new THREE.Matrix4() }, origin: { value: new THREE.Vector3(1200, 0, -800) }, fade: { value: 0.5 }, whole: false };
  const page = program(CARD), layered = program(CARD, frame);
  expect(layered.framed).toBe(true);
  // a classic material keeps the GLSL path
  expect(frameNodeMaterial(new THREE.MeshBasicMaterial(), frame)).toBe(false);
  for (const stage of [layered.vertex, layered.fragment]) {
    expect(stage).not.toMatch(/#define\s+(?:cameraPosition|viewMatrix)/u);
    expect(stage).not.toContain('gl_FragColor');
  }
  // the camera less the origin, the frame's view as the model-view, and one more fragment uniform (the fade)
  expect(layered.vertex).not.toBe(page.vertex);
  expect(layered.vertex).toMatch(/cameraPosition\s*-\s*nodeUniform\d+/u);
  expect(page.vertex).not.toMatch(/cameraPosition\s*-\s*nodeUniform\d+/u);
  expect(layered.fragment).not.toBe(page.fragment);
  // a framed program never shares a cached program with the page's
  expect(layered.key).not.toBe(page.key);
});
