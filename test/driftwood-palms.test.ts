// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { Rng } from '@wildshard/engine/core/rng';
import { modelContext, seedOf } from '@wildshard/engine/models/model';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import * as runtimeProduct from '../src/game/shardfile/runtimeProduct';
import { namedModelProduct } from './fixtures/namedModelProduct';
import { palm } from '../src/shards/driftwood-isle/runtime/models/palm';
import { palmGeometry } from '../src/shards/driftwood-isle/generators/palm';
import { foliageTransport } from '../src/shards/driftwood-isle/generators/hibiscusTransport';
import { decodePalmWorld } from '../src/shards/driftwood-isle/runtime/boot/palmGeometry';

const isGeometry = (value: unknown): value is BufferGeometry => value instanceof BufferGeometry;

it('owns compacted palm channels independently while retaining full picking bounds and refusing corrupt data', () => {
  const shape = palmGeometry(palm.defaults, new Rng(seedOf(palm))), vertices = shape.getAttribute('position').count;
  const transport = foliageTransport(shape, [shape], {vertices, indices: 0, output: 3, runs: [{start: 0, count: 3}]}, 0x314d4c50, ['position', 'color', 'sway']);
  const {geometry, boxes} = decodePalmWorld(transport, 1);
  try {
    const position = geometry.getAttribute('position'), colour = geometry.getAttribute('color');
    expect(position.count).toBeLessThan(vertices);
    expect(geometry.getAttribute('aSway').count).toBe(position.count);
    expect(position.array.buffer).not.toBe(transport.buffer);
    expect(colour.array.buffer).not.toBe(position.array.buffer);
    expect(boxes.buffer).not.toBe(position.array.buffer);
    const bounds = shape.boundingBox;
    if (bounds === null) throw new Error('Original bounds missing');
    expect([...boxes]).toEqual([...bounds.min, ...bounds.max].map(Math.fround));
    expect(() => decodePalmWorld(transport, 2)).toThrow('topology');
    expect(() => decodePalmWorld(transport.subarray(0, -4), 1)).toThrow('topology');
    new DataView(transport.buffer).setFloat32(16 + 24, Number.NaN, true);
    expect(() => decodePalmWorld(transport, 1)).toThrow('Nonfinite');
  } finally { geometry.dispose(); shape.dispose(); }
});

it('loads each authored Explorer palm with its swaying kit material', async () => {
  const material = new MeshStandardMaterial(), ctx = modelContext(null);
  ctx.once('driftwood-isle/palm:material', () => material);
  const emitted = new Map<string, Uint8Array>();
  for (const variant of palm.variants ?? []) {
    if (variant.id !== 'tall' && variant.id !== 'young' && variant.id !== 'leaning') throw new Error('Unexpected palm');
    const geometry = palmGeometry({...palm.defaults, ...variant.params}, new Rng(seedOf(palm)));
    emitted.set(`draw:palms:${TIER === 'phone' ? 'phone' : 'desktop'}:${variant.id}`, staticGlb([{geometry, material, customAttributes: {_SWAY: 'sway'}, compactIndex: true}])); geometry.dispose();
  }
  const mocked = vi.spyOn(runtimeProduct, 'loadFirstPartyProduct').mockResolvedValue(namedModelProduct(emitted));
  try {
    for (const variant of palm.variants ?? []) {
      const ready = new Promise<void>(resolve => { document.addEventListener('ws:model-ready', () => resolve(), {once: true}); });
      const built = palm.build(ctx, {...palm.defaults, ...variant.params}, new Rng(seedOf(palm)));
      if (Array.isArray(built) || !('children' in built)) throw new Error('Palm must load its owned specimen');
      await ready;
      const mesh = built.children[0];
      if (!(mesh instanceof Mesh)) throw new Error('Palm mesh absent');
      const geometry: unknown = mesh.geometry;
      if (!isGeometry(geometry)) throw new Error('Palm geometry absent');
      expect(mesh.material).toBe(material);
      expect(geometry.getAttribute('aSway').count).toBe(geometry.getAttribute('position').count);
      geometry.dispose();
    }
    expect(() => palm.build(ctx, {...palm.defaults, h: 12}, new Rng(1))).toThrow('no authored geometry');
  } finally { mocked.mockRestore(); material.dispose(); }
});
