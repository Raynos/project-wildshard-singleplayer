import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { vec3 } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
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
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(), material = compiled.material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.fog = new THREE.Fog(0xaaaaaa, 1, 100);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(object, sun); handler.renderStart(scene, camera); handler.updateLights([sun]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); handler.renderEnd(); }
}


test('foliage keeps a front-face normal basis without changing two-sided draws or borrowed normal maps', () => {
  const ir: GraphIr = { version: 1, kind: 'material', model: 'standard', doubleSided: true,
    nodes: {}, stages: { surface: { colour: [0.2, 0.5, 0.1] } } };
  const classic = compileGraph(ir), foliage = compileGraph({ ...ir, flipBackfaceNormals: false });
  const normal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  try {
    expect(program(classic).fragmentShader).toContain('gl_FrontFacing');
    expect(program(foliage).fragmentShader).not.toContain('gl_FrontFacing');
    expect(foliage.material.side).toBe(THREE.DoubleSide);
    if (!(foliage.material instanceof MeshStandardNodeMaterial)) throw new Error('Missing physical material');
    foliage.material.normalMap = normal;
    const mapped = program(foliage);
    expect(mapped.fragmentShader).toContain('texture(');
    expect(mapped.fragmentShader).not.toContain('gl_FrontFacing');
    expect(foliage.material.side).toBe(THREE.DoubleSide);
    expect(foliage.material.normalMap).toBe(normal);
    const clone = foliage.material.clone();
    try {
      expect(clone.normalNode).toBe(foliage.material.normalNode);
      const copied = program({ ...foliage, material: clone });
      expect(copied.fragmentShader).toContain('texture(');
      expect(copied.fragmentShader).not.toContain('gl_FrontFacing');
      expect(clone.side).toBe(THREE.DoubleSide);
    } finally { clone.dispose(); }
    const authored = authorGraph({ doubleSided: true, flipBackfaceNormals: false, surface: { colour: vec3(1) } });
    expect(authored.flipBackfaceNormals).toBe(false);
    expect(validateGraph({ ...ir, flipBackfaceNormals: 'no' }).ok).toBe(false);
    expect(validateGraph({ version: 1, kind: 'post', flipBackfaceNormals: false, nodes: {}, stages: { post: { colour: [1, 1, 1] } } }).ok).toBe(false);
  } finally { classic.material.dispose(); foliage.material.dispose(); normal.dispose(); }
});
