import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';
import type { GraphIr } from '../src/format/materialGraph';
import { instanceAttributeShader, nodeInstanceKey } from '../src/engine/render/nodes/nodeInstancing';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });
function program(compiled: ReturnType<typeof compileGraph>, object: THREE.BatchedMesh): THREE.WebGLProgramParametersWithUniforms {
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
  const geometry = object.geometry;
  const attributes = Object.keys(geometry.attributes);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.fog = new THREE.Fog(0xaaaaaa, 1, 100);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(object, sun); handler.renderStart(scene, camera); handler.updateLights([sun]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); expect(Object.keys(geometry.attributes)).toEqual(attributes); return parameters; }
  finally { handler.renderEnd(); }
}

test('existing batches share graph placement with live renderer-owned textures and draw-ID fallback', () => {
  const ir: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {
    origin: { op: 'objectOrigin' }, carried: { op: 'varying', in: ['origin'] },
  }, stages: { 'vertex.offset': { offset: [0, 0.25, 0], shadow: true }, surface: { colour: 'carried', alpha: 0.75, alphaCutoff: 0.5 } } };
  const compiled = compileGraph(ir), material = compiled.material;
  const a = new THREE.BatchedMesh(2, 24, 36, material), b = new THREE.BatchedMesh(2, 24, 36, material);
  const box = new THREE.BoxGeometry();
  const ai = a.addInstance(a.addGeometry(box)), bi = b.addInstance(b.addGeometry(box));
  a.setColorAt(ai, new THREE.Color(0xff0000)); b.setColorAt(bi, new THREE.Color(0x00ff00));
  try {
    const first = program(compiled, a), second = program(compiled, b);
    expect(first.vertexShader).toContain('getBatchingMatrix( getIndirectIndex( gl_DrawID ) )');
    expect(first.vertexShader).toContain('getBatchingColor( getIndirectIndex( gl_DrawID ) )');
    expect(first.vertexShader).toContain('#define gl_DrawID _gl_DrawID');
    expect(first.fragmentShader).toContain('vBatchColor');
    expect(second.vertexShader).toContain('getBatchingMatrix( getIndirectIndex( gl_DrawID ) )');
    expect(nodeInstanceKey(a)).toBe(nodeInstanceKey(b));
    // Updating placement writes the existing texture, without a graph buffer or rebuild.
    const texture: unknown = Reflect.get(a, '_matricesTexture');
    if (!(texture instanceof THREE.Texture)) throw new Error('Missing batch matrix texture');
    const version = texture.version;
    a.setMatrixAt(ai, new THREE.Matrix4().makeTranslation(3, 2, 1));
    expect(texture.version).toBeGreaterThan(version);
    expect(Reflect.get(a, '_matricesTexture')).not.toBe(Reflect.get(b, '_matricesTexture'));
    const prologue = instanceAttributeShader('#extension GL_ANGLE_multi_draw : require\nvoid main() {}', a, true);
    expect(prologue.match(/#extension GL_ANGLE_multi_draw/gu)).toHaveLength(1);
    expect(prologue.indexOf('#extension')).toBeLessThan(prologue.indexOf('uniform highp sampler2D'));
    expect(first.vertexShader.lastIndexOf('#extension')).toBeLessThan(first.vertexShader.indexOf('uniform highp sampler2D'));
    expect(Reflect.get(material.userData, 'graphShadowDepth')).toBe(true);
  } finally { a.dispose(); b.dispose(); box.dispose(); material.dispose(); }
});
