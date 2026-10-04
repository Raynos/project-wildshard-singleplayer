// E174: Driftwood's phone shadow maps' memory (src/engine/world/shadowVariants.ts) — C, Jake's pick: depth only at 16 bits, the
// number E174's capture measured at the WebGL API (40 MiB, against three's own 160; 6e7fd106).
import { describe, expect, it } from 'vitest';
import { PHONE_RIG_MAPS, shadowBytes } from '#engine-internal/world/shadowVariants';

const MiB = 1 << 20;

describe('phone shadow maps', () => {
  it('5 maps at 2048², 16-bit depth, no colour texture: 40 MiB', () => {
    expect(shadowBytes(PHONE_RIG_MAPS.size, PHONE_RIG_MAPS.cascades, PHONE_RIG_MAPS.ghosts) / MiB).toBe(40);
  });
  it('a rig without ghosts counts only its cascades', () => {
    expect(shadowBytes(2048, 3, 0) / MiB).toBe(24);
  });
});
