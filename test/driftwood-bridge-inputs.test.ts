import { expect, expectTypeOf, test } from 'vitest';
import type { BufferGeometry } from 'three';
import type { RopeDeckRest, RopeDeckSpan } from '../src/format/ropeDeckSite';
import type { bridgeFacts } from '../src/shards/driftwood-isle/generators/ropeBridge';
import { originalBridgeFacts, originalBridgeDecks, originalBridgePosts } from '../src/shards/driftwood-isle/generators/driftwoodBridge.mjs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import policy from '../src/shards/driftwood-isle/data/bridgeGeometryPolicy.json' with { type: 'json' };
import original from './fixtures/driftwood-bridge-inputs-original.json' with { type: 'json' };

function identity(g: BufferGeometry): unknown {
  const bytes = (a: { readonly array: ArrayBufferView }) => new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength);
  return { attributes: Object.entries(g.attributes).map(([name, a]) => ({ name, storage: a.array.constructor.name,
    width: a.itemSize, normalized: a.normalized, count: a.count, hash: hashImmutableBytes(bytes(a)) })),
    index: g.index === null ? null : { storage: g.index.array.constructor.name, count: g.index.count, hash: hashImmutableBytes(bytes(g.index)) },
    groups: g.groups, box: g.boundingBox, sphere: g.boundingSphere };
}

test('owned bridge author ports retain native spans, segments and original ground/rest facts', () => {
  expectTypeOf<Parameters<typeof bridgeFacts>[0]>().toEqualTypeOf<RopeDeckSpan>();
  expectTypeOf<ReturnType<typeof bridgeFacts>['segments']>().toEqualTypeOf<RopeDeckRest['segments']>();
  expect(policy.seed).toBe(original.seed);
  expect(JSON.stringify(originalBridgeFacts())).toBe(JSON.stringify(original.facts));
});

test('both native spans retain all original post/deck geometry channel bits', () => {
  const decks = originalBridgeDecks(), posts = originalBridgePosts();
  try {
    expect(JSON.stringify(Object.fromEntries(Object.entries(decks).map(([key, g]) => [key, identity(g)])))).toBe(JSON.stringify(original.decks));
    expect(JSON.stringify(Object.fromEntries(Object.entries(posts).map(([key, g]) => [key, identity(g)])))).toBe(JSON.stringify(original.posts));
  } finally { for (const g of [...Object.values(decks), ...Object.values(posts)]) g.dispose(); }
});
