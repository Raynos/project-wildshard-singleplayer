import { describe, expect, it } from 'vitest';
import { OneFactor, ZeroFactor } from 'three';
import { BAND_OUTSET, bandGeometry, bandMaterial } from '../src/game/grid/hazeBand';
import { RegionGradeEffect } from '../src/game/grid/frame';
import { DECK_SLOT, HIGHWAY_LOOK } from '../src/game/grid/frameModel';
import { farLook as sunscar } from '../src/shards/sunscar-dunes/look/far';

describe('SF19b one-frame looks', () => {
  it('a haze band is four edge quads 2 m out from the cell, one draw, its height as declared', () => {
    const g = bandGeometry(250, 90), position = g.getAttribute('position');
    expect(g.index?.count).toBe(24); expect(position.count).toBe(16);
    const xs = Array.from({ length: position.count }, (_, i) => Math.abs(position.getX(i)));
    expect(Math.max(...xs)).toBe(250 + BAND_OUTSET); expect(BAND_OUTSET).toBeLessThan(20);
    expect(Math.max(...Array.from({ length: position.count }, (_, i) => position.getY(i)))).toBe(90);
  });
  it('a band keeps the destination alpha (the pixel region slot) and blends colour only', () => {
    const m = bandMaterial({ colour: [1, 0.5, 0.2], height: 60, opacity: 1.4, own: 0.8 });
    expect(m.blendSrcAlpha).toBe(ZeroFactor); expect(m.blendDstAlpha).toBe(OneFactor); expect(m.depthWrite).toBe(false);
    expect(m.uniforms['uOpacity']?.value).toBe(1);
  });
  it('G94: Signal Dunes declares its warm band and dusky grade', () => {
    expect(sunscar.band.own).toBeGreaterThan(0.5); expect(sunscar.grade.tint[0]).toBeGreaterThan(sunscar.grade.tint[2]);
  });
  it('G75: the highway slot takes a grey-blue grade (less saturation, a cool tint)', () => {
    const effect = new RegionGradeEffect(); effect.set(DECK_SLOT, HIGHWAY_LOOK.grade);
    const tint = effect.tints[DECK_SLOT];
    expect(effect.grades[DECK_SLOT]?.y).toBeLessThan(1); expect(tint?.z).toBeGreaterThan(tint?.x ?? 2);
    effect.set(3, { exposure: 0, saturation: 1, contrast: 1 }); expect(effect.tints[3]?.toArray()).toEqual([1, 1, 1]);
  });
});
