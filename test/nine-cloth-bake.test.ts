import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometryLoader, type BufferGeometry } from 'three';
import { buildViewmodelParts } from '../src/shards/nine-dragon-stack/generators/viewmodelParts';
import { viewmodelGraphs } from '../src/shards/nine-dragon-stack/generators/viewmodelGraphs';
import motion from '../src/shards/nine-dragon-stack/data/clothMotion.json' with { type: 'json' };
import vmRows from '../src/shards/nine-dragon-stack/data/viewmodelUniforms.json' with { type: 'json' };
import viewmodel from '../src/shards/nine-dragon-stack/data/decals.json' with { type: 'json' };
import baseline from './fixtures/nine-cloth-buffers.json' with { type: 'json' };

async function channels(geometry: BufferGeometry): Promise<unknown> {
  const hash = async (array: BufferAttribute['array']): Promise<string> => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
    return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  return { attributes: Object.fromEntries(await Promise.all(Object.entries(geometry.attributes).map(async ([name, attribute]) => {
    if (!(attribute instanceof BufferAttribute)) throw new Error('Cloth channels stay ordinary buffers');
    return [name, { type: attribute.array.constructor.name, size: attribute.itemSize, normalized: attribute.normalized, count: attribute.count, hash: await hash(attribute.array) }] as const;
  }))), index: geometry.index === null ? null : { type: geometry.index.array.constructor.name, count: geometry.index.count, hash: await hash(geometry.index.array) } };
}

function parts(): { knot: BufferGeometry; tassel: BufferGeometry; sheet: BufferGeometry; cord: BufferGeometry } {
  const baked = buildViewmodelParts(), loader = new BufferGeometryLoader();
  const decoded = { knot: loader.parse(baked.knot.toJSON()), tassel: loader.parse(baked.tassel.toJSON()), sheet: loader.parse(baked.sheet.toJSON()), cord: loader.parse(baked.cord.toJSON()) };
  for (const geometry of Object.values(baked)) geometry.dispose();
  return decoded;
}

test('baked cloth keeps its topology, UVs and material classes', async () => {
  const geometry = parts();
  for (const key of ['knot', 'tassel', 'sheet', 'cord'] as const) {
    const row = await channels(geometry[key]);
    const expected = baseline.raw[key];
    expect(row).toMatchObject({ index: expected.index, attributes: { uv: expected.attributes.uv, aMat: expected.attributes.aMat, color: expected.attributes.color } });
    expect(geometry[key].getAttribute('position').count).toBe(expected.attributes.position.count);
    geometry[key].dispose();
  }
});

test('pendants have a finite drape and bounded flutter that leaves their roots pinned', () => {
  const geometry = parts();
  for (const key of ['tassel', 'sheet', 'cord'] as const) {
    const g = geometry[key], positions = g.getAttribute('position'), field = g.getAttribute('aCloth');
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    expect(g.getAttribute('normal').count).toBe(positions.count);
    expect(field.count).toBe(positions.count);
    expect(field.itemSize).toBe(4);
    const weights = Array.from({ length: field.count }, (_, i) => field.getX(i));
    expect(Math.min(...weights)).toBeCloseTo(0, 7);
    expect(Math.max(...weights)).toBeLessThanOrEqual(Math.fround(motion.amplitude));
    if (key !== 'cord') expect(Math.max(...weights)).toBeGreaterThan(0);
    expect(new Set(Array.from(positions.array)).size).toBeGreaterThan(8);
    g.dispose();
  }
  geometry.knot.dispose();
});

test('body and ink hull read the same baked motion with no extra outline draw', () => {
  const graphs = viewmodelGraphs();
  for (const id of ['nine-vm-cloth', 'nine-vm-cloth-hull']) {
    const graph = graphs[id];
    if (graph === undefined) throw new Error('Missing cloth graph');
    expect(graph.stages[id.endsWith('hull') ? 'vertex.clip' : 'vertex.position']).toBeDefined();
    expect(Object.values(graph.nodes).some(row => row.op === 'attribute' && row.name === 'aCloth')).toBe(true);
    expect(graph.params?.['uTime']).toEqual({ type: 'float', value: 0 });
    expect(Object.keys(graph.nodes).length).toBeLessThanOrEqual(4096);
    expect(new TextEncoder().encode(JSON.stringify(graph)).length).toBeLessThanOrEqual(64000);
    expect(graph.stages.outline).toBeUndefined();
  }
});

test('decoded pendant buffers belong to each rig', () => {
  const first = parts(), second = parts();
  for (const key of ['knot', 'tassel', 'sheet', 'cord'] as const) {
    expect(first[key].getAttribute('position').array).not.toBe(second[key].getAttribute('position').array);
    expect(first[key].index?.array).not.toBe(second[key].index?.array);
    first[key].dispose(); second[key].dispose();
  }
});

test('the held class table retains its authored palette and tuning', () => {
  expect(viewmodel.classes).toEqual(baseline.look.classes);
  expect(vmRows.uPal.rgbs).toEqual(baseline.look.vmPalette);
  expect(vmRows).toEqual(baseline.look.uniforms);
});
