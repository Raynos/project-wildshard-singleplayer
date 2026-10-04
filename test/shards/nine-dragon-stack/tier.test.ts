import { describe, expect, it } from 'vitest';
import { decalScale, glyphLayout, paintSize, signLayout } from '../../../src/shards/nine-dragon-stack/tier';

describe('Nine Dragon atlas tiers', () => {
  it('preserves both authored layouts without a module-global tier', () => {
    expect(glyphLayout('phone')).toEqual({ cell: 64, fontPx: 46, spread: 9, skeletonSpread: 13 });
    expect(glyphLayout('desktop')).toEqual({ cell: 128, fontPx: 92, spread: 18, skeletonSpread: 26 });
    expect(signLayout('phone')).toEqual({ mw: 1024, mh: 2048, cw: 512, ch: 1024, unit: 48, pad: 4 });
    expect(signLayout('desktop')).toEqual({ mw: 2048, mh: 4096, cw: 1024, ch: 2048, unit: 96, pad: 8 });
    expect(paintSize('phone')).toBe(512); expect(paintSize('desktop')).toBe(1024);
    expect(decalScale('phone')).toBe(0.5); expect(decalScale('desktop')).toBe(1);
  });
  it('keeps layouts independent when a second tier is built', () => {
    const phone = glyphLayout('phone'); phone.cell = 1;
    expect(glyphLayout('phone').cell).toBe(64);
    expect(glyphLayout('desktop').cell).toBe(128);
  });
});
