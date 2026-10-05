import { describe, expect, it } from 'vitest';
import { Fog, PerspectiveCamera, Scene, type Uniform } from 'three';
import { BlendFunction, Effect, EffectPass } from 'postprocessing';
import { FRAME_BAND, HIGHWAY_GRADE, dominantOwner, edgeDistance, frameFog, frameGrade, frameOwners, frameTime } from '../src/game/grid/frameModel';
import { FrameGradeEffect, GridFrame, opacityFade, passEffects } from '../src/game/grid/frame';
import { ROAD_SKY_ORDER } from '../src/game/grid/roadSky';
import { Scope } from '../src/engine/app/scope';

// SHARD-PLATFORM SF19a re-aimed by G158: the shard the player stands in owns the whole frame, the road look the road
const pitch = 555, half = 250;
const cells = [-1, 0, 1].flatMap((cx) => [-1, 0, 1].map((cz) => ({ instance: `${String(cx)},${String(cz)}`, origin: { x: cx * pitch, z: cz * pitch } })));

describe('grid frame owner', () => {
  it('inside a cell its shard owns the frame; on the road deck and at a crossroads the road look does', () => {
    const inside = frameOwners(cells, 10, -40, half);
    expect([...inside.cells]).toEqual([['0,0', 1]]); expect(inside.highway).toBe(0); expect(dominantOwner(inside)).toBe('0,0');
    // the road band is 20–35 m past the cell edge: the road look owns all of it
    for (const out of [20, 27.5, 35]) { const w = frameOwners(cells, half + out, 0, half); expect(w.cells.size).toBe(0); expect(w.highway).toBe(1); }
    const crossroads = frameOwners(cells, pitch / 2, pitch / 2, half);
    expect(crossroads.highway).toBe(1); expect(dominantOwner(crossroads)).toBeNull();
    const neighbour = frameOwners(cells, pitch + 30, 12, half);
    expect([...neighbour.cells]).toEqual([['1,0', 1]]);
  });
  it('blends smoothly across a 16 m band centred on the cell edge: half and half on the line, no step anywhere', () => {
    const line = frameOwners(cells, half, 100, half);
    expect(line.cells.get('0,0')).toBeCloseTo(0.5); expect(line.highway).toBeCloseTo(0.5);
    expect(frameOwners(cells, half - FRAME_BAND / 2, 0, half).cells.get('0,0')).toBe(1);
    expect(frameOwners(cells, half + FRAME_BAND / 2, 0, half).highway).toBe(1);
    let last = 1;
    for (let x = half - 12; x <= half + 12; x += 0.25) {
      const w = frameOwners(cells, x, 0, half).cells.get('0,0') ?? 0;
      expect(w).toBeLessThanOrEqual(last); expect(last - w).toBeLessThan(0.05); last = w; // monotone, never a jump
    }
    for (let x = -800; x <= 800; x += 37) for (let z = -800; z <= 800; z += 41) {
      const w = frameOwners(cells, x, z, half);
      expect([...w.cells.values()].reduce((a, b) => a + b, 0) + w.highway).toBeCloseTo(1, 9);
      expect(w.cells.size).toBeLessThanOrEqual(1); // the 55 m strip: two cells never share a frame
    }
  });
  it('the edge distance is signed: inside negative, outside positive, round the corner', () => {
    const c = cells[4]; if (c === undefined) throw new Error('no centre cell');
    expect(edgeDistance(c, 0, 0, half)).toBe(-250); expect(edgeDistance(c, 240, 0, half)).toBe(-10);
    expect(edgeDistance(c, 260, 0, half)).toBe(10); expect(edgeDistance(c, 253, 254, half)).toBe(5);
  });
  it('air: the home fog at home, a neighbour owner haze inside it, a desaturated home air on the road', () => {
    const home = { instance: '0,0', fog: [0.8, 0.6, 0.4] as const }, hazes = new Map([['1,0', [0.1, 0.2, 0.9] as const]]);
    expect(frameFog(frameOwners(cells, 0, 0, half), home, hazes)).toEqual([0.8, 0.6, 0.4]);
    expect(frameFog(frameOwners(cells, pitch, 0, half), home, hazes)).toEqual([0.1, 0.2, 0.9]);
    const deck = frameFog(frameOwners(cells, pitch / 2, pitch / 2, half), home, hazes);
    expect(deck[0]).toBeCloseTo(0.7); expect(deck[1]).toBeCloseTo(0.6); expect(deck[2]).toBeCloseTo(0.5);
  });
  it('grade: neutral at home (its own chain grades), the owner declared grade inside a neighbour, G75 on the road', () => {
    const dusk = { exposure: -0.2, saturation: 1.1, contrast: 1.05, tint: [1.08, 0.94, 0.8] as const }, grades = new Map([['1,0', dusk]]);
    expect(frameGrade(frameOwners(cells, 0, 0, half), '0,0', grades)).toEqual({ exposure: 0, saturation: 1, contrast: 1, tint: [1, 1, 1] });
    expect(frameGrade(frameOwners(cells, pitch, 0, half), '0,0', grades)).toEqual(dusk);
    const road = frameGrade(frameOwners(cells, pitch / 2, 0, half), '0,0', grades);
    expect(road.saturation).toBe(HIGHWAY_GRADE.saturation); expect(road.tint[2]).toBeGreaterThan(road.tint[0]);
    const line = frameGrade(frameOwners(cells, pitch - half, 0, half), '0,0', grades);
    expect(line.exposure).toBeCloseTo(-0.1); expect(line.saturation).toBeCloseTo(0.95);
  });
  it('time: the world clock unless a weighted owner declares one, the short way round midnight', () => {
    const w = frameOwners(cells, half, 0, half);
    expect(frameTime(0.3, w, new Map())).toBeCloseTo(0.3);
    expect(frameTime(0.3, w, new Map([['0,0', 0.5]]))).toBeCloseTo(0.4);
    expect(frameTime(0.95, w, new Map([['0,0', 0.05]]))).toBeCloseTo(0);
  });
});

describe('grid frame grade pieces', () => {
  it('the frame grade starts neutral and sets one uniform grade', () => {
    const effect = new FrameGradeEffect();
    expect(effect.grade.toArray()).toEqual([0, 1, 1]); expect(effect.tint.toArray()).toEqual([1, 1, 1]);
    effect.set({ exposure: -0.5, saturation: 1.2, contrast: 1.1, tint: [1, 0.9, 0.8] });
    expect(effect.grade.toArray()).toEqual([-0.5, 1.2, 1.1]); expect(effect.tint.toArray()).toEqual([1, 0.9, 0.8]);
    expect(effect.getFragmentShader()).not.toContain('inputBuffer'); // no per-pixel region read
  });
  it('the home grade fades by its weight, adopts an opacity someone else set, and restores on dispose', () => {
    const a = new Effect('A', 'void mainImage(const in vec4 i, const in vec2 uv, out vec4 o) { o = i; }', { blendFunction: BlendFunction.NORMAL, uniforms: new Map<string, Uniform>() });
    a.blendMode.opacity.value = 0.8;
    const fade = opacityFade([a]);
    fade.weight(0.5); expect(a.blendMode.opacity.value).toBeCloseTo(0.4);
    fade.weight(0); expect(a.blendMode.opacity.value).toBe(0);
    a.blendMode.opacity.value = 0.6; fade.weight(0.5); expect(a.blendMode.opacity.value).toBeCloseTo(0.3);
    fade.dispose(); expect(a.blendMode.opacity.value).toBeCloseTo(0.6);
  });
  it('reads the pass\'s own effect list, so the appended frame grade is drawn (a copy dropped it, SF19a proof)', () => {
    const a = new Effect('A', 'void mainImage(const in vec4 i, const in vec2 uv, out vec4 o) { o = i; }', { blendFunction: BlendFunction.NORMAL, uniforms: new Map<string, Uniform>() });
    const pass = new EffectPass(new PerspectiveCamera(), a), grade = new FrameGradeEffect();
    const list = passEffects(pass);
    if (list === null) throw new Error('no effect list');
    list.push(grade);
    expect(passEffects(pass)).toBe(list); expect(passEffects(pass)).toContain(grade);
  });
  it('G165: on the road the road sky covers the home sky (full), inside a cell it is not drawn, blended across the band', () => {
    const scene = new Scene(), camera = new PerspectiveCamera(), scope = new Scope('g165-road-sky');
    scene.fog = new Fog(0x88aacc, 10, 100);
    const feet = { x: 0, z: 0 }, home = cells[4];
    if (home === undefined) throw new Error('no home cell');
    const frame = new GridFrame({ host: { scene, camera, composer: () => { throw new Error('not built'); }, post: () => null }, scope, cells, home, half, feet: () => feet });
    const sky = scene.getObjectByName('road-sky');
    expect(sky?.renderOrder).toBe(ROAD_SKY_ORDER);
    const at = (x: number, z: number): number => { feet.x = x; feet.z = z; frame.frame(); return frame.state().roadSky; };
    expect(at(0, 0)).toBe(0); expect(sky?.visible).toBe(false);          // inside the home cell: its own sky
    expect(at(half + 27.5, 0)).toBe(1); expect(sky?.visible).toBe(true); // mid-strip on the road
    expect(at(half, 0)).toBeCloseTo(0.5, 2);                            // on the cell edge: half and half
    expect(at(pitch, 0)).toBe(0);                                       // inside a neighbour: no road sky
    scope.dispose();
    expect(scene.getObjectByName('road-sky')).toBeUndefined();
  });
});
