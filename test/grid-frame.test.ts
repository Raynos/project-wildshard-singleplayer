import { describe, expect, it, vi } from 'vitest';
import { Color, Fog, PerspectiveCamera, Scene, WebGLRenderTarget, type Uniform } from 'three';
import { BlendFunction, BloomEffect, BrightnessContrastEffect, ChromaticAberrationEffect, Effect, EffectPass, HueSaturationEffect, LookupTexture, LUT3DEffect, NoiseEffect, ToneMappingEffect, VignetteEffect, type EffectComposer } from 'postprocessing';
import { VolumetricsEffect } from '../src/engine/core/Volumetrics';
import { RegionCinematic } from '../src/engine/render/regionCinematic';
import { GradeEffect, GradeLookEffect } from '../src/engine/core/Grade';
import { FRAME_BAND, HIGHWAY_GRADE, ROAD_SKY, dominantOwner, edgeDistance, frameFog, frameGrade, frameOwners, frameTime } from '../src/game/grid/frameModel';
import { FrameGradeEffect, GridFrame, chainKnobs, neutralLut, opacityFade, passEffects, swappableLut } from '../src/game/grid/frame';
import { ROAD_SKY_ORDER } from '../src/game/grid/roadSky';
import { frameLookOf, lookChainKind, regionChain, regionGrade } from '../src/game/grid/frameLook';
import { ENGINE_CHAIN_TUNING } from '../src/engine/render/look';
import { toLevelSpec } from '../src/game/shard/spec';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';

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

  it("E452: a live region's fog and grade own the frame inside its cell; what its weather writes is its air, then the base goes back", () => {
    const scene = new Scene(), camera = new PerspectiveCamera(), scope = new Scope('e452-live-region');
    scene.fog = new Fog(new Color(0.4, 0.5, 0.6), 10, 100);
    const feet = { x: 0, z: 0 }, home = cells[4];
    if (home === undefined) throw new Error('no home cell');
    const frame = new GridFrame({ host: { scene, camera, composer: () => { throw new Error('not built'); }, post: () => null }, scope, cells, home, half, feet: () => feet });
    // one drawn frame: the owners, the scene's before-render (the frame's air), then the home backdrop rewrites its fog
    const draw = (x: number): void => {
      feet.x = x; frame.frame();
      const before: unknown = Reflect.get(scene, 'onBeforeRender'); if (typeof before === 'function') Reflect.apply(before, scene, []);
      scene.fog?.color.setRGB(0.4, 0.5, 0.6);
    };
    frame.declare('1,0', { haze: { colour: [0.2, 0.3, 0.4] } });
    const port = frameLookOf(scene);
    if (port === null) throw new Error('the frame binds its port to its scene');
    const own = new Fog(new Color(1, 1, 1), 1, 2), grade = { exposure: 0.1, saturation: 1.2, contrast: 1.1, tint: [1.02, 1, 0.98] as const };
    expect(() => port.contribute('0,0', { fog: own })).toThrow();
    const release = port.contribute('1,0', { fog: own, grade });
    expect(own.color.toArray()).toEqual([0.2, 0.3, 0.4]); // starts from its declared base
    draw(pitch);
    expect(frame.state().air).toEqual([0.2, 0.3, 0.4]); expect(frame.state().grade).toEqual([0.1, 1.2, 1.1, 1.02, 1, 0.98]);
    own.color.multiplyScalar(0.5); // the region's weather darkens its own fog (a boss seal)
    draw(pitch);
    expect(frame.state().air).toEqual([0.1, 0.15, 0.2]); expect(own.color.toArray()).toEqual([0.2, 0.3, 0.4]);
    own.color.multiplyScalar(0.5); draw(pitch - half); // on its edge line: half its darkened air, half the road's (G242: its dawn air)
    expect(frame.state().air[0]).toBeCloseTo(0.5 * 0.1 + 0.5 * ROAD_SKY.air[0], 3);
    draw(0); // at home the home's own air and grade (its chain grades)
    expect(frame.state().air).toEqual([0.4, 0.5, 0.6]); expect(frame.state().grade).toEqual([0, 1, 1, 1, 1, 1]);
    release(); draw(pitch); // released: the declared look again
    expect(frame.state().grade).toEqual([0, 1, 1, 1, 1, 1]); expect(frame.state().air).toEqual([0.2, 0.3, 0.4]);
    scope.dispose();
    expect(frameLookOf(scene)).toBeNull();
  });

  it("E452: a level's own grade as the frame's uniform grade (Pine: richer colour, more contrast, warm)", () => {
    const pine = regionGrade(toLevelSpec(PINE_HOLLOW));
    expect(pine.saturation).toBeGreaterThan(1.1); expect(pine.contrast).toBeCloseTo(1.25, 2); expect(pine.exposure).toBeLessThan(0);
    const [r = 1, , b = 1] = pine.tint ?? [];
    expect(r).toBeGreaterThan(b);
    const flat = { saturation: 0, brightness: 0, contrast: 0, shadowTint: [1, 1, 1], highTint: [1, 1, 1], gain: [1, 1, 1] } as const;
    expect(regionGrade({ grade: flat })).toEqual({ exposure: 0, saturation: 1, contrast: 1, tint: [1, 1, 1] });
  });
});


it.each([true, false])('G226: catalogue home stays page-owned only when homeIsFrame=%s', homeIsFrame => {
  const scope = new Scope('g226-frame'), scene = new Scene(), camera = new PerspectiveCamera();
  scene.fog = new Fog(new Color(0.4, 0.5, 0.6), 10, 100);
  const home = cells[4]; if (home === undefined) throw new Error('Missing home');
  const feet = { x: 0, z: 0 };
  const gradeEffect = new GradeEffect(), saturation = new HueSaturationEffect(), contrast = new BrightnessContrastEffect();
  const effects: Effect[] = [gradeEffect, saturation, contrast];
  const pass = new EffectPass(camera, ...effects); vi.spyOn(pass, 'recompile').mockImplementation(() => undefined);
  const frame = new GridFrame({ host: { scene, camera, composer: () => legacyDouble<EffectComposer>({ passes: [pass] }),
    post: () => ({ grade: gradeEffect, saturation, contrast }) }, scope, cells, home, homeIsFrame, half, feet: () => feet });
  const own = new Fog(new Color(1, 1, 1), 1, 2), grade = { exposure: 0.2, saturation: 1.2, contrast: 1.1 };
  const declaration = { haze: { colour: [0.2, 0.3, 0.4] as const }, grade };
  frame.declare(home.instance, declaration);
  let release = (): void => undefined;
  if (homeIsFrame) expect(() => frame.contribute(home.instance, { fog: own, grade })).toThrow('home look');
  else { release = frame.contribute(home.instance, { fog: own, grade }); expect(own.color.toArray()).toEqual(declaration.haze.colour); }
  const draw = (x: number): void => {
    feet.x = x; frame.frame();
    const before: unknown = Reflect.get(scene, 'onBeforeRender'); if (typeof before === 'function') Reflect.apply(before, scene, []);
    scene.fog?.color.setRGB(0.4, 0.5, 0.6);
  };
  draw(0);
  expect(frame.state().grade).toEqual(homeIsFrame ? [0, 1, 1, 1, 1, 1] : [0.2, 1.2, 1.1, 1, 1, 1]);
  expect(frame.state().air).toEqual(homeIsFrame ? [0.4, 0.5, 0.6] : [0.2, 0.3, 0.4]);
  expect(effects.map(effect => Number(effect.blendMode.opacity.value))).toEqual(homeIsFrame ? [1, 1, 1] : [0, 0, 0]);
  draw(half);
  expect(frame.state().roadSky).toBe(0.5);
  expect(frame.state().grade[0]).toBe(homeIsFrame ? 0 : 0.1);
  expect(effects.map(effect => Number(effect.blendMode.opacity.value))).toEqual(homeIsFrame ? [0.5, 0.5, 0.5] : [0, 0, 0]);
  draw(half + 27.5);
  expect(frame.state().owner).toBeNull(); expect(frame.state().roadSky).toBe(1);
  expect(frame.state().air).toEqual([...ROAD_SKY.air]); // G242: the road's own dawn air
  release(); scope.dispose();
  expect(effects.map(effect => Number(effect.blendMode.opacity.value))).toEqual([1, 1, 1]);
  expect(passEffects(pass)).toEqual(effects); pass.dispose();
});

describe('G232: a region\'s whole grade chain on a neutral page shell', () => {
  const pine = toLevelSpec(PINE_HOLLOW);
  it('reads a level\'s grade with its look layer over it, and its curve and vibrance', () => {
    const chain = regionChain(pine, () => null);
    expect(chain.grade.saturation).toBe(pine.lookLayer?.grade.saturation ?? pine.grade.saturation);
    expect(chain.grade.contrast).toBe(pine.lookLayer?.grade.contrast ?? pine.grade.contrast);
    expect(chain.look).toEqual({ curve: pine.lookLayer?.curve, vibrance: pine.lookLayer?.vibrance });
    expect(regionChain({ grade: pine.grade }, () => null).look).toEqual({ curve: 0, vibrance: 0 });
  });
  it('the neutral LUT is the learned LUTs\' kind (a uniform swap, never new defines); another kind is refused', () => {
    const lut = neutralLut();
    expect(swappableLut(lut)).toBe(true);
    expect(swappableLut(LookupTexture.createNeutral(33))).toBe(false); // float: other defines
    expect(swappableLut(LookupTexture.createNeutral(16))).toBe(false);
    const effect = new LUT3DEffect(lut, { tetrahedralInterpolation: true });
    const defines = [...effect.defines];
    const other = neutralLut(), u = effect.uniforms.get('lut');
    if (u !== undefined) u.value = other;
    expect([...effect.defines]).toEqual(defines);
    lut.dispose(); other.dispose(); effect.dispose();
  });
  it('inside its cell the page\'s grade effects carry its chain; on the road the page\'s values are back, nothing recompiles', () => {
    const scope = new Scope('g232-chain'), scene = new Scene(), camera = new PerspectiveCamera();
    scene.fog = new Fog(new Color(0.4, 0.5, 0.6), 10, 100);
    const home = cells[4]; if (home === undefined) throw new Error('Missing home');
    const feet = { x: 0, z: 0 };
    const gradeEffect = new GradeEffect(), saturation = new HueSaturationEffect({ saturation: 0.05 }), contrast = new BrightnessContrastEffect({ brightness: 0.01, contrast: 0.02 });
    const grain = new Effect('grain', 'void mainImage(const in vec4 i, const in vec2 uv, out vec4 o) { o = i; }');
    const pass = new EffectPass(camera, saturation, contrast, gradeEffect, grain), recompile = vi.spyOn(pass, 'recompile').mockImplementation(() => undefined);
    const frame = new GridFrame({ host: { scene, camera, composer: () => legacyDouble<EffectComposer>({ passes: [pass] }),
      post: () => ({ grade: gradeEffect, saturation, contrast }) }, scope, cells, home, homeIsFrame: false, half, feet: () => feet });
    const port = frameLookOf(scene); if (port === null) throw new Error('no port');
    expect(port.post?.()).toBeNull(); // before install: nothing carried
    frame.frame(); // install
    const list = passEffects(pass); if (list === null) throw new Error('no list');
    const look = list.find((e) => e instanceof GradeLookEffect), lutFx = list.find((e) => e instanceof LUT3DEffect);
    if (look === undefined || lutFx === undefined) throw new Error('the look layer and the LUT are compiled in at install');
    expect(list.indexOf(look)).toBe(list.indexOf(gradeEffect) + 1); expect(list.indexOf(lutFx)).toBe(list.indexOf(gradeEffect) + 2);
    expect(list[list.length - 1]).toBeInstanceOf(FrameGradeEffect);
    expect(recompile).toHaveBeenCalledTimes(1);
    expect(port.post?.()?.hueSat).toBe(saturation);
    const regionLut = neutralLut(); let loaded: typeof regionLut | null = null;
    const chain = regionChain(pine, () => loaded);
    const release = port.contribute('1,0', { fog: new Fog(new Color(1, 1, 1), 1, 2), grade: regionGrade(pine), chain });
    const opacities = (): number[] => [saturation, contrast, gradeEffect, look, lutFx].map((e) => Number(e.blendMode.opacity.value));
    feet.x = pitch; frame.frame();
    const s = frame.state();
    expect(s.chain.owner).toBe('1,0'); expect(s.chain.weight).toBe(1); expect(s.chain.lut).toBe(false);
    expect(s.grade).toEqual([0, 1, 1, 1, 1, 1]); // its uniform grade is neutral: the chain grades it
    expect(s.chain.values).toEqual([chain.grade.saturation, chain.grade.brightness, chain.grade.contrast, chain.look.curve, chain.look.vibrance].map((n) => Math.round(n * 1e4) / 1e4));
    expect(opacities()).toEqual([1, 1, 1, 1, 0]); // no LUT loaded yet
    loaded = regionLut; frame.frame();
    expect(frame.state().chain.lut).toBe(true); expect(lutFx.uniforms.get('lut')?.value).toBe(regionLut); expect(opacities()).toEqual([1, 1, 1, 1, 1]);
    saturation.saturation = 0.3; // its sky clock turns the saturation with the hour
    feet.x = pitch - half; frame.frame(); // on its edge line: half
    expect(opacities()).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]); expect(saturation.saturation).toBe(0.3);
    feet.x = half + 27.5; frame.frame(); // on the road: the page's values back, all off
    expect(frame.state().chain.owner).toBeNull();
    expect(opacities()).toEqual([0, 0, 0, 0, 0]);
    expect([saturation.saturation, contrast.brightness, contrast.contrast]).toEqual([0.05, 0.01, 0.02]);
    expect(lutFx.uniforms.get('lut')?.value).not.toBe(regionLut); expect(look.values).toEqual({ curve: 0, vibrance: 0 });
    feet.x = pitch; frame.frame(); expect(frame.state().chain.owner).toBe('1,0');
    release(); // left while inside: dropped at once (its LUT may be freed next)
    expect(frame.state().chain.owner).toBeNull(); expect(saturation.saturation).toBe(0.05); expect(lutFx.uniforms.get('lut')?.value).not.toBe(regionLut);
    expect(recompile).toHaveBeenCalledTimes(1); // swaps are uniforms
    scope.dispose();
    expect(passEffects(pass)).toEqual([saturation, contrast, gradeEffect, grain]);
    expect([saturation, contrast, gradeEffect].map((e) => Number(e.blendMode.opacity.value))).toEqual([1, 1, 1]);
    regionLut.dispose(); pass.dispose();
  });
});

describe('SF63: a carried region\'s engine chain knobs (bloom, vignette, god rays)', () => {
  const pine = toLevelSpec(PINE_HOLLOW);
  it('its chain kind is its look\'s declared one, cinematic without one, none for a replace look', () => {
    expect(lookChainKind({ chain: 'clean' })).toBe('clean');
    expect(lookChainKind({})).toBe('cinematic');
    expect(lookChainKind(null)).toBe('cinematic');
    expect(lookChainKind({ mode: 'replace' })).toBeUndefined();
    expect(regionChain(pine, () => null).post).toBeUndefined();
    const post = regionChain(pine, () => null, 'cinematic').post;
    expect(post).toEqual({ kind: 'cinematic', bloomIntensity: pine.lookLayer?.grade.bloomIntensity ?? pine.grade.bloomIntensity,
      bloomThreshold: pine.lookLayer?.grade.bloomThreshold ?? pine.grade.bloomThreshold, bloomSmoothing: 0.3, vignette: 0.55, rays: 1, ao: true,
      volumetric: { strength: pine.atmosphere.volumetric?.strength ?? 0.55, sunColor: pine.atmosphere.volumetricSunColor } });
    expect(regionChain(pine, () => null, 'clean').post?.volumetric).toBeUndefined();
    // SF63: its running tier's knobs: no god rays and no AO where its own boot would draw none
    expect(regionChain(pine, () => null, 'clean', { godRays: false, ao: false }).post).toMatchObject({ rays: 0, ao: false });
    expect(regionChain(pine, () => null, 'clean', { ao: true, godRays: undefined }).post).toMatchObject({ rays: ENGINE_CHAIN_TUNING.clean.rays, ao: true });
    expect(ENGINE_CHAIN_TUNING.clean).toEqual({ rays: 0.12, bloomSmoothing: 0.08, vignette: 0.35 });
  });
  it('moves the page\'s knobs toward the region\'s by the weight, keeps what its clock writes into the rays, and restores', () => {
    const bloom = new BloomEffect({ intensity: 0.4, luminanceThreshold: 1, luminanceSmoothing: 0.08 }), vignette = new VignetteEffect({ darkness: 0.35 });
    const rays = new Effect('rays', 'void mainImage(const in vec4 i, const in vec2 uv, out vec4 o) { o = i; }');
    rays.blendMode.opacity.value = 0.12;
    const post = { grade: new GradeEffect(), saturation: new HueSaturationEffect(), contrast: new BrightnessContrastEffect(), bloom, vignette, rays };
    expect(chainKnobs(post, undefined)).toBeNull();
    const knobs = chainKnobs(post, { kind: 'cinematic', bloomIntensity: 0.6, bloomThreshold: 0.8, bloomSmoothing: 0.3, vignette: 0.55, rays: 1, ao: true });
    if (knobs === null) throw new Error('no knobs');
    const read = (): number[] => [bloom.intensity, bloom.luminanceMaterial.threshold, bloom.luminanceMaterial.smoothing, vignette.darkness, Number(rays.blendMode.opacity.value)].map((n) => Math.round(n * 1e4) / 1e4);
    knobs.weight(1); expect(read()).toEqual([0.6, 0.8, 0.3, 0.55, 1]);
    knobs.weight(0.5); expect(read()).toEqual([0.5, 0.9, 0.19, 0.45, 0.56]);
    rays.blendMode.opacity.value = 0.7; // its clock turns the rays with the hour
    knobs.weight(1); expect(read()[4]).toBe(0.7);
    knobs.weight(0); expect(read()).toEqual([0.4, 1, 0.08, 0.35, 0.12]);
    knobs.weight(1); knobs.restore(); expect(read()).toEqual([0.4, 1, 0.08, 0.35, 0.12]);
    bloom.dispose(); vignette.dispose(); rays.dispose();
  });
  it('fades the page\'s AO out for a region whose own frame draws none, skipping the pass at full weight, and restores', () => {
    const ao = { configuration: { intensity: 2.5 }, enabled: true };
    const post = { grade: new GradeEffect(), saturation: new HueSaturationEffect(), contrast: new BrightnessContrastEffect(), ao };
    const base = { kind: 'clean', bloomIntensity: 0.4, bloomThreshold: 1, bloomSmoothing: 0.08, vignette: 0.35, rays: 0 } as const;
    const kept = chainKnobs(post, { ...base, ao: true }); if (kept === null) throw new Error('no knobs');
    kept.weight(1); expect([ao.configuration.intensity, ao.enabled]).toEqual([2.5, true]);
    const none = chainKnobs(post, { ...base, ao: false }); if (none === null) throw new Error('no knobs');
    none.weight(0.5); expect([ao.configuration.intensity, ao.enabled]).toEqual([1.25, true]);
    none.weight(1); expect([ao.configuration.intensity, ao.enabled]).toEqual([0, false]);
    none.weight(0); expect([ao.configuration.intensity, ao.enabled]).toEqual([2.5, true]);
    none.weight(1); none.restore(); expect([ao.configuration.intensity, ao.enabled]).toEqual([2.5, true]);
  });
});

describe('SF63 follow-up: a cinematic region\'s shafts, fringe and grain on the clean page shell', () => {
  const pine = toLevelSpec(PINE_HOLLOW);
  it('compiled in once at install, neutral; carried by the region\'s weight with its clock on the shafts; parked and neutral on the road', () => {
    const scope = new Scope('sf63-cine'), scene = new Scene(), camera = new PerspectiveCamera();
    scene.fog = new Fog(new Color(0.4, 0.5, 0.6), 10, 100);
    const home = cells[4]; if (home === undefined) throw new Error('Missing home');
    const feet = { x: 0, z: 0 };
    const gradeEffect = new GradeEffect(), saturation = new HueSaturationEffect(), contrast = new BrightnessContrastEffect();
    const bloom = new BloomEffect();
    const pass = new EffectPass(camera, bloom, saturation, contrast, gradeEffect), recompile = vi.spyOn(pass, 'recompile').mockImplementation(() => undefined);
    const target = new WebGLRenderTarget(200, 100); // the scene target of a page on the depth slices (E142)
    const frame = new GridFrame({ host: { scene, camera, composer: () => legacyDouble<EffectComposer>({ passes: [pass], inputBuffer: target }),
      post: () => ({ grade: gradeEffect, saturation, contrast, bloom }), slices: () => true, cinematic: () => new RegionCinematic(camera) }, scope, cells, home, homeIsFrame: false, half, feet: () => feet });
    const port = frameLookOf(scene); if (port === null) throw new Error('no port');
    frame.frame(); // install
    const list = passEffects(pass); if (list === null) throw new Error('no list');
    const chroma = list.find((e) => e instanceof ChromaticAberrationEffect), vol = list.find((e) => e instanceof VolumetricsEffect), grain = list.find((e) => e instanceof NoiseEffect);
    const lutFx = list.find((e) => e instanceof LUT3DEffect);
    if (!(chroma instanceof ChromaticAberrationEffect) || !(vol instanceof VolumetricsEffect) || grain === undefined || lutFx === undefined) throw new Error('the shafts, fringe and grain are compiled in at install');
    expect(list.indexOf(chroma)).toBe(0); expect(list.indexOf(vol)).toBe(1); expect(list.indexOf(grain)).toBe(list.indexOf(lutFx) + 1);
    expect(list[list.length - 1]).toBeInstanceOf(FrameGradeEffect);
    expect(recompile).toHaveBeenCalledTimes(1);
    pass.setSize(200, 100); // the march target stays parked at 1×1
    const fx = () => frame.state().chain.fx;
    expect(fx()).toMatchObject({ carrier: null, weight: 0, vol: [0, 0.55], chroma: 0, grain: 0, target: [1, 1], depth: 'scene', sceneDepth: false });
    expect(target.depthTexture).toBeNull();
    // the region's clock drives its own shafts, kept while it does not carry them
    const post = port.post?.('1,0'), other = port.post?.('-1,0');
    if (post?.vol === undefined || post.vol === null || other?.vol === undefined || other.vol === null) throw new Error('the port hands each region its shafts');
    post.vol.setStrength(0.8);
    expect(vol.strength()).toBe(0.55);
    const release = port.contribute('1,0', { fog: new Fog(new Color(1, 1, 1), 1, 2), grade: regionGrade(pine), chain: regionChain(pine, () => null, 'cinematic') });
    feet.x = pitch; frame.frame();
    const inside = fx(); if (inside === null) throw new Error('no fx');
    expect(inside).toMatchObject({ carrier: '1,0', weight: 1, vol: [1, 0.8], chroma: 0.0006, grain: 0.12 });
    expect(inside.target?.[0]).toBeGreaterThan(1); // allocated only now
    expect(inside.sceneDepth).toBe(true); expect(target.depthTexture).not.toBeNull();
    post.vol.setStrength(0.3); other.vol.setStrength(2); // a neighbour's clock never reaches the carried shafts
    expect(vol.strength()).toBe(0.3);
    feet.x = pitch - half; frame.frame(); // its edge line: half
    expect(fx()).toMatchObject({ weight: 0.5, vol: [0.5, 0.3], chroma: 0.0003, grain: 0.06 });
    feet.x = half + 27.5; frame.frame(); // the road: parked, neutral, the march's light back
    expect(fx()).toMatchObject({ carrier: null, weight: 0, vol: [0, 0.55], chroma: 0, grain: 0, target: [1, 1], sceneDepth: false });
    expect(target.depthTexture).toBeNull();
    feet.x = pitch; frame.frame(); expect(fx()).toMatchObject({ carrier: '1,0', vol: [1, 0.3] }); // its last clock write again
    release(); expect(fx()).toMatchObject({ carrier: null, target: [1, 1] });
    // a clean-chain region carries none of it
    const clean = port.contribute('1,0', { fog: null, chain: regionChain(pine, () => null, 'clean') });
    frame.frame(); expect(fx()).toMatchObject({ carrier: null, weight: 0 }); clean();
    expect(recompile).toHaveBeenCalledTimes(1); // all of it uniforms
    scope.dispose();
    expect(passEffects(pass)).toEqual([bloom, saturation, contrast, gradeEffect]);
    pass.dispose(); target.dispose();
  });
});

describe('SF63: a \'replace\' region\'s own chain on the page shell (its knobs and its display transform)', () => {
  const pine = toLevelSpec(PINE_HOLLOW);
  it('carries its knobs with a neutral engine grade, places its display after the tone mapping while resident, and fades one into the other', () => {
    const scope = new Scope('sf63-display'), scene = new Scene(), camera = new PerspectiveCamera();
    scene.fog = new Fog(new Color(0.4, 0.5, 0.6), 10, 100);
    const home = cells[4]; if (home === undefined) throw new Error('Missing home');
    const feet = { x: 0, z: 0 };
    const gradeEffect = new GradeEffect(), saturation = new HueSaturationEffect(), contrast = new BrightnessContrastEffect(), tone = new ToneMappingEffect();
    const bloom = new BloomEffect({ intensity: 0.4 }), vignette = new VignetteEffect({ darkness: 0.35 });
    const pass = new EffectPass(camera, bloom, vignette, tone, saturation, contrast, gradeEffect), recompile = vi.spyOn(pass, 'recompile').mockImplementation(() => undefined);
    const frame = new GridFrame({ host: { scene, camera, composer: () => legacyDouble<EffectComposer>({ passes: [pass] }),
      post: () => ({ grade: gradeEffect, saturation, contrast, bloom, vignette, tone }) }, scope, cells, home, homeIsFrame: false, half, feet: () => feet });
    const port = frameLookOf(scene); if (port === null) throw new Error('no port');
    frame.frame(); // install (its blend change flags the pass too; both before the first draw: one compile)
    expect(tone.blendMode.blendFunction).toBe(BlendFunction.NORMAL);
    const installed = recompile.mock.calls.length;
    const display = new Effect('display', 'void mainImage(const in vec4 i, const in vec2 uv, out vec4 o) { o = i; }', { blendFunction: BlendFunction.NORMAL });
    const chain = regionChain(pine, () => null, undefined, { ao: true }, { bloom: null, vignette: 0, rays: 0, ao: false, display: () => display });
    expect(chain.grade).toMatchObject({ saturation: 0, brightness: 0, contrast: 0, gamma: 1 }); expect(chain.look).toEqual({ curve: 0, vibrance: 0 });
    const release = port.contribute('1,0', { fog: null, chain });
    const list = passEffects(pass); if (list === null) throw new Error('no list');
    expect(list.indexOf(display)).toBe(list.indexOf(tone) + 1); // placed as it loads: one recompile, on the road
    expect(recompile).toHaveBeenCalledTimes(installed + 1);
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value]).toEqual([0, 1]);
    feet.x = pitch; frame.frame(); // inside: its display, no tone mapping, its knobs
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value]).toEqual([1, 0]);
    expect([bloom.intensity, vignette.darkness]).toEqual([0, 0]);
    feet.x = pitch - half; frame.frame(); // the edge line: half and half
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value]).toEqual([0.5, 0.5]);
    feet.x = half + 27.5; frame.frame(); // the road: the page's
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value]).toEqual([0, 1]);
    expect([bloom.intensity, vignette.darkness]).toEqual([0.4, 0.35]);
    expect(recompile).toHaveBeenCalledTimes(installed + 1); // crossings move opacities only
    release();
    expect(passEffects(pass)?.includes(display)).toBe(false); expect(recompile).toHaveBeenCalledTimes(installed + 2);
    scope.dispose();
    expect(tone.blendMode.blendFunction).toBe(BlendFunction.SRC);
    expect(passEffects(pass)).toEqual([bloom, vignette, tone, saturation, contrast, gradeEffect]);
    pass.dispose();
  });
});
