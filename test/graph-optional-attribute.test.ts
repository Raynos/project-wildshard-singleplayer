import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { attribute, vec3 } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { bindGraphAttributeDefaults, copyGraphAttributeDefaults, prepareGraphAttributeDefaults } from '../src/engine/render/nodes/graphAttributes';
import { graph } from '../src/sdk/materials';
import { validateGraph } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

test('optional attributes share one shader across present/missing channels and restore constants on cached draws', () => {
  const ir = graph({ model: 'unlit', attributeDefaults: { aSway: [0, 0] },
    vertex: { offset: vec3(attribute('aSway', 'vec2'), 0), shadow: true }, surface: { colour: vec3(1) } });
  const compiled = compileGraph(ir), clone = compiled.material.clone(), empty = new THREE.PlaneGeometry(), present = empty.clone();
  present.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(present.getAttribute('position').count * 2).fill(0.5), 2));
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  handler.renderStart(new THREE.Scene(), new THREE.PerspectiveCamera(60)); handler.updateLights([]);
  const warnings = vi.spyOn(console, 'warn'), shaders: string[] = [];
  try {
    for (const geometry of [empty, present, empty]) {
      const object = new THREE.Mesh(geometry, clone);
      handler.setObject(object, clone);
      const parameters: object = {};
      const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
      if (!isParameters(parameters)) throw new Error('Missing parameters');
      handler.build(clone, object, parameters); shaders.push(parameters.vertexShader);
    }
    expect(shaders[0]).toContain('in vec2 aSway;');
    expect(new Set(shaders).size).toBe(1);
    expect(warnings.mock.calls.some(args => args.some(value => String(value).includes('aSway')))).toBe(false);
    expect(empty.hasAttribute('aSway')).toBe(false);
    expect(Reflect.get(clone, 'defaultAttributeValues')).toEqual({ aSway: [0, 0] });
    const depth = compiled.material.clone(); copyGraphAttributeDefaults(clone, depth); prepareGraphAttributeDefaults(depth);
    expect(Reflect.get(depth, 'defaultAttributeValues')).toEqual({ aSway: [0, 0] });
    const set = vi.fn(), gl = { vertexAttrib4fv: set }, program = { getAttributes: () => ({ aSway: { location: 3 } }) };
    const object = new THREE.Mesh(empty, clone);
    bindGraphAttributeDefaults(clone, object, program, gl);
    bindGraphAttributeDefaults(clone, new THREE.Mesh(present, clone), program, gl);
    set(3, [0.5, 0.5, 0, 1]); // another program changes context state; returning to the cached VAO must reset it.
    bindGraphAttributeDefaults(depth, object, program, gl);
    expect(set.mock.calls).toEqual([[3, [0, 0, 0, 1]], [3, [0.5, 0.5, 0, 1]], [3, [0, 0, 0, 1]]]);
    depth.dispose();
    expect(validateGraph({ ...ir, nodes: { sway: { op: 'attribute', name: 'aSway', type: 'vec2', default: 0 } },
      stages: { surface: { colour: 'sway' } } }).ok).toBe(false);
    expect(() => graph({ attributeDefaults: { aSway: [0, Infinity] }, surface: { colour: vec3(attribute('aSway', 'vec2'), 0) } })).toThrow();
  } finally { warnings.mockRestore(); handler.renderEnd(); empty.dispose(); present.dispose(); clone.dispose(); compiled.material.dispose(); }
});
