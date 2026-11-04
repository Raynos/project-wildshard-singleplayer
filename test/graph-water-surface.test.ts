import { expect, test } from 'vitest';
import * as THREE from 'three';
import { compileClassicGraph } from '../src/engine/render/graph/glslMaterial';
import { syncGraphEnvironment } from '../src/engine/render/graph/glslProgram';
import { validateGraph, type GraphIr } from '../src/format/materialGraph';
import waterRows from '../src/shards/pine-hollow/data/waterLook.json' with { type: 'json' };
import { WATER_GRAPHS } from '../src/shards/pine-hollow/generators/waterGraphs';

const { looks: WATER_LOOKS } = waterRows;

test('an ambient that reads the environment owns the indirect term and a surface normal reaches the program', () => {
  const graph: GraphIr = { version: 1, kind: 'material', model: 'standard', nodes: {
    n: { op: 'normalize', in: [[0.1, 1, 0.2]] }, r: { op: 'radiance' }, e: { op: 'environmentIrradiance' }, i: { op: 'irradiance' },
    ambient: { op: 'add', in: ['r', 'e'] }, all: { op: 'add', in: ['ambient', 'i'] },
  }, stages: { surface: { colour: [0.5, 0.5, 0.5], normal: 'n' }, lighting: { sun: [0, 0, 0], sunSpecular: 1, ambient: 'all' } } };
  const compiled = compileClassicGraph(graph), material = compiled.material, program = compiled.glsl.program;
  const target = new THREE.WebGLRenderTarget(768, 1024);
  target.texture.mapping = THREE.CubeUVReflectionMapping;
  try {
    if (program === null || program.lighting === null || program.outputs.shadingNormal === null) throw new Error('Missing lit program');
    // the graph's ambient owns the environment: the stock environment specular is switched off, the ambient reads it instead
    expect(program.lighting.ownsEnvironment).toBe(true);
    expect(material.fragmentShader).toContain('#define RE_IndirectSpecular( r, i, c, gp, gn, gv, gc, mat, rl )\n');
    expect(material.fragmentShader).toContain('wsGraphAmbient( irr, radiance, iblIrradiance )');
    expect(material.fragmentShader).toContain(`normal = normalize( ( viewMatrix * vec4( ${program.outputs.shadingNormal}, 0.0 ) ).xyz );`);
    // the drawn scene's prefiltered environment reaches the program
    const scene = new THREE.Scene(); scene.environment = target.texture;
    syncGraphEnvironment(material, scene);
    expect(material.envMap).toBe(target.texture);
    expect(material.uniforms['envMap']?.value).toBe(target.texture);
  } finally { material.dispose(); target.dispose(); }
  const unlit: unknown = { version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 1, 1], normal: [0, 1, 0] } } };
  const refused = validateGraph(unlit);
  expect(refused.ok ? [] : refused.errors).toContain('stages.surface.normal: an unlit graph has no shading normal');
  const misplaced: unknown = { version: 1, kind: 'material', model: 'standard', nodes: { r: { op: 'radiance' } }, stages: { surface: { colour: 'r' } } };
  expect(validateGraph(misplaced).ok).toBe(false);
});

test("Pine's water graphs validate in their budget and build one lit, fogged, straight-alpha program", () => {
  for (const id of Object.values(WATER_LOOKS)) {
    const graph = WATER_GRAPHS[id];
    if (graph === undefined) throw new Error(`no water graph ${id}`);
    const checked = validateGraph(graph, { trustedBudget: true });
    expect(checked.ok ? [] : checked.errors).toEqual([]);
  }
  const pond = WATER_GRAPHS[WATER_LOOKS.pond];
  if (pond === undefined) throw new Error('no pond graph');
  const compiled = compileClassicGraph(pond, { trustedBudget: true }), material = compiled.material;
  try {
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    // one lit, fogged program blending straight (not premultiplied) alpha, reading the water's own vertex data
    expect([material.lights, material.fog, material.blending, material.premultipliedAlpha]).toEqual([true, true, THREE.NormalBlending, false]);
    expect(material.fragmentShader).toContain('#include <fog_fragment>');
    expect(compiled.glsl.attributes.map(a => a.name)).toContain('aWater');
    compiled.setParam('rain', 0.7); compiled.setParam('topDown', 1); compiled.setParam('skyC', [10, -20, 3, 1]);
    // the skyline is sampled only in the lighting stage: the lend reaches that program's sampler
    const skyline = new THREE.DataTexture(new Uint8Array([10, 20, 30, 255]), 1, 1);
    expect(() => { compiled.setTexture('skyline', skyline); }).not.toThrow();
    expect(material.uniforms['wsT_skyline']?.value).toBe(skyline);
    skyline.dispose();
  } finally { material.dispose(); }
});
