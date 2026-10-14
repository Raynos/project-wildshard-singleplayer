import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { float } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { registerCascades } from '../src/engine/world/cascadeLights';

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
  const csm = new CSM({ parent: scene, camera, cascades: 3, maxFar: 80 });
  registerCascades({ csm, ghosts: [], fade: { value: 1 } });
  const target = new THREE.WebGLRenderTarget(8, 8); target.depthTexture = new THREE.DepthTexture(8, 8); target.depthTexture.compareFunction = THREE.LessEqualCompare;
  csm.lights.forEach((sun, i) => { sun.shadow.map = target; Reflect.set(sun.shadow, 'filterNode', () => float(0.8).toVar(`cascadeLookup${i}`)); });
  scene.add(object); handler.renderStart(scene, camera); handler.updateLights(csm.lights);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); target.dispose(); handler.renderEnd(); csm.dispose(); csm.remove(); }
}

test('each cascade shadow lookup is initialised before either receiver branch can read it', () => {
  const compiled = compileGraph({ version: 1, kind: 'material', model: 'toon', nodes: {}, stages: { surface: { colour: [1, 1, 1] } } });
  try {
    const shader = program(compiled);
    expect(shader.fragmentShader.match(/^\tcascadeLookup[0-2] = /gm)).toHaveLength(3);
  } finally { compiled.material.dispose(); }
});
