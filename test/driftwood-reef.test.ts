// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, seedOf } from '@wildshard/engine/models/model';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { REEF, type ReefParams } from '../src/shards/driftwood-isle/models/reef';
import { reefGeometry } from '../src/shards/driftwood-isle/generators/reef';
import { foliageTransport } from '../src/shards/driftwood-isle/generators/hibiscusTransport';
import { decodeReefWorld } from '../src/shards/driftwood-isle/runtime/boot/reefGeometry';
import { REEF_FILES } from '../src/shards/driftwood-isle/data/reefFiles';
import { REEF_SPECIMENS } from '../src/shards/driftwood-isle/data/reefSpecimenRows';

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
  const material = new MeshStandardMaterial(), ctx = modelContext(null);
  ctx.once('driftwood-isle/reef:material', () => ({material, uniforms: {uTime: {value: 0}}}));
  const emitted = new Map<string, Uint8Array>();
  for (const kind of ['coral', 'weed', 'star'] as const) {
    const row = REEF_SPECIMENS[kind], urls: Readonly<Record<string, string>> = REEF_FILES[kind];
    for (const variant of [{id: 'default', params: row.defaults}, ...row.variants.map(v => ({id: v.id, params: {...row.defaults, ...v.params}}))]) {
      const url = urls[variant.id]; if (url === undefined) throw new Error('Missing authored card URL');
      const geometry = reefGeometry(kind, variant.params, new Rng(seedOf(REEF[kind])));
      emitted.set(url, staticGlb([{geometry, material, customAttributes: {_SWAY: 'aSway'}, compactIndex: true}], `reef-${kind}`)); geometry.dispose();
    }
  }
  const mocked = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
    const bytes = typeof input === 'string' ? emitted.get(input) : undefined;
    if (bytes === undefined) throw new Error('Undeclared reef request');
    return Promise.resolve(new Response(Uint8Array.from(bytes).buffer));
  });
  try {
    for (const kind of ['coral', 'weed', 'star'] as const) {
      const def = REEF[kind];
      const variants: ReefParams[] = [def.defaults];
      for (const variant of def.variants ?? []) variants.push({...def.defaults, ...variant.params});
      for (const params of variants) {
        const ready = new Promise<void>(resolve => { document.addEventListener('ws:model-ready', () => resolve(), {once: true}); });
        const built = def.build(ctx, params, new Rng(seedOf(def)));
        if (Array.isArray(built) || !('children' in built)) throw new Error('Reef card did not use its owned intake');
        await ready; const mesh = built.children[0];
        if (!(mesh instanceof Mesh)) throw new Error('Reef card missing');
        const geometry: unknown = mesh.geometry; if (!isGeometry(geometry)) throw new Error('Reef geometry missing');
        expect(mesh.material).toBe(material);
        expect(geometry.getAttribute('aSway').count).toBe(geometry.getAttribute('position').count); geometry.dispose();
      }
      expect(() => def.build(ctx, {...def.defaults, s: 12}, new Rng(1))).toThrow('no authored geometry');
    }
  } finally { mocked.mockRestore(); material.dispose(); }
});
