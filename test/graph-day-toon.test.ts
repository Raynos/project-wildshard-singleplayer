import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import { Scope } from '../src/engine/app/scope';
import { clientMaterials } from '../src/game/shardfile/clientMaterials';
import { emptyShardfile } from '../src/sdk/author';
import { graph } from '../src/sdk/materials';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

function program(material: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const sampled = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const handler = new EngineNodesHandler();
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute([0, 0.25, 0.5, 0.75], 1));
  geometry.setAttribute('aDirection', new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0], 3));
  const object = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera); const light = new THREE.DirectionalLight(0xffffff, 1); scene.add(light); handler.updateLights([light]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); sampled.dispose(); }
}


test('the SDK toon graph and classic surfaces follow the catalogue day clock in place', async () => {
  const source = emptyShardfile({ slug: 'day-fixture', name: 'Day', author: 'Test', seed: 1, revision: 1 });
  source.look.materials['cel'] = { family: 'graph', graph: graph({ model: 'toon', surface: { colour: [0.4, 0.5, 0.6] } }) };
  source.look.materials['classic'] = { family: 'toon', colour: [1, 1, 1], vertexColours: true, faceted: true, doubleSided: true, roughness: 0.88, metalness: 0 };
  const scope = new Scope('day-toon'), renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  Reflect.set(renderer, 'getContext', () => ({}));
  Reflect.set(renderer, 'setNodesHandler', (handler: EngineNodesHandler) => { handler.setRenderer(renderer); });
  const looks = await clientMaterials(source, new Map(), renderer, scope, { graphs: true });
  try {
    const material = looks.materials.get('cel'), classic = looks.materials.get('classic');
    if (material === undefined || classic === undefined) throw new Error('Missing toon surfaces');
    const shader = program(material);
    expect(Object.values(shader.uniforms).some(u => u.value === looks.toon.uniforms.famToonFace.value)).toBe(true);
    const version = material.version, face = looks.toon.uniforms.famToonFace.value, lift = looks.toon.uniforms.famToonLift.value;
    looks.toon.set({ faceEdge: [0.2, 0.4], lift: [0.1, 0.2, 0.3] });
    looks.tick(0.5);
    expect(looks.toon.uniforms.famToonFace.value).toBe(face);
    expect(face.toArray()).toEqual([0.2, 0.4]);
    expect(lift.toArray()).toEqual([0.1, 0.2, 0.3]);
    expect(looks.toon.uniforms.famToonTime.value).toBe(0.5);
    expect(looks.materials.get('cel')).toBe(material);
    expect(material.version).toBe(version);
    expect(() => looks.toon.set({ faceEdge: [Number.NaN, 1] })).toThrow();
    expect(face.toArray()).toEqual([0.2, 0.4]);
    expect(source.look.materials['cel']).toMatchObject({ graph: { model: 'toon' } });
  } finally { scope.dispose(); }
});
