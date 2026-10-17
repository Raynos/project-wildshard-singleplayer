import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import type { GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

/** the fragment shader a graph builds drawn to the screen (an sRGB canvas), and its program key */
function onScreen(graph: GraphIr): { fragment: string; key: string } {
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
  const geometry = new THREE.PlaneGeometry(1, 1), object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try {
    handler.setObject(object, material);
    const key = material.customProgramCacheKey();
    handler.build(material, object, parameters);
    return { fragment: parameters.fragmentShader, key };
  } finally { handler.renderEnd(); geometry.dispose(); material.dispose(); }
}

const colour = (model: 'unlit' | 'standard'): GraphIr => ({ version: 1, kind: 'material', model, nodes: {}, stages: { surface: { colour: [0.6, 0.05, 0.04] } }, effectState: { fog: false } });

// G477 OE: an unlit graph stands for a raw GLSL program (a ShaderMaterial without colorspace_fragment). Drawn to the
// screen (a plain capture, the map bake) it wrote sRGB-encoded colour, paler than the program it replaced: Nine's lantern
// rim went from cinnabar to orange, Nalati's river paled on the baked map. Inside a target both stay linear.
test('an unlit graph has no output transform on screen; a lit graph keeps the classic sRGB encode', () => {
  const unlit = onScreen(colour('unlit')), lit = onScreen(colour('standard'));
  expect(unlit.fragment).not.toMatch(/sRGBTransferOETF/u);
  expect(lit.fragment).toMatch(/sRGBTransferOETF/u);
  expect(unlit.key).toContain('|out:raw');
  expect(lit.key).not.toContain('|out:raw');
});

test('a clone of an unlit graph keeps its raw output', () => {
  const material = compileGraph(colour('unlit')).material;
  try { expect(material.clone().userData['graphRawOutput']).toBe(true); } finally { material.dispose(); }
});
