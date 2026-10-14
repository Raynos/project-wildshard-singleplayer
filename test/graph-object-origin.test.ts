import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(compiled: ReturnType<typeof compileGraph>, instanced: boolean): THREE.WebGLProgramParametersWithUniforms {
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
  const beforeAttributes = Object.keys(geometry.attributes);
  const object = instanced ? new THREE.InstancedMesh(geometry, material, 2) : new THREE.Mesh(geometry, material);
  if (object instanceof THREE.InstancedMesh) {
    object.setMatrixAt(0, new THREE.Matrix4().makeRotationY(0.7).setPosition(3, 2, -4)); object.instanceMatrix.needsUpdate = true;
  }
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.fog = new THREE.Fog(0xaaaaaa, 1, 100);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(object, sun); handler.renderStart(scene, camera); handler.updateLights([sun]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try {
    handler.build(material, object, parameters);
    expect(Object.keys(geometry.attributes)).toEqual(beforeAttributes);
    return parameters;
  }
  finally { geometry.dispose(); handler.renderEnd(); }
}

test('object origins read the live placement attribute without a stale companion buffer', () => {
  const compiled = compileGraph({ version: 1, kind: 'material', model: 'unlit',
    nodes: { origin: { op: 'objectOrigin' }, carried: { op: 'varying', in: ['origin'] } }, stages: { surface: { colour: 'carried' } }, effectState: { fog: false } });
  try {
    const placed = program(compiled, true), ordinary = program(compiled, false);
    expect(placed.vertexShader).toContain('instanceMatrix *');
    expect(placed.vertexShader).toMatch(/out vec3 nodeVarying/u);
    expect(placed.fragmentShader).toMatch(/in vec3 nodeVarying/u);
    expect(placed.fragmentShader).not.toContain('instanceMatrix');
    expect(ordinary.vertexShader).not.toContain('instanceMatrix');
  } finally { compiled.material.dispose(); }
});
