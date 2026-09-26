// E174: the Driftwood phone shadow variants' memory (src/world/shadowVariants.ts) — the numbers the Debug picker prints and
// scripts/e174-shadows.mjs measured at the WebGL API (A 160 · B 80 · C 40 · D 22 MiB of shadow maps).
import { describe, expect, it } from 'vitest';
import { PHONE_RIG_MAPS, VARIANT_SPECS, shadowBytes, type SHADOW_VARIANTS } from '../src/world/shadowVariants';

const MiB = 1 << 20;
const rig = (v: (typeof SHADOW_VARIANTS)[number]) => shadowBytes(v, PHONE_RIG_MAPS.size, PHONE_RIG_MAPS.cascades, PHONE_RIG_MAPS.ghosts) / MiB;

describe('shadow variants', () => {
  it('A is today: 5 maps at 2048², RGBA8 colour + 32-bit depth', () => {
    expect(rig('a')).toBe(160);
    expect(VARIANT_SPECS.a.colour).toBe(true);
  });
  it('each later variant only saves', () => {
    expect([rig('a'), rig('b'), rig('c'), rig('d')]).toEqual([160, 80, 40, 22]);
  });
  it('a rig without ghosts (?sunfade=0) counts only its cascades', () => {
    expect(shadowBytes('a', 2048, 3, 0) / MiB).toBe(96);
    expect(shadowBytes('d', 2048, 3, 0) / MiB).toBe(18);
  });
});
