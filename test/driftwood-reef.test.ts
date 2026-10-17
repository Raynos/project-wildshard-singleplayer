import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, seedOf } from '@wildshard/engine/models/model';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { namedModelProduct } from './fixtures/namedModelProduct';
import { REEF, type ReefParams } from '../src/shards/driftwood-isle/runtime/models/reef';
import { reefGeometry } from '../src/shards/driftwood-isle/generators/reef';
import { foliageTransport } from '../src/shards/driftwood-isle/generators/hibiscusTransport';
import { decodeReefWorld } from '../src/shards/driftwood-isle/runtime/boot/reefGeometry';
import { REEF_SPECIMENS } from '../src/shards/driftwood-isle/generators/reefSpecimenRows';

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;

it('owns the native reef wind channels and full picking boxes without a geometry template', () => {
  const shape = reefGeometry('weed', REEF_SPECIMENS.weed.defaults, new Rng(1)), vertices = shape.getAttribute('position').count;
  const transport = foliageTransport(shape, [shape], {vertices, indices: 0, output: vertices, runs: [{start: 0, count: vertices}]}, 0x31464552, ['position', 'color', 'aSway']);
  const {geometry, boxes} = decodeReefWorld(transport, 1);
  try {
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(geometry.getAttribute('aSway').count).toBe(geometry.getAttribute('position').count);
    expect(geometry.getAttribute('color').array.buffer).not.toBe(geometry.getAttribute('position').array.buffer);
    expect(geometry.getAttribute('position').array.buffer).not.toBe(transport.buffer);
    expect(boxes.buffer).not.toBe(transport.buffer);
    expect(() => decodeReefWorld(transport, 2)).toThrow('topology');
    expect(() => decodeReefWorld(transport.subarray(0, -4), 1)).toThrow('topology');
    new DataView(transport.buffer).setFloat32(40, Number.NaN, true);
    expect(() => decodeReefWorld(transport, 1)).toThrow('Nonfinite');
  } finally { geometry.dispose(); shape.dispose(); }
});

it('loads all authored reef cards with the borrowed material and refuses undeclared shapes', async () => {
  admitDriftwoodFixtureRows();
  const material = new MeshStandardMaterial(), ctx = modelContext(null);
  ctx.once('driftwood-isle/reef:material', () => ({material, uniforms: {uTime: {value: 0}}}));
  const emitted = new Map<string, Uint8Array>(), expected = new Map<string, { attributes: Record<string, number[]>; index: number[] | null }[]>();
  for (const kind of ['coral', 'weed', 'star'] as const) {
    const shapes: { attributes: Record<string, number[]>; index: number[] | null }[] = []; expected.set(kind, shapes);
    const row = REEF_SPECIMENS[kind];
    for (const variant of [{id: 'default', params: row.defaults}, ...row.variants.map(v => ({id: v.id, params: {...row.defaults, ...v.params}}))]) {
      const url = `draw:reef:${kind}:${variant.id}`;
      const geometry = reefGeometry(kind, variant.params, new Rng(seedOf(REEF[kind])));
      shapes.push({ attributes: Object.fromEntries(Object.entries(geometry.attributes).map(([name, channel]) => [name, Array.from(channel.array)])), index: geometry.index === null ? null : Array.from(geometry.index.array) });
      emitted.set(url, staticGlb([{geometry, material, customAttributes: {_SWAY: 'aSway'}, compactIndex: true}], `reef-${kind}`)); geometry.dispose();
    }
  }
  const mocked = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(namedModelProduct(emitted));
  try {
    for (const kind of ['coral', 'weed', 'star'] as const) {
      const def = REEF[kind];
      const variants: ReefParams[] = [def.defaults];
      for (const variant of def.variants ?? []) variants.push({...def.defaults, ...variant.params});
      for (const [index, params] of variants.entries()) {
        const ready = new Promise<void>(resolve => { document.addEventListener('ws:model-ready', () => resolve(), {once: true}); });
        const built = def.build(ctx, params, new Rng(seedOf(def)));
        if (Array.isArray(built) || !('children' in built)) throw new Error('Reef card did not use its owned intake');
        await ready; const mesh = built.children[0];
        if (!(mesh instanceof Mesh)) throw new Error('Reef card missing');
        const geometry: unknown = mesh.geometry; if (!isGeometry(geometry)) throw new Error('Reef geometry missing');
        const shape = expected.get(kind)?.[index];
        if (shape === undefined) throw new Error('Missing authored reef oracle');
        for (const [name, values] of Object.entries(shape.attributes)) expect(Array.from(geometry.getAttribute(name).array)).toEqual(values);
        expect(geometry.index === null ? null : Array.from(geometry.index.array)).toEqual(shape.index);
        expect(mesh.material).toBe(material);
        expect(geometry.getAttribute('aSway').count).toBe(geometry.getAttribute('position').count); geometry.dispose();
      }
      expect(() => def.build(ctx, {...def.defaults, s: 12}, new Rng(1))).toThrow('no authored geometry');
    }
  } finally { mocked.mockRestore(); material.dispose(); }
});
