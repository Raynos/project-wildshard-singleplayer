import { describe, expect, it } from 'vitest';
import { OneFactor, ZeroFactor } from 'three';
import { BAND_OUTSET, bandGeometry, bandMaterial } from '../src/game/grid/hazeBand';
import { FrameGradeEffect } from '../src/game/grid/frame';
import { HIGHWAY_LOOK } from '../src/game/grid/frameModel';
import { farLook as sunscar } from '../src/shards/sunscar-dunes/generators/farLook';
import { farLook as nineDragon, skylineAt } from '../src/shards/nine-dragon-stack/look/far';
// oxlint-disable-next-line import/no-nodejs-modules -- reads the committed far.json.
import { readFileSync } from 'node:fs';

describe('SF19b one-frame looks', () => {
  it('a haze band is four edge quads 2 m out from the cell, one draw, its height as declared', () => {
    const g = bandGeometry(250, 90), position = g.getAttribute('position');
    expect(g.index?.count).toBe(24); expect(position.count).toBe(16);
    const xs = Array.from({ length: position.count }, (_, i) => Math.abs(position.getX(i)));
    expect(Math.max(...xs)).toBe(250 + BAND_OUTSET); expect(BAND_OUTSET).toBeLessThan(20);
    expect(Math.max(...Array.from({ length: position.count }, (_, i) => position.getY(i)))).toBe(90);
  });
  it('a band keeps the destination alpha and blends colour only', () => {
    const m = bandMaterial({ colour: [1, 0.5, 0.2], height: 60, opacity: 1.4, own: 0.8 });
    expect(m.blendSrcAlpha).toBe(ZeroFactor); expect(m.blendDstAlpha).toBe(OneFactor); expect(m.depthWrite).toBe(false);
    expect(m.uniforms['uOpacity']?.value).toBe(1);
  });
  it('G94: Signal Dunes declares its warm band and dusky grade', () => {
    expect(sunscar.band.own).toBeGreaterThan(0.5); expect(sunscar.grade.tint[0]).toBeGreaterThan(sunscar.grade.tint[2]);
  });
  it('G95: Nine Dragon keeps its dusk through a violet grade and a pale border fog; its baked proxy carries both', () => {
    expect(nineDragon.band.own).toBeGreaterThan(0.5); expect(nineDragon.grade.exposure).toBeLessThan(0);
    expect(nineDragon.grade.tint[1]).toBeLessThan(Math.min(nineDragon.grade.tint[0], nineDragon.grade.tint[2])); // dusk violet
    const baked = JSON.parse(readFileSync('public/assets/baked/nine-dragon-stack/far.json', 'utf8')) as { look: { band?: unknown; grade?: unknown } };
    expect(baked.look.band).toEqual(nineDragon.band); expect(baked.look.grade).toEqual(nineDragon.grade);
    // its skyline: road-level forecourt at the border, a street canyon at every edge midpoint, towers between
    for (const [x, z] of [[0, -245], [245, 0], [0, 245], [-245, 0]] as const) expect(skylineAt(x, z)).toBeLessThan(1);
    for (const [x, z] of [[0, -200], [200, 0], [0, 200], [-200, 0]] as const) expect(skylineAt(x, z)).toBeLessThan(4);
    expect(skylineAt(-120, -120)).toBeGreaterThan(15); expect(skylineAt(-10, -10)).toBeLessThan(0); // the Yamen Well
  });
  it('G75: the road look takes a grey-blue grade (less saturation, a cool tint)', () => {
    const effect = new FrameGradeEffect(); effect.set(HIGHWAY_LOOK.grade);
    expect(effect.grade.y).toBeLessThan(1); expect(effect.tint.z).toBeGreaterThan(effect.tint.x);
    effect.set({ exposure: 0, saturation: 1, contrast: 1 }); expect(effect.tint.toArray()).toEqual([1, 1, 1]);
  });
});
