import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from './compile';
import { EngineNodesHandler } from '../nodes/engineNodesHandler';

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
  if (object instanceof THREE.InstancedMesh) object.setColorAt(0, new THREE.Color(0.2, 0.4, 0.6));
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

const STOCK_TINT = /DiffuseColor = \( vec4\( vInstanceColor, 1\.0 \) \*/u;

test('a graph that reads the instance colour owns the tint: stock diffuse setup does not multiply by it again', () => {
  // NR15: Nine's facade graph tints its glazed tiles itself; the stock multiply darkened the whole rooftop dressing
  const tinted = compileGraph({ version: 1, kind: 'material', model: 'unlit',
    nodes: { t: { op: 'instanceColour' }, c: { op: 'varying', in: ['t'] } }, stages: { surface: { colour: 'c' } }, effectState: { fog: false } });
  expect(tinted.material.userData['graphInstanceColour']).toBe(true);
  expect(program(tinted, true).fragmentShader).not.toMatch(STOCK_TINT);
});

test('a graph that does not read the instance colour keeps the stock instance tint', () => {
  const plain = compileGraph({ version: 1, kind: 'material', model: 'unlit',
    nodes: { origin: { op: 'objectOrigin' }, c: { op: 'varying', in: ['origin'] } }, stages: { surface: { colour: 'c' } }, effectState: { fog: false } });
  expect(plain.material.userData['graphInstanceColour']).toBeUndefined();
  expect(program(plain, true).fragmentShader).toMatch(STOCK_TINT);
});
