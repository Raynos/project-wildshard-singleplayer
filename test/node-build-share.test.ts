// Shared graph builds (E435, Debug ▸ Performance ▸ Shared graph builds): a clone of a built node graph reuses that build
// for an equal program key, a different key builds again, a build that captured its own material is never shared, and
// every clone keeps its own per-draw material state (maps) and its own classic uniforms and block groups.
import { afterAll, afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, texture } from 'three/tsl';
import { compileGraph } from '../src/engine/render/graph/compile';
import { EngineNodesHandler } from '../src/engine/render/nodes/engineNodesHandler';

class LinkedProgram { readonly label = 'linked'; }
class Buffers {
  readonly MAX_UNIFORM_BUFFER_BINDINGS = 35375; readonly UNIFORM_BUFFER = 35345; readonly DYNAMIC_DRAW = 35048; readonly INVALID_INDEX = 4294967295;
  getParameter(parameter: number): number { return parameter === this.MAX_UNIFORM_BUFFER_BINDINGS ? 24 : 65536; }
  createBuffer(): WebGLBuffer { return {}; }
  deleteBuffer(): void { /* stub */ }
  bindBuffer(): void { /* stub */ }
  bufferData(): void { /* stub */ }
  bufferSubData(): void { /* stub */ }
  bindBufferBase(): void { /* stub */ }
  getUniformBlockIndex(): number { return 0; }
  uniformBlockBinding(): void { /* stub */ }
}
vi.stubGlobal('ImageBitmap', class ImageBitmap { readonly width = 0; });
vi.stubGlobal('WebGLProgram', LinkedProgram);
vi.stubGlobal('WebGL2RenderingContext', Buffers);
afterAll(() => { vi.unstubAllGlobals(); });

interface Props { programs: Map<string, object>; currentProgram?: object; uniforms?: object; uniformsList?: unknown; __version?: number }
function rig(): { handler: EngineNodesHandler; props: (m: THREE.Material) => Props; renderer: THREE.WebGLRenderer } {
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const properties = new WeakMap<THREE.Material, Props>();
  const props = (m: THREE.Material): Props => { let p = properties.get(m); if (p === undefined) { p = { programs: new Map() }; properties.set(m, p); } return p; };
  const gl = new Buffers();
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => gl, getRenderTarget: () => null,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.LinearSRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: props, has: (m: THREE.Material) => properties.has(m) },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler(); handler.setRenderer(renderer); handler.shareBuilds = true;
  return { handler, props, renderer };
}
afterEach(() => { new EngineNodesHandler().shareBuilds = false; });

const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
/** what WebGLRenderer.getProgram does for a key the material has no program for: build, acquire, file, draw */
function draw({ handler, renderer }: { handler: EngineNodesHandler; renderer: THREE.WebGLRenderer }, props: Props, scene: THREE.Scene, camera: THREE.Camera, mesh: THREE.Mesh, material: THREE.Material, key: string): THREE.WebGLProgramParametersWithUniforms {
  handler.renderStart(scene, camera); handler.updateLights([]); handler.setObject(mesh, material);
  const parameters: object = { shaderName: material.name, customProgramCacheKey: material.customProgramCacheKey() };
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  handler.build(material, mesh, parameters);
  const program = { program: new LinkedProgram(), getUniforms: () => ({ seq: Object.keys(parameters.uniforms).map(id => ({ id })) }) };
  props.programs.set(key, program); props.currentProgram = program; props.uniforms = parameters.uniforms; props.uniformsList = null;
  handler.onUpdateProgram(material, program, props);
  material.onBeforeRender(renderer, scene, camera, mesh.geometry, mesh, new THREE.Group());
  handler.renderEnd();
  return parameters;
}
const nodeUniforms = (p: THREE.WebGLProgramParametersWithUniforms): Record<string, unknown> =>
  Object.fromEntries(Object.entries(p.uniforms).filter(([name]) => name.startsWith('nodeUniform') || name.startsWith('engineNodeBuffer')));
const samplerValues = (p: THREE.WebGLProgramParametersWithUniforms): unknown[] =>
  Object.values(p.uniforms).map((u): unknown => Reflect.get(u, 'value')).filter(v => v instanceof THREE.Texture);

test('a clone reuses its graph build for an equal key and keeps its own maps, classic uniforms and blocks', () => {
  const kit = rig(), { handler, props, renderer } = kit;
  // a lit graph with an authored roughness: its factor multiplies each clone's own roughness map (mappedFactor)
  const base = compileGraph({ version: 1, kind: 'material', model: 'standard', params: { tint: { type: 'vec3', value: [1, 0.5, 0.25] } },
    nodes: { tint: { op: 'param', param: 'tint' } }, stages: { surface: { colour: 'tint', roughness: 0.6 } }, effectState: { fog: false } }).material;
  const mapA = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1), mapB = new THREE.DataTexture(new Uint8Array([0, 255, 0, 255]), 1, 1);
  const a = base.clone(), b = base.clone();
  Reflect.set(a, 'roughnessMap', mapA); Reflect.set(b, 'roughnessMap', mapB);
  const geometry = new THREE.PlaneGeometry(), camera = new THREE.PerspectiveCamera(), scene = new THREE.Scene();
  const meshA = new THREE.Mesh(geometry, a), meshB = new THREE.Mesh(geometry, b);
  scene.add(meshA, meshB);
  const pa = draw(kit, props(a), scene, camera, meshA, a, 'k');
  expect(handler.builds).toBe(1); expect(handler.sharedBuilds).toBe(0);
  expect(samplerValues(pa)).toContain(mapA);
  const pb = draw(kit, props(b), scene, camera, meshB, b, 'k');
  // hit: no second node build, the same GLSL and node uniforms
  expect(handler.builds).toBe(1); expect(handler.sharedBuilds).toBe(1);
  expect(pb.vertexShader).toBe(pa.vertexShader); expect(pb.fragmentShader).toBe(pa.fragmentShader);
  expect(nodeUniforms(pb)).toEqual(nodeUniforms(pa));
  // per instance: the classic uniforms are b's own, and b's draw reads b's map, a's draw a's map
  expect(pb.uniforms['fogColor']).not.toBe(pa.uniforms['fogColor']);
  expect(samplerValues(pb)).toContain(mapB); expect(samplerValues(pb)).not.toContain(mapA);
  handler.renderStart(scene, camera); handler.setObject(meshA, a);
  a.onBeforeRender(renderer, scene, camera, geometry, meshA, new THREE.Group()); handler.renderEnd();
  expect(samplerValues(pa)).toContain(mapA);
  // each material owns its uniform-block groups: disposing a leaves b's intact
  const groups = (m: THREE.Material): unknown[] => {
    const cache: unknown = Reflect.get(handler, 'programCache');
    const entries: unknown = cache instanceof Map ? cache.get(m) : undefined;
    return entries instanceof Map ? [...entries.values()].flatMap((e: unknown): unknown[] => { const g: unknown = typeof e === 'object' && e !== null ? Reflect.get(e, 'uniformsGroups') : undefined; return Array.isArray(g) ? g : []; }) : [];
  };
  const ga = groups(a), gb = groups(b);
  expect(gb.length).toBe(ga.length);
  for (const group of gb) expect(ga).not.toContain(group);
  // a different key (an instanced draw of the same graph) builds again
  const c = base.clone(), instanced = new THREE.InstancedMesh(geometry, c, 2);
  draw(kit, props(c), scene, camera, instanced, c, 'instanced');
  expect(handler.builds).toBe(2); expect(handler.sharedBuilds).toBe(1);
  a.dispose(); b.dispose(); c.dispose(); base.dispose(); geometry.dispose(); mapA.dispose(); mapB.dispose();
});

test('separately compiled graphs never share, and a build that captured its material builds every clone', () => {
  const kit = rig(), { handler, props } = kit;
  const graph = { version: 1, kind: 'material', model: 'unlit', params: { colour: { type: 'vec3', value: [1, 0, 0] } },
    nodes: { colour: { op: 'param', param: 'colour' } }, stages: { surface: { colour: 'colour' } }, effectState: { fog: false } };
  const one = compileGraph(graph), two = compileGraph(graph);
  two.setParam('colour', [0, 0, 1]);
  const geometry = new THREE.PlaneGeometry(), camera = new THREE.PerspectiveCamera(), scene = new THREE.Scene();
  const p1 = draw(kit, props(one.material), scene, camera, new THREE.Mesh(geometry, one.material), one.material, 'k');
  const p2 = draw(kit, props(two.material), scene, camera, new THREE.Mesh(geometry, two.material), two.material, 'k');
  expect(handler.builds).toBe(2); expect(handler.sharedBuilds).toBe(0);
  const colours = (p: THREE.WebGLProgramParametersWithUniforms): unknown[] => Object.values(nodeUniforms(p)).map((u): unknown => typeof u === 'object' && u !== null ? Reflect.get(u, 'value') : undefined).filter(v => v instanceof THREE.Color || v instanceof THREE.Vector3);
  expect(colours(p1)).not.toEqual(colours(p2));
  // a graph that samples its material's map at build time (not per draw) is never shared
  const capturing = new MeshBasicNodeMaterial();
  capturing.colorNode = Fn((builder: { material: THREE.Material }) => {
    const map: unknown = Reflect.get(builder.material, 'map');
    if (!(map instanceof THREE.Texture)) throw new Error('Missing map');
    return texture(map).rgb;
  })();
  capturing.fog = false;
  const x = capturing.clone(), y = capturing.clone();
  const mapX = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1), mapY = new THREE.DataTexture(new Uint8Array([0, 255, 0, 255]), 1, 1);
  x.map = mapX; y.map = mapY;
  draw(kit, props(x), scene, camera, new THREE.Mesh(geometry, x), x, 'k');
  const py = draw(kit, props(y), scene, camera, new THREE.Mesh(geometry, y), y, 'k');
  expect(handler.builds).toBe(4); expect(handler.sharedBuilds).toBe(0);
  expect(samplerValues(py)).toContain(mapY);
  one.material.dispose(); two.material.dispose(); x.dispose(); y.dispose(); capturing.dispose(); geometry.dispose(); mapX.dispose(); mapY.dispose();
});
