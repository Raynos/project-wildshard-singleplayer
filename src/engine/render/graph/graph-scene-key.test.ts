import { afterAll, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { LightsNode } from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { EngineNodesHandler } from '../nodes/engineNodesHandler';
import { compileGraph } from './compile';
import { Scope } from '../../app/scope';
import type { GraphNode } from '@wildshard/format/materialGraph';
import { patchShader, PATCH_ORDER } from '../shaderPatches';
import { createCompileScene } from '../compileLights';

vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
afterAll(() => { vi.unstubAllGlobals(); });

function rendererFixture(): THREE.WebGLRenderer {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  return renderer;
}
function keyReader(material: THREE.Material): (scene: THREE.Scene, lights?: THREE.Light[]) => string {
  const handler = new EngineNodesHandler(); handler.setRenderer(rendererFixture());
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material), camera = new THREE.PerspectiveCamera();
  return (scene, lights = []) => {
    handler.renderStart(scene, camera); handler.updateLights(lights); handler.setObject(mesh, material);
    try { return material.customProgramCacheKey(); } finally { handler.renderEnd(); }
  };
}

test('scene-independent unlit graphs keep one key across fresh light, environment and fog identities', () => {
  const material = compileGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {},
    stages: { surface: { colour: [1, 0, 0] } }, effectState: { fog: false } }).material;
  const key = keyReader(material), first = key(new THREE.Scene());
  for (let visit = 0; visit < 5; visit++) {
    const scene = new THREE.Scene(), environment = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
    scene.fog = new THREE.Fog(0x8899aa, 1, 10); scene.environment = environment;
    expect(key(scene, [new THREE.DirectionalLight(0xffffff, 1)])).toBe(first);
    environment.dispose();
  }
  material.dispose();
});

test('builtin scene shader shapes survive replacement lights and fogs', () => {
  const graphs = [
    { version: 1, kind: 'material', model: 'standard', nodes: {}, stages: { surface: { colour: [1, 0, 0] } }, effectState: { fog: false } },
    { version: 1, kind: 'material', model: 'unlit', nodes: {}, stages: { surface: { colour: [1, 0, 0] } } },
    ...(['fogColour', 'fogZenithColour', 'skyLightColour', 'skyLightDirection'] as const).map(op => ({
      version: 1, kind: 'material', model: 'unlit', nodes: { colour: { op } },
      stages: { surface: { colour: 'colour' } }, effectState: { fog: false },
    })),
    { version: 1, kind: 'material', model: 'unlit', nodes: { colour: { op: 'loop', in: [[0, 0, 0]], count: 1,
      body: { nodes: { fog: { op: 'fogColour' } }, out: 'fog' } } },
      stages: { surface: { colour: 'colour' } }, effectState: { fog: false } },
  ] as const;
  for (const graph of graphs) {
    const material = compileGraph(graph).material, key = keyReader(material);
    const first = new THREE.Scene(), next = new THREE.Scene();
    first.fog = new THREE.Fog(0x8899aa, 1, 10); next.fog = first.fog.clone();
    expect(key(first, [new THREE.DirectionalLight()])).toBe(key(next, [new THREE.DirectionalLight()]));
    expect(key(next, [new THREE.PointLight()])).not.toBe(key(first, [new THREE.DirectionalLight()]));
    material.dispose();
  }
});

test('an explicit material environment keeps the stock scene boundary', () => {
  const material = compileGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {},
    stages: { surface: { colour: [1, 0, 0] } }, effectState: { fog: false } }).material;
  const environment = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  Reflect.set(material, 'envMap', environment);
  const key = keyReader(material), a = new THREE.Scene(), b = new THREE.Scene();
  expect(key(a, [new THREE.DirectionalLight()])).not.toBe(key(b, [new THREE.DirectionalLight()]));
  material.dispose(); environment.dispose();
});

test('explicit node environment and lighting inputs keep the stock scene boundary', () => {
  for (const [field, value] of [['envNode', vec3(1)], ['lightsNode', new LightsNode()]] as const) {
    const material = compileGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {},
      stages: { surface: { colour: [1, 0, 0] } }, effectState: { fog: false } }).material;
    Reflect.set(material, field, value);
    const key = keyReader(material), a = new THREE.Scene(), b = new THREE.Scene();
    expect(key(a, [new THREE.DirectionalLight()])).not.toBe(key(b, [new THREE.DirectionalLight()]));
    material.dispose();
  }
});

test('custom shader patches restore scene identity after an independent lookup', () => {
  const material = compileGraph({ version: 1, kind: 'material', model: 'unlit', nodes: {},
    stages: { surface: { colour: [1, 0, 0] } }, effectState: { fog: false } }).material;
  const key = keyReader(material), a = new THREE.Scene(), b = new THREE.Scene(), owner = new Scope('scene-patch');
  const lights = [new THREE.DirectionalLight()], plain = key(a, lights);
  patchShader(material, 'scene-reader', PATCH_ORDER.view, () => undefined, { scope: owner });
  const patched = key(a, lights);
  expect(patched).not.toBe(key(b, [new THREE.DirectionalLight()]));
  expect(key(a, lights)).toBe(patched);
  owner.dispose();
  expect(key(a, lights)).toBe(plain);
  material.dispose();
});


test('scene shader keys distinguish fog models and environment layouts', () => {
  const material = compileGraph({ version: 1, kind: 'material', model: 'standard', nodes: {},
    stages: { surface: { colour: [1, 1, 1] } } }).material;
  const key = keyReader(material), linear = new THREE.Scene(), exponential = new THREE.Scene();
  linear.fog = new THREE.Fog(0x123456, 1, 10);
  exponential.fog = new THREE.FogExp2(0x123456, .01);
  expect(key(linear)).not.toBe(key(exponential));
  const a = new THREE.DataTexture(new Uint8Array(16), 2, 2);
  const b = new THREE.DataTexture(new Uint8Array(64), 4, 4);
  linear.environment = a; exponential.environment = b; exponential.fog = linear.fog.clone();
  expect(key(linear)).not.toBe(key(exponential));
  material.dispose(); a.dispose(); b.dispose();
});

test('an equivalent scene refreshes the warm program uniform bindings', () => {
  const programs = new Map<string, object>();
  const properties: { programs: typeof programs; currentProgram?: object; uniforms?: Record<string, unknown>; __version?: number } = { programs };
  const renderer = rendererFixture();
  Reflect.set(renderer, 'properties', { get: () => properties, has: () => true });
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const material = compileGraph({ version: 1, kind: 'material', model: 'unlit',
    nodes: { colour: { op: 'fogColour' } }, stages: { surface: { colour: 'colour' } }, effectState: { fog: false } }).material;
  const geometry = new THREE.PlaneGeometry(), mesh = new THREE.Mesh(geometry, material), camera = new THREE.PerspectiveCamera();
  const first = new THREE.Scene(), next = new THREE.Scene();
  first.fog = new THREE.Fog(0xff0000, 1, 10); next.fog = new THREE.Fog(0x0000ff, 1, 10);
  try {
    first.add(mesh); handler.renderStart(first, camera); handler.updateLights([]); handler.setObject(mesh, material);
    const customProgramCacheKey = material.customProgramCacheKey(), input: object = { customProgramCacheKey };
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(input)) throw new Error('Missing parameters');
    handler.build(material, mesh, input);
    const program = { getUniforms: () => ({ seq: Object.keys(input.uniforms).map(id => ({ id })) }) };
    programs.set('same-native-program', program); properties.currentProgram = program; properties.__version = material.version;
    handler.onUpdateProgram(material, program, properties);
    const before = properties.uniforms;
    handler.renderEnd();
    next.add(mesh); handler.renderStart(next, camera); handler.updateLights([]); handler.setObject(mesh, material);
    expect(material.customProgramCacheKey()).toBe(customProgramCacheKey);
    material.onBeforeRender(renderer, next, camera, geometry, mesh, new THREE.Group());
    expect(properties.currentProgram).toBe(program);
    expect(properties.uniforms).not.toBe(before);
    expect(Object.values(properties.uniforms ?? {}).some(uniform => typeof uniform === 'object' && uniform !== null
      && Reflect.get(uniform, 'value') === next.fog?.color)).toBe(true);
    expect(handler.builds).toBe(2);
    expect(handler.buildLog.at(-1)?.how).toMatch(/^scene binding scene\+fog: /u);
    material.onBeforeRender(renderer, next, camera, geometry, mesh, new THREE.Group());
    expect(handler.builds).toBe(2);
    handler.renderEnd();
  } finally { material.dispose(); geometry.dispose(); }
});

test.each(['shared', 'fog', 'environment', 'lights'] as const)('an exterior compile scene keeps exact page owners and fences a %s handoff', field => {
  const programs = new Map<string, object>();
  const properties: {programs: typeof programs; currentProgram?: object; uniforms?: Record<string, unknown>; __version?: number} = {programs};
  const renderer = rendererFixture();
  Reflect.set(renderer, 'properties', {get: () => properties, has: () => true});
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const material = compileGraph({version: 1, kind: 'material', model: 'unlit',
    nodes: {colour: {op: 'fogColour'}}, stages: {surface: {colour: 'colour'}}, effectState: {fog: false}}).material;
  const geometry = new THREE.PlaneGeometry(), mesh = new THREE.Mesh(geometry, material), camera = new THREE.PerspectiveCamera();
  const page = new THREE.Scene(); page.fog = new THREE.Fog(0xff0000, 1, 10);
  const environment = new THREE.DataTexture(new Uint8Array(16), 2, 2), otherEnvironment = environment.clone();
  environment.mapping = THREE.CubeUVReflectionMapping; otherEnvironment.mapping = THREE.CubeUVReflectionMapping;
  page.environment = environment;
  const warm = createCompileScene(page); warm.fog = field === 'fog' ? page.fog.clone() : page.fog;
  warm.environment = field === 'environment' ? otherEnvironment : environment;
  const light = new THREE.DirectionalLight(), otherLight = new THREE.DirectionalLight();
  try {
    warm.add(mesh); handler.renderStart(warm, camera); handler.updateLights([field === 'lights' ? otherLight : light]); handler.setObject(mesh, material);
    const customProgramCacheKey = material.customProgramCacheKey(), input: object = {customProgramCacheKey};
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(input)) throw new Error('Missing parameters');
    handler.build(material, mesh, input);
    const program = {getUniforms: () => ({seq: Object.keys(input.uniforms).map(id => ({id}))})};
    programs.set('same-native-program', program); properties.currentProgram = program; properties.__version = material.version;
    handler.onUpdateProgram(material, program, properties);
    const before = properties.uniforms;
    handler.renderEnd();
    const draw = (scene: THREE.Scene): void => {
      scene.add(mesh); handler.renderStart(scene, camera); handler.updateLights([light]); handler.setObject(mesh, material);
      try { material.onBeforeRender(renderer, scene, camera, geometry, mesh, new THREE.Group()); }
      finally { handler.renderEnd(); }
    };
    draw(page);
    const builds = field === 'shared' ? 1 : 2;
    expect(handler.builds).toBe(builds);
    if (field === 'shared') expect(properties.uniforms).toBe(before);
    else expect(properties.uniforms).not.toBe(before);
    page.fog = new THREE.Fog(0x0000ff, 1, 10); draw(page);
    expect(handler.builds).toBe(builds + 1); expect(properties.uniforms).not.toBe(before);
    expect(Object.values(properties.uniforms ?? {}).some(uniform => typeof uniform === 'object' && uniform !== null
      && Reflect.get(uniform, 'value') === page.fog?.color)).toBe(true);
    const unrelated = new THREE.Scene(); unrelated.fog = page.fog; unrelated.environment = environment; draw(unrelated);
    expect(handler.builds).toBe(builds + 2);
  } finally { material.dispose(); geometry.dispose(); environment.dispose(); otherEnvironment.dispose(); light.dispose(); otherLight.dispose(); }
});

test('lent post inputs retain distinct sampler slots before and after placeholder retargeting', () => {
  const renderer = rendererFixture(), handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const nodes: Record<string, GraphNode> = {
    uv: { op: 'screenUV' }, source: { op: 'texture', param: 'source', in: ['uv'] },
    bloom: { op: 'texture', param: 'bloom', in: ['uv'] }, gain: { op: 'param', param: 'gain' },
    rgbSource: { op: 'swizzle', in: ['source'], mask: 'xyz' }, rgbBloom: { op: 'swizzle', in: ['bloom'], mask: 'xyz' },
    scaled: { op: 'mul', in: ['rgbBloom', 'gain'] },
  };
  let sum = 'rgbSource';
  for (let i = 1; i <= 17; i++) {
    nodes[`uv${i}`] = { op: 'add', in: ['uv', [i / 100, 0]] };
    nodes[`sample${i}`] = { op: 'texture', param: 'source', in: [`uv${i}`] };
    nodes[`rgb${i}`] = { op: 'swizzle', in: [`sample${i}`], mask: 'xyz' };
    nodes[`sum${i}`] = { op: 'add', in: [sum, `rgb${i}`] }; sum = `sum${i}`;
  }
  nodes['average'] = { op: 'div', in: [sum, 18] };
  nodes['result'] = { op: 'add', in: ['average', 'scaled'] };
  const graph = compileGraph({ version: 1, kind: 'post', params: {
    source: { type: 'texture', role: 'lent', value: 'source' }, bloom: { type: 'texture', role: 'lent', value: 'bloom' },
    gain: { type: 'float', value: .5 },
  }, nodes, stages: { post: { colour: 'result' } } });
  const geometry = new THREE.PlaneGeometry(), mesh = new THREE.Mesh(geometry, graph.material), camera = new THREE.PerspectiveCamera();
  const source = new THREE.DataTexture(new Uint8Array([128, 32, 16, 255]), 1, 1);
  const bloom = new THREE.DataTexture(new Uint8Array([16, 64, 32, 255]), 1, 1);
  const build = (): THREE.WebGLProgramParametersWithUniforms => {
    const scene = new THREE.Scene(); scene.add(mesh);
    handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, graph.material);
    try {
      const input: object = { customProgramCacheKey: graph.material.customProgramCacheKey() };
      const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
      if (!isParameters(input)) throw new Error('Missing post parameters');
      handler.build(graph.material, mesh, input); return input;
    } finally { handler.renderEnd(); }
  };
  try {
    const cold = build();
    expect(cold.fragmentShader.match(/uniform sampler2D /gu)).toHaveLength(2);
    graph.setTexture('source', source); graph.setTexture('bloom', bloom);
    const ready = build();
    expect(ready.fragmentShader).toBe(cold.fragmentShader);
    expect(Object.keys(ready.uniforms)).toEqual(Object.keys(cold.uniforms));
    const samplers: unknown[] = [];
    for (const row of Object.values(ready.uniforms)) { const value: unknown = row.value; if (value instanceof THREE.Texture) samplers.push(value); }
    expect(samplers).toEqual([source, bloom]);
  } finally { graph.material.dispose(); geometry.dispose(); source.dispose(); bloom.dispose(); }
});

test.each(['fog', 'environment'] as const)('a restored scene %s keeps its existing warm program bindings', field => {
  const programs = new Map<string, object>();
  const properties: {programs: typeof programs; currentProgram?: object; uniforms?: Record<string, unknown>; __version?: number} = {programs};
  const renderer = rendererFixture();
  Reflect.set(renderer, 'properties', {get: () => properties, has: () => true});
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer);
  const material = compileGraph({version: 1, kind: 'material', model: 'unlit',
    nodes: {colour: {op: 'fogColour'}}, stages: {surface: {colour: 'colour'}}, effectState: {fog: false}}).material;
  const geometry = new THREE.PlaneGeometry(), mesh = new THREE.Mesh(geometry, material), camera = new THREE.PerspectiveCamera();
  const scene = new THREE.Scene(), original = new THREE.Fog(0xff0000, 1, 10), borrowed = new THREE.Fog(0x0000ff, 1, 10);
  const environment = new THREE.DataTexture(new Uint8Array(16), 2, 2), otherEnvironment = new THREE.DataTexture(new Uint8Array(16), 2, 2);
  environment.mapping = THREE.CubeUVReflectionMapping; otherEnvironment.mapping = THREE.CubeUVReflectionMapping;
  scene.fog = original; scene.environment = environment; scene.add(mesh);
  const borrow = (): void => { if (field === 'fog') scene.fog = borrowed; else scene.environment = otherEnvironment; };
  try {
    handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, material);
    const customProgramCacheKey = material.customProgramCacheKey(), input: object = {customProgramCacheKey};
    const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
    if (!isParameters(input)) throw new Error('Missing parameters');
    handler.build(material, mesh, input);
    const program = {getUniforms: () => ({seq: Object.keys(input.uniforms).map(id => ({id}))})};
    programs.set('same-native-program', program); properties.currentProgram = program; properties.__version = material.version;
    handler.onUpdateProgram(material, program, properties);
    const before = properties.uniforms;
    handler.renderEnd();
    // Precompile temporarily borrows another resource, then restores this exact owner.
    borrow(); handler.renderStart(scene, camera); handler.updateLights([]); handler.renderEnd();
    scene.fog = original; scene.environment = environment; handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, material);
    expect(material.customProgramCacheKey()).toBe(customProgramCacheKey);
    material.onBeforeRender(renderer, scene, camera, geometry, mesh, new THREE.Group());
    expect(handler.builds).toBe(1);
    expect(properties.uniforms).toBe(before);
    handler.renderEnd();
    // An actual replacement still needs its own live bindings, even with the same shader shape.
    borrow(); handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, material);
    material.onBeforeRender(renderer, scene, camera, geometry, mesh, new THREE.Group());
    expect(handler.builds).toBe(2);
    expect(handler.buildLog.at(-1)?.how).toMatch(new RegExp(`^scene binding ${field}: `, 'u'));
    expect(properties.uniforms).not.toBe(before);
    expect(Object.values(properties.uniforms ?? {}).some(uniform => typeof uniform === 'object' && uniform !== null
      && Reflect.get(uniform, 'value') === scene.fog?.color)).toBe(true);
    handler.renderEnd();
  } finally {material.dispose(); geometry.dispose(); environment.dispose(); otherEnvironment.dispose();}
});
