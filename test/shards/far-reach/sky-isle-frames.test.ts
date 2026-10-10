import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the source models the page loads.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate checks the bake on the platform that wrote it.
import { platform } from 'node:process';
import { bakeSkyIsleFrames } from '../../../src/shards/far-reach/generators/skyIsleFrames';
import { SKY_ISLE_HD, SKY_ISLE_MODELS } from '../../../src/shards/far-reach/data/skyIsles';
import frames from '../../../src/shards/far-reach/data/skyIsleFrames.json' with { type: 'json' };

const publicFile = (url: string): Uint8Array => new Uint8Array(readFileSync(new URL(`../../../public${url}`, import.meta.url)));

describe('Sky Reach finds its sky-isle models\' unit frames offline (SHARD-PLATFORM M3)', () => {
  // bit-exact on the platform that baked it (Linux CI's libm differs in the last ulp)
  it.runIf(platform === 'darwin')('the committed frames are exact against their generator (the stale gate: rerun src/shards/far-reach/generators/bake-sky-world.mjs)', async () => {
    expect(await bakeSkyIsleFrames(publicFile)).toEqual(frames);
  });

  it('frames every model, each rim a bin per angle in float32', () => {
    expect(frames.map((f) => f.model)).toEqual([...SKY_ISLE_MODELS]);
    for (const f of frames) {
      expect(f.rim).toHaveLength(SKY_ISLE_HD.rimBins);
      expect(Array.from(Float32Array.from(f.rim))).toEqual(f.rim);
      expect(f.k).toBeGreaterThan(0);
    }
  });
});
