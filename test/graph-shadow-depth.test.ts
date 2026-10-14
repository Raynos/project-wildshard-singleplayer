import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { TextureNode } from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { graph as authorGraph } from '../src/sdk/materials';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

test('opted-in casters share live displacement and alpha, cache by material and restore the camera even after failure', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit',
    params: { bend: { type: 'float', value: 0.2 }, cut: { type: 'texture', value: 'leaf', role: 'lent' } },
    nodes: { uv: { op: 'uv' }, cut: { op: 'texture', param: 'cut', in: ['uv'] },
      alpha: { op: 'swizzle', mask: 'w', in: ['cut'] }, bend: { op: 'param', param: 'bend' },
      offset: { op: 'mul', in: [[0, 1, 0], 'bend'] } },
    stages: { 'vertex.offset': { offset: 'offset', shadow: true }, surface: { colour: [0.2, 0.5, 0.1], alpha: 'alpha', alphaCutoff: 0.5 } } };
  const compiled = compileGraph(graph), map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 128]), 1, 1);
  compiled.setTexture('cut', map);
  const clone = compiled.material.clone(), geometry = new THREE.PlaneGeometry();
  const object: THREE.Mesh = new THREE.Mesh(geometry, compiled.material);
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const handler = new EngineNodesHandler(), draws: THREE.Material[] = [], shaders: THREE.WebGLProgramParametersWithUniforms[] = [];
  const stock = new THREE.MeshDepthMaterial(); stock.side = THREE.BackSide; stock.alphaTest = 0.5;
  let fail = false;
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
    renderBufferDirect: (_camera: THREE.Camera, _scene: unknown, _geometry: THREE.BufferGeometry, material: THREE.Material): void => {
      draws.push(material);
      if (fail) throw new Error('mid-build failure');
      if (material === stock) return;
      const params: object = {};
      const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
      if (!isParameters(params)) throw new Error('Missing parameters');
      handler.build(material, object, params); shaders.push(params);
    },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  handler.setRenderer(renderer);
  const main = new THREE.PerspectiveCamera(60), shadow = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 20);
  const scene = new THREE.Scene(); scene.add(object); handler.renderStart(scene, main); handler.updateLights([]);
  const drawBuffer = renderer.renderBufferDirect.bind(renderer);
  const draw = (depth: THREE.Material = stock, group: THREE.GeometryGroup | null = null): void => {
    Reflect.apply(drawBuffer, undefined, [shadow, null, geometry, depth, object, group]);
  };
  const camera = (): unknown => {
    const frame: unknown = Reflect.get(handler, 'nodeFrame');
    return typeof frame === 'object' && frame !== null ? Reflect.get(frame, 'camera') : undefined;
  };
  try {
    draw(); const depth = draws[0];
    expect(depth).not.toBe(stock); expect(depth?.side).toBe(THREE.BackSide);
    expect(depth === undefined ? null : Reflect.get(depth, 'positionNode')).toBe(compiled.material.positionNode);
    expect(depth === undefined ? null : Reflect.get(depth, 'opacityNode')).toBe(compiled.material.opacityNode);
    expect(shaders[0]?.vertexShader).toContain('positionLocal');
    expect(shaders[0]?.fragmentShader).toContain('discard');
    expect(Object.values(shaders[0]?.uniforms ?? {}).some(u => u instanceof TextureNode && u.value === map)).toBe(true);
    expect(camera()).toBe(main);
    const builder: unknown = depth === undefined ? undefined : Reflect.get(depth, '_latestBuilder');
    expect(typeof builder === 'object' && builder !== null ? Reflect.get(builder, 'camera') : null).toBe(shadow);
    compiled.setParam('bend', 0.8); draw(); expect(draws[1]).toBe(depth);
    const released = vi.fn(); depth?.addEventListener('dispose', () => { released(); });
    object.material = [new THREE.MeshBasicMaterial(), clone];
    draw(stock, { start: 0, count: 6, materialIndex: 1 }); expect(draws[2]).not.toBe(depth); expect(draws[2]).not.toBe(stock);
    fail = true; expect(() => draw(stock, { start: 0, count: 6, materialIndex: 1 })).toThrow('mid-build failure'); expect(camera()).toBe(main);
    fail = false; object.material = compiled.material; object.customDepthMaterial = stock; draw(); expect(draws.at(-1)).toBe(stock);
    object.customDepthMaterial = undefined;
    compiled.material.dispose(); expect(released).toHaveBeenCalledOnce();
    const plain = compileGraph({ ...graph, stages: { ...graph.stages, 'vertex.offset': { offset: 'offset' } } });
    object.material = plain.material; draw(); expect(draws.at(-1)).toBe(stock); plain.material.dispose();
    expect(authorGraph({ model: 'unlit', vertex: { offset: vec3(0, 1, 0), shadow: true }, surface: { colour: vec3(1) } }).stages['vertex.offset']?.shadow).toBe(true);
    expect(validateGraph({ ...graph, stages: { ...graph.stages, 'vertex.clip': { position: [0, 0, 0, 1] } } }).ok).toBe(false);
  } finally { clone.dispose(); compiled.material.dispose(); stock.dispose(); geometry.dispose(); map.dispose(); handler.renderEnd(); }
});
