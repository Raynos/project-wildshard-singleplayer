import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';

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

// G478 OE2: three forces an opaque draw's alpha to 1, where the GLSL programs Nine's graphs replaced wrote near / viewZ
// (its post blends by it), so the graph lanterns took the post's full grade. `surface.targetAlpha` writes it again.
test('an opaque graph writes its surface.targetAlpha; without one the alpha stays three\'s', () => {
  const plain = onScreen(colour('unlit'));
  const targeted = onScreen({ ...colour('unlit'), nodes: { k: { op: 'const', value: 0.375 } }, stages: { surface: { colour: [0.6, 0.05, 0.04], targetAlpha: 'k' } } });
  expect(targeted.fragment).toMatch(/0\.375/u);
  expect(plain.fragment).not.toMatch(/0\.375/u);
});

test('surface.targetAlpha takes cameraNear over the view depth, and is refused on a blended graph', () => {
  const graph = (blend: boolean): unknown => ({
    version: 1, kind: 'material', model: 'unlit',
    nodes: { n: { op: 'cameraNear' }, v: { op: 'positionView' }, z: { op: 'swizzle', in: ['v'], mask: 'z' }, d: { op: 'negate', in: ['z'] }, m: { op: 'max', in: ['d', 'n'] }, a: { op: 'div', in: ['n', 'm'] } },
    stages: { surface: { colour: [1, 0, 0], targetAlpha: 'a' } },
    effectState: blend ? { fog: false, blend: 'additive' } : { fog: false },
  });
  expect(validateGraph(graph(false)).ok).toBe(true);
  const refused = validateGraph(graph(true));
  expect(refused.ok).toBe(false);
  if (!refused.ok) expect(refused.errors.join('\n')).toMatch(/targetAlpha: an opaque draw only/u);
});
