import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../../app/scope';
import { realGc } from '../../test/realGc';
import { EngineNodesHandler } from '../nodes/engineNodesHandler';
import { compileGraph } from './compile';
import type { GraphIr } from '@wildshard/format/materialGraph';

const graph: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {
  colour: { op: 'sunColour' }, shadow: { op: 'sunShadow' },
  shaded: { op: 'mul', in: ['colour', 'shadow'] },
  sun: { op: 'mul', in: ['shaded', 0.731] },
}, stages: { surface: { colour: [0.6, 0.4, 0.2] }, lighting: { sun: 'sun' } } };

function program(material: THREE.Material): { vertex: string; fragment: string; key: string } {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    info: { render: { frame: 0 } }, debug: { checkShaderErrors: true, diagnostics: { keywords: false } },
    properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(), geometry = new THREE.PlaneGeometry(1, 1);
  handler.setRenderer(renderer);
  const object = new THREE.Mesh(geometry, material), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const light = new THREE.DirectionalLight(); scene.add(object, light, light.target);
  handler.renderStart(scene, camera); handler.updateLights([light]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try {
    handler.setObject(object, material);
    const key = material.customProgramCacheKey(); handler.build(material, object, parameters);
    return { key, vertex: parameters.vertexShader, fragment: parameters.fragmentShader };
  } finally { handler.renderEnd(); geometry.dispose(); }
}

function retiredCompile(): { ref: WeakRef<Scope>; shader: ReturnType<typeof program> } {
  const scope = new Scope('retired material resolver'), texture = new THREE.Texture();
  const material = compileGraph(graph, { textures: () => {
    if (scope.disposed) throw new Error('Retired resolver called'); return texture;
  } }).material;
  try { return { ref: new WeakRef(scope), shader: program(material) }; }
  finally { material.dispose(); texture.dispose(); scope.dispose(); }
}

test('the shared sun layout releases the first compiler environment and still builds the same shader', async () => {
  await realGc('src/engine/render/graph/sun-layout-lifetime.test.ts', 'the shared sun layout releases the first compiler environment and still builds the same shader', async collect => {
    vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
    try {
      const first = retiredCompile();
      const next = compileGraph(graph).material;
      try {
        const shader = program(next);
        expect(shader.vertex).toBe(first.shader.vertex);
        expect(shader.fragment).toBe(first.shader.fragment);
        await collect(first.ref);
      } finally { next.dispose(); }
    } finally { vi.unstubAllGlobals(); }
  });
});
