import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { vec3 } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { graph as authorGraph } from '../src/sdk/materials';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(compiled: ReturnType<typeof compileGraph>): THREE.WebGLProgramParametersWithUniforms {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    shadowMap: { enabled: true, type: THREE.PCFShadowMap },
    getDrawingBufferSize: (size: THREE.Vector2): THREE.Vector2 => size.set(64, 64),
    getViewport: (view: THREE.Vector4): THREE.Vector4 => view.set(0, 0, 64, 64),
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(), material = compiled.material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material); object.receiveShadow = true;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.fog = new THREE.Fog(0xaaaaaa, 1, 100);
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true;
  const target = new THREE.WebGLRenderTarget(8, 8); target.depthTexture = new THREE.DepthTexture(8, 8); target.depthTexture.compareFunction = THREE.LessEqualCompare;
  sun.shadow.map = target;
  scene.add(object, sun); handler.renderStart(scene, camera); handler.updateLights([sun]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); target.dispose(); handler.renderEnd(); }
}

test('receiver offsets reach real shadow shaders and live uniforms without moving the caster', () => {
  const ir: GraphIr = { version: 1, kind: 'material', model: 'standard', params: { shift: { type: 'vec3', value: [0.12, 0.07, -0.03] } },
    nodes: { shift: { op: 'param', param: 'shift' } }, stages: { surface: { colour: [0.2, 0.5, 0.8] }, 'shadow.offset': { offset: 'shift' } } };
  const compiled = compileGraph(ir), plain = compileGraph({ ...ir, stages: { surface: ir.stages.surface } });
  try {
    expect(compiled.material.positionNode).toBeNull(); expect(compiled.material.receivedShadowPositionNode).not.toBeNull();
    expect(plain.material.receivedShadowPositionNode).toBeNull();
    const shader = program(compiled), version = compiled.material.version;
    expect(shader.fragmentShader).toContain('shadowPositionWorld');
    const holds = (point: THREE.Vector3): boolean => Object.values(shader.uniforms).some(u => u.value instanceof THREE.Vector3 && u.value.equals(point));
    expect(holds(new THREE.Vector3(0.12, 0.07, -0.03))).toBe(true);
    compiled.setParam('shift', [0.2, 0.1, 0.3]); expect(holds(new THREE.Vector3(0.2, 0.1, 0.3))).toBe(true);
    expect(compiled.material.version).toBe(version);
    const clone = compiled.material.clone();
    try { expect(clone.receivedShadowPositionNode).toBe(compiled.material.receivedShadowPositionNode); expect(program({ ...compiled, material: clone }).fragmentShader).toContain('shadowPositionWorld'); }
    finally { clone.dispose(); }
    expect(authorGraph({ model: 'standard', shadow: { offset: vec3(0, 0.1, 0) }, surface: { colour: vec3(1) } }).stages['shadow.offset']).toBeDefined();
    expect(validateGraph({ ...ir, model: 'unlit' }).ok).toBe(false);
    expect(validateGraph({ ...ir, kind: 'post', stages: { post: { colour: [1, 1, 1] }, 'shadow.offset': { offset: 'shift' } } }).ok).toBe(false);
  } finally { compiled.material.dispose(); plain.material.dispose(); }
});
