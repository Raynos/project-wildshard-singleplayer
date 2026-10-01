import { describe, expect, it } from 'vitest';
import { app } from '#engine/app/runtime';
import { audioRandom } from '#engine/audio/util';
import { Rng, fnv1a32 } from '#engine/core/rng';

describe('audio RNG isolation', () => {
  it('keeps the bark/visual stream unchanged through noise-buffer and playback draws and reseeds audio', () => {
    const seed = 0x2545f491;
    app.rng.seed(seed);
    const cosmetic = new Rng(fnv1a32(`${String(seed)}:cosmetic`));
    for (let i = 0; i < 120000; i++) audioRandom();
    expect(app.rng.stream('cosmetic').int(0, 2)).toBe(cosmetic.int(0, 2));
    for (let i = 0; i < 5; i++) {
      audioRandom();
      expect(app.rng.stream('cosmetic').next()).toBe(cosmetic.next());
    }
    app.rng.seed(seed);
    expect(audioRandom()).toBe(new Rng(fnv1a32(`${String(seed)}:audio`)).next());
  });
});
