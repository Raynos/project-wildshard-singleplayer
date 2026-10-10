import { describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate checks the bake on the platform that wrote it.
import { platform } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate inflates the shipped bridges bake.
import { inflateSync } from 'node:zlib';
import { BufferAttribute, BufferGeometry, InstancedMesh, Mesh, MeshStandardMaterial, TubeGeometry } from 'three';
import { bakeSkyBridges, ropeSpans } from '../../../src/shards/far-reach/generators/bridges';
import { loadSkyBridges, ropeBridge } from '../../../src/shards/far-reach/world/shapes';
import { packedRows, type PackedGeometryRow } from '@wildshard/sdk/kit/geometryPack';
import bridgeRows from '../../../src/shards/far-reach/data/bridges.json' with { type: 'json' };

const publicFile = (url: string): Uint8Array => new Uint8Array(readFileSync(new URL(`../../../public${url}`, import.meta.url)));
const bin = (): Uint8Array<ArrayBuffer> => new Uint8Array(readFileSync(new URL('../../../public/assets/far-reach/baked/bridges.bin', import.meta.url)));
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('Sky Reach bakes its rope bridges offline (SHARD-PLATFORM M3)', () => {
  // bit-exact on the platform that baked it (Linux CI's libm differs in the last ulp)
  it.runIf(platform === 'darwin')('the committed bake is byte-exact against its generator (the stale gate: rerun src/shards/far-reach/generators/bake-sky-world.mjs)', async () => {
    const { bin: bytes, rows } = await bakeSkyBridges(publicFile);
    expect({ pack: sha(bytes), ...rows }).toEqual(bridgeRows);
    expect(sha(new Uint8Array(inflateSync(bin())))).toBe(bridgeRows.pack);
  });

  it('bakes every rope span the world lays, and draws each from the pack: the stretched deck segments, the ropes and the ties', async () => {
    expect(bridgeRows.spans.map((s) => s.id)).toEqual(ropeSpans().map((s) => s.id));
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(bin())));
    await loadSkyBridges(); fetch.mockRestore();
    const rails = new MeshStandardMaterial(), deckIndex: number = bridgeRows.deck, deckRow: PackedGeometryRow | undefined = packedRows(bridgeRows).geometries[deckIndex];
    for (const span of bridgeRows.spans) {
      const group = ropeBridge(span.id, rails), [deck, ...rest] = group.children;
      // no textured post in a test (its model never loaded): the deck, then per side the top and mid ropes and the ties
      expect(deck).toBeInstanceOf(InstancedMesh);
      if (!(deck instanceof InstancedMesh)) continue;
      const geometry: unknown = deck.geometry, normal: unknown = geometry instanceof BufferGeometry ? geometry.getAttribute('normal') : null;
      expect(normal instanceof BufferAttribute && normal.count).toBe(deckRow?.count);
      expect(deck.count).toBeGreaterThan(0);
      const ties = span.sides.filter((s) => s.ties.length > 0).length;
      expect(rest).toHaveLength(4 + ties);
      expect(rest.filter((o) => o instanceof Mesh && o.geometry instanceof TubeGeometry)).toHaveLength(4);
      for (const o of rest) expect(o instanceof Mesh && o.material === rails).toBe(true);
    }
    expect(ropeBridge('far.rope.unknown', rails).children).toHaveLength(0);
  });
});
