import { describe, expect, it } from 'vitest';
import { BlendFunction, BlendMode } from 'postprocessing';
import { DECK_SLOT, FIRST_NEIGHBOUR_SLOT, LAST_SLOT, frameFog, frameTime, regionWeights, slotAlpha, slotOf } from '../src/game/grid/frameModel';
import { RegionGradeEffect, gateToHome } from '../src/game/grid/frame';

// SHARD-PLATFORM SF19a: one frame for the grid (the pure model and the per-pixel grade's shader pieces)
const pitch = 555, half = 250, band = (pitch - 2 * half) / 2;
const cells = [-1, 0, 1].flatMap((cx) => [-1, 0, 1].map((cz) => ({ instance: `${String(cx)},${String(cz)}`, origin: { x: cx * pitch, z: cz * pitch } })));

describe('grid frame regions', () => {
  it('inside a cell the cell is the whole region; mid-strip and at the crossroads the highway is', () => {
    const inside = regionWeights(cells, 10, -40, half, band);
    expect([...inside.cells]).toEqual([['0,0', 1]]); expect(inside.highway).toBe(0);
    const strip = regionWeights(cells, pitch / 2, 0, half, band);
    expect(strip.cells.size).toBe(0); expect(strip.highway).toBe(1);
    const crossroads = regionWeights(cells, pitch / 2, pitch / 2, half, band);
    expect(crossroads.highway).toBe(1);
  });
  it('blends linearly across the edge band and always sums to 1', () => {
    const quarter = regionWeights(cells, half + band / 2, 0, half, band);
    expect(quarter.cells.get('0,0')).toBeCloseTo(0.5); expect(quarter.highway).toBeCloseTo(0.5);
    for (let x = -800; x <= 800; x += 37) for (let z = -800; z <= 800; z += 41) {
      const w = regionWeights(cells, x, z, half, band);
      expect([...w.cells.values()].reduce((a, b) => a + b, 0) + w.highway).toBeCloseTo(1, 9);
    }
  });
  it('air: the home fog at home, the neighbour haze inside it, a desaturated home air on the deck', () => {
    const home = { instance: '0,0', fog: [0.8, 0.6, 0.4] as const }, hazes = new Map([['1,0', [0.1, 0.2, 0.9] as const]]);
    expect(frameFog(regionWeights(cells, 0, 0, half, band), home, hazes)).toEqual([0.8, 0.6, 0.4]);
    expect(frameFog(regionWeights(cells, pitch, 0, half, band), home, hazes)).toEqual([0.1, 0.2, 0.9]);
    const deck = frameFog(regionWeights(cells, pitch / 2, pitch / 2, half, band), home, hazes);
    expect(deck[0]).toBeCloseTo(0.7); expect(deck[1]).toBeCloseTo(0.6); expect(deck[2]).toBeCloseTo(0.5);
  });
  it('time: the world clock unless a weighted region declares one, the short way round midnight', () => {
    const w = regionWeights(cells, half + band / 2, 0, half, band);
    expect(frameTime(0.3, w, new Map())).toBeCloseTo(0.3);
    expect(frameTime(0.3, w, new Map([['0,0', 0.5]]))).toBeCloseTo(0.4);
    expect(frameTime(0.95, w, new Map([['0,0', 0.05]]))).toBeCloseTo(0);
  });
});

describe('grid frame pixel slots', () => {
  it('round-trips every slot through a half-float alpha; alpha 1 and the clear are home', () => {
    for (let s = DECK_SLOT; s <= LAST_SLOT; s++) expect(slotOf(Math.fround(slotAlpha(s)))).toBe(s);
    expect(slotOf(1)).toBe('home'); expect(slotOf(0)).toBe('home');
    expect(slotOf(0.5 + 0.8 * (1 - 0.5))).toBe('home'); // a home transparency over a neighbour reads as home
    expect(() => slotAlpha(LAST_SLOT + 1)).toThrow(); expect(FIRST_NEIGHBOUR_SLOT).toBe(DECK_SLOT + 1);
  });
  it('gates a blend to home pixels and restores it', () => {
    const mode = new BlendMode(BlendFunction.SRC), before = mode.getShaderCode();
    const undo = gateToHome(mode);
    expect(mode.blendFunction).toBe(1000 + BlendFunction.SRC);
    const code = mode.getShaderCode();
    expect(code).toContain('wsGridFrameHome()'); expect(code.match(/\bblend\b/g)?.length).toBe(1); // one entry point for EffectPass to rename
    undo();
    expect(mode.blendFunction).toBe(BlendFunction.SRC); expect(mode.getShaderCode()).toBe(before);
  });
  it('the region grade starts neutral for every slot and sets one slot', () => {
    const effect = new RegionGradeEffect();
    expect(effect.grades.every((g) => g.x === 0 && g.y === 1 && g.z === 1)).toBe(true);
    effect.set(3, { exposure: -0.5, saturation: 1.2, contrast: 1.1 });
    expect(effect.grades[3]?.toArray()).toEqual([-0.5, 1.2, 1.1]);
  });
});
