import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';
import template from '../src/shards/_template/shard.config';
import { parseShardfile } from '../src/format/shardSchema';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

/** A point sprite: top-origin point coordinates, runtime diameter, straight RGB. */
const spark: GraphIr = {
  version: 1, kind: 'material', model: 'unlit', primitive: 'points',
  effectState: { blend: 'additive', fog: false, depthWrite: false },
  params: { diameter: { type: 'float', value: 12, min: 1, max: 2048 } },
  nodes: { size: { op: 'param', param: 'diameter' }, coord: { op: 'pointCoord' }, colour: { op: 'combine', in: ['coord', 0.5] } },
  stages: { points: { size: 'size' }, surface: { colour: 'colour', alpha: 0.5 } },
};
const plain: GraphIr = { version: 1, kind: 'material', nodes: {}, stages: { surface: { colour: [0.3, 0.4, 0.5] } } };

/** Compile the actual classic-renderer GLSL without a GPU/context. */
function program(graph: GraphIr, points = false): THREE.WebGLProgramParametersWithUniforms {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(), material = compileGraph(graph).material;
  handler.setRenderer(renderer);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const object = points ? new THREE.Points(geometry, material) : new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  scene.add(object); handler.renderStart(scene, camera); handler.updateLights([]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  try { handler.build(material, object, parameters); return parameters; }
  finally { geometry.dispose(); material.dispose(); }
}

describe('SF59 optional effect state', () => {
  it('keeps absent render state and admitted graph bytes unchanged', () => {
    const result = validateGraph(plain);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.graph).toEqual(plain);
    const old = compileGraph(plain).material, explicit = compileGraph({ ...plain, effectState: {} }).material;
    for (const material of [old, explicit]) {
      expect(material.fog).toBe(true); expect(material.depthWrite).toBe(true);
      expect(material.transparent).toBe(false); expect(material.blending).toBe(THREE.NormalBlending);
      expect(material.polygonOffset).toBe(false); expect(material.geometryNode).toBeNull();
      material.dispose();
    }
    expect(program(plain).vertexShader).toEqual(program({ ...plain, effectState: {} }).vertexShader);
    expect(program(plain).fragmentShader).toEqual(program({ ...plain, effectState: {} }).fragmentShader);
  });

  it.each(['alpha', 'additive', 'premultiplied'] as const)('applies only explicit %s effect state', (blend) => {
    const graph: GraphIr = { ...plain, effectState: { blend, fog: false, depthWrite: false, depthBias: { factor: -1, units: -2 } } };
    const material = compileGraph(graph).material;
    expect(material.fog).toBe(false); expect(material.depthWrite).toBe(false); expect(material.depthTest).toBe(true);
    expect(material.transparent).toBe(true); expect(material.polygonOffset).toBe(true);
    expect([material.polygonOffsetFactor, material.polygonOffsetUnits]).toEqual([-1, -2]);
    expect(material.blending).toBe(blend === 'alpha' ? THREE.NormalBlending : blend === 'additive' ? THREE.AdditiveBlending : THREE.CustomBlending);
    if (blend === 'premultiplied') { expect(material.blendSrc).toBe(THREE.OneFactor); expect(material.blendDst).toBe(THREE.OneMinusSrcAlphaFactor); expect(material.premultipliedAlpha).toBe(false); }
    material.dispose();
  });

  it.each([
    { effectState: { fog: true } }, { effectState: { blend: 'multiply' } }, { effectState: { depthWrite: 0 } },
    { effectState: { depthBias: { factor: 17, units: 0 } } }, { effectState: { depthBias: { factor: 0 } } },
    { effectState: { depthBias: { factor: 0, units: 0, hidden: 1 } } }, { effectState: { unknown: 1 } },
    { primitive: 'lines' }, { primitive: 'points' }, { stages: { surface: {}, points: { size: 3 } } },
    { kind: 'post', effectState: {}, stages: { post: { colour: [1, 1, 1] } } },
  ])('refuses malformed or inapplicable state %j', (patch) => {
    expect(validateGraph({ ...plain, ...patch }).ok).toBe(false);
  });

  it('admits effects in the template look without changing any existing material', () => {
    const authored = { ...template, look: { ...template.look, materials: { ...template.look.materials, spark: { family: 'graph', graph: spark } } } };
    const parsed = parseShardfile(authored);
    expect(parsed.look.materials['spark']).toEqual({ family: 'graph', graph: spark });
    for (const [id, value] of Object.entries(template.look.materials)) expect(parsed.look.materials[id]).toEqual(value);
  });

  it('emits an actual point diameter and point coordinates, without fog', () => {
    const result = validateGraph(spark);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.graph).toEqual(spark);
    const shader = program(spark, true);
    expect(shader.vertexShader).toContain('gl_PointSize = wildshardGraphPointSize;');
    expect(shader.vertexShader).toMatch(/wildshardGraphPointSize = clamp\(/u);
    expect(shader.fragmentShader).toContain('gl_PointCoord');
    expect(shader.fragmentShader).not.toContain('engineFog');
    expect(() => program(spark)).toThrow('Points graph requires a Points object');
    expect(validateGraph({ ...spark, stages: { ...spark.stages, points: { size: [1, 2] } } }).ok).toBe(false);
    expect(validateGraph({ ...spark, primitive: 'mesh' }).ok).toBe(false);
    expect(validateGraph({ ...spark, stages: { ...spark.stages, points: { size: 'coord' } } }).ok).toBe(false);
  });

  it('uses the camera and inverse model matrix for a world-sized view billboard', () => {
    const graph: GraphIr = { ...plain, model: 'unlit', nodes: { facing: { op: 'viewBillboard' }, local: { op: 'positionLocal' }, offset: { op: 'sub', in: ['facing', 'local'] } }, stages: { ...plain.stages, 'vertex.offset': { offset: 'offset' } } };
    const shader = program(graph);
    expect(shader.vertexShader).toContain('cameraWorldMatrix');
    expect(shader.vertexShader).toMatch(/nodeUniform\d+ \* vec4\(/u);
    expect(validateGraph({ ...graph, stages: { surface: { colour: 'facing' } } }).ok).toBe(false);
  });
});
