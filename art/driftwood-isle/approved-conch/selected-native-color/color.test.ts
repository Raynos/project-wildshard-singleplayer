import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import * as THREE from 'three';
import { EngineNodesHandler } from '../../../../src/engine/render/nodes/engineNodesHandler';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';
import { mergeAnimalGeometry } from '../../../../src/engine/models/animalGeometry';
import { facetGeometry, oneMaterial } from '../../../../src/engine/entities/lowpoly';
import { validateGraph } from '../../../../src/format/materialGraph';
import { compileGraph } from '../../../../src/engine/render/graph/compile';
import { createConchSelectedViewPreviewSource } from '../selected-native-view/conchSelectedViewPreview';
import { createConchColorSource } from './conchColorPreview';

const folder = 'art/driftwood-isle/approved-conch/';
const path = `${folder}selected-native-color/`;
const base = `${folder}selected-native-normals/native/`;
const read = (name: string): unknown => JSON.parse(readFileSync(name, 'utf8'));
const hash = (name: string) => createHash('sha256').update(readFileSync(name)).digest('hex');
const graph = read(`${path}graph.json`);
async function body(directory: string) {
  const bytes = new Uint8Array(readFileSync(`${directory}payload.bin`));
  const bodies = packedCreatureBodies(read(`${directory}metadata.json`), undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  return bodies.copy('conch-duelist', 'conch-duelist');
}

test('exact original input identity and payload prefix; candidate compressed content is addressed', () => {
  const pins = v.parse(v.record(v.string(), v.string()), read(`${path}input-pins.json`));
  for (const [name, digest] of Object.entries(pins)) expect(hash(name), name).toBe(digest);
  const original = inflateSync(readFileSync(`${base}payload.bin`));
  const candidate = inflateSync(readFileSync(`${path}payload.bin`));
  expect(candidate.subarray(0, original.length)).toEqual(original);
  expect(candidate.length - original.length).toBe(78840);
  const metadata = v.parse(v.object({ file: v.string(), bytes: v.number() }), read(`${path}metadata.json`));
  expect(metadata.file).toBe(`/assets/driftwood-isle/conch-selected-color-${hash(`${path}payload.bin`)}.bin`);
  expect(metadata.bytes).toBe(candidate.length);
});

test('real packed schema admits all 15 parts, preserves every old channel and copies fresh authored Float32 colors', async () => {
  const original = await body(base), candidate = await body(path), second = await body(path);
  expect(candidate.bones).toEqual(original.bones); expect(candidate.dims).toEqual(original.dims);
  expect(candidate.furParts).toEqual([]); expect(candidate.eyeParts).toEqual([]);
  expect(candidate.hardParts).toHaveLength(15);
  let components = 0;
  original.hardParts.forEach((geometry, i) => {
    const next = candidate.hardParts[i], fresh = second.hardParts[i];
    if (next === undefined || fresh === undefined) throw new Error('Missing part');
    expect(next.index).toEqual(geometry.index); expect(next.groups).toEqual(geometry.groups);
    expect(Object.keys(next.attributes)).toEqual([...Object.keys(geometry.attributes), 'aAuthoredColour']);
    for (const name of Object.keys(geometry.attributes)) {
      const before = geometry.getAttribute(name), after = next.getAttribute(name);
      expect(after.array).toEqual(before.array); expect(after.itemSize).toBe(before.itemSize);
      expect(after.normalized).toBe(before.normalized);
      expect(after.array.constructor).toBe(before.array.constructor);
    }
    const authored = next.getAttribute('aAuthoredColour');
    expect(authored.array).toBeInstanceOf(Float32Array); expect(authored.itemSize).toBe(3);
    expect(authored.normalized).toBe(false); expect(authored.array).toEqual(geometry.getAttribute('color').array);
    expect(authored.array).not.toBe(next.getAttribute('color').array);
    expect(authored.array).not.toBe(fresh.getAttribute('aAuthoredColour').array);
    components += authored.array.length;
    geometry.dispose(); next.dispose(); fresh.dispose();
  });
  expect(components).toBe(19710);
});

test('real merge, default faceting and one-material steps preserve authored channel; old runtime channels remain exactly baseline', async () => {
  const original = await body(base), candidate = await body(path);
  const expected = Float32Array.from(candidate.hardParts.flatMap(part => Array.from(part.getAttribute('color').array)));
  const run = (input: typeof original) => {
    const merged = mergeAnimalGeometry(input.furParts, input.hardParts, input.eyeParts);
    const faceted = facetGeometry(merged);
    oneMaterial(faceted, null);
    return faceted;
  };
  const before = run(original), after = run(candidate);
  expect(after.getAttribute('aAuthoredColour').array).toEqual(expected);
  expect(before.hasAttribute('aAuthoredColour')).toBe(false);
  let changed = 0;
  const color = after.getAttribute('color').array;
  expected.forEach((value, i) => { if (color[i] !== value) changed++; });
  expect(changed).toBe(19710);
  for (const name of Object.keys(before.attributes)) expect(after.getAttribute(name).array, name).toEqual(before.getAttribute(name).array);
  expect(after.groups).toEqual(before.groups); expect(after.boundingBox).toEqual(before.boundingBox);
  expect(after.boundingSphere).toEqual(before.boundingSphere);
  before.dispose(); after.dispose();
});

test('real graph admission and compilation succeed; sole product change is paint input', () => {
  const checked = validateGraph(graph);
  expect(checked.ok).toBe(true);
  if (!checked.ok) throw new Error(checked.errors.join('\n'));
  expect(checked.graph.nodes['paint']).toEqual({ op: 'attribute', name: 'aAuthoredColour', type: 'vec3' });
  const candidate = createConchColorSource();
  const baseline = createConchSelectedViewPreviewSource('neutral-gray-v2');
  expect(candidate).toEqual({ ...baseline, look: { ...baseline.look, materials: {
    ...baseline.look.materials, 'driftwood-creature': { family: 'graph', graph },
  } } });
  const material = baseline.look.materials['driftwood-creature'];
  if (material?.family !== 'graph') throw new Error('Missing baseline graph');
  expect({ ...checked.graph, nodes: { ...checked.graph.nodes, paint: { op: 'vertexColour' } } }).toEqual(material.graph);
  const compiled = compileGraph(graph), original = compileGraph(material.graph);
  expect(compiled.material.flatShading).toBe(original.material.flatShading);
  expect(compiled.material.side).toBe(original.material.side);
  expect(compiled.material.color).toEqual(original.material.color);
  compiled.material.dispose(); original.material.dispose();
});


test('real renderer node handler emits authored attribute in GLSL without editing geometry', async () => {
  const candidate = await body(path);
  const geometry = facetGeometry(mergeAnimalGeometry(candidate.furParts, candidate.hardParts, candidate.eyeParts));
  oneMaterial(geometry, null);
  const compiled = compileGraph(graph);
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer');
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } },
    debug: { checkShaderErrors: true, diagnostics: { keywords: false } }, properties: { get: () => ({}), has: () => false },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler();
  handler.setRenderer(renderer);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const mesh = new THREE.Mesh(geometry, compiled.material);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(mesh, sun); handler.renderStart(scene, camera); handler.updateLights([sun]);
  const parameters: object = {};
  const isParameters = (value: object): value is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(value);
  if (!isParameters(parameters)) throw new Error('Missing parameters');
  const authored = geometry.getAttribute('aAuthoredColour').array.slice();
  try {
    handler.build(compiled.material, mesh, parameters);
    expect(parameters.vertexShader).toContain('in vec3 aAuthoredColour;');
    expect(parameters.vertexShader).toContain('= aAuthoredColour');
    expect(geometry.getAttribute('aAuthoredColour').array).toEqual(authored);
  } finally { handler.renderEnd(); geometry.dispose(); compiled.material.dispose(); }
});

test('strict packed schema and graph validation still refuse undeclared controls', () => {
  const raw = v.parse(v.record(v.string(), v.unknown()), read(`${path}metadata.json`));
  expect(() => packedCreatureBodies({ ...raw, facetJitter: 0 })).toThrow();
  expect(validateGraph({ version: 1, kind: 'material', model: 'toon', nodes: {
    paint: { op: 'attribute', name: 'authoredColour', type: 'vec3' },
  }, stages: { surface: { colour: 'paint' } } }).ok).toBe(false);
});
