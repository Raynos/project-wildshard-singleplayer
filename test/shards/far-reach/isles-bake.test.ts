import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate hashes the committed bake's bytes.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the committed bake the client loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate checks the bake on the platform that wrote it.
import { platform } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate inflates the shipped islands bake.
import { inflateSync } from 'node:zlib';
import { bakeSkyIsles } from '../../../src/shards/far-reach/generators/isles';
import { islandMesh, setIslePack } from '../../../src/shards/far-reach/world/isle';
import { ISLES } from '../../../src/shards/far-reach/data/layout';
import { GATE_ISLES } from '../../../src/shards/far-reach/world/risingIslet';
import isleRows from '../../../src/shards/far-reach/data/isles.json' with { type: 'json' };

const bin = (): Uint8Array => new Uint8Array(inflateSync(readFileSync(new URL('../../../public/assets/far-reach/baked/isles.bin', import.meta.url))));
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('Sky Reach bakes its islands offline (SHARD-PLATFORM M3)', () => {
  // bit-exact on the platform that baked it (Linux CI's libm differs in the last ulp)
  it.runIf(platform === 'darwin')('the committed bake is byte-exact against its generator (the stale gate: rerun src/shards/far-reach/generators/bake-sky-world.mjs)', () => {
    const { bin: bytes, rows } = bakeSkyIsles();
    expect({ pack: sha(bytes), ...rows }).toEqual(isleRows);
    expect(sha(bin())).toBe(isleRows.pack);
  });

  it('draws every playable island, gate isle and moving islet from the pack, indexed, normals computed', () => {
    expect(isleRows.isles).toEqual([...ISLES.map((i) => i.id), ...GATE_ISLES.map((i) => i.id), ...['north', 'east', 'south', 'west'].map((e) => `islet.${e}`)]);
    setIslePack(bin());
    for (const id of isleRows.isles) {
      const g = islandMesh(id).geometry;
      expect(g.getIndex()?.array).toBeInstanceOf(Uint16Array);
      expect(g.getAttribute('normal').count).toBe(g.getAttribute('position').count);
    }
    setIslePack(null);
    expect(islandMesh('sunrest').geometry.hasAttribute('position')).toBe(false);
  });
});
