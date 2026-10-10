// op-frame21 (E435, SF63 / G158): a look's own post composite (`ExtendLook.cell`) runs in the grid frame while its region
// carries it: its display after the shell's tone mapping, its side passes before the colour pass, both faded / run by the
// cell's owner weight; the row that turns it on defaults off.
import { describe, expect, it, vi } from 'vitest';
import { Color, Fog, PerspectiveCamera, Scene } from 'three';
import { BlendFunction, BloomEffect, BrightnessContrastEffect, Effect, EffectPass, HueSaturationEffect, Pass, ToneMappingEffect, VignetteEffect, type EffectComposer } from 'postprocessing';
import { GradeEffect } from '../src/engine/core/Grade';
import { GridFrame, passEffects } from '../src/game/grid/frame';
import { frameLookOf, regionChain, wholeChainKnobs } from '../src/game/grid/frameLook';
import { setting } from '../src/engine/ui/Settings';
import { toLevelSpec } from '../src/game/shard/spec';
import { PINE_HOLLOW } from '../src/shards/pine-hollow/manifest';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';
import { SkyNeutralToneEffect } from '../src/shards/far-reach/look/neutralTone';

const pitch = 555, half = 250;
const cells = [-1, 0, 1].flatMap((cx) => [-1, 0, 1].map((cz) => ({ instance: `${String(cx)},${String(cz)}`, origin: { x: cx * pitch, z: cz * pitch } })));

/** a side pass as a composite declares one: it renders into its own target, never swaps */
class SidePass extends Pass { constructor() { super('side'); this.needsSwap = false; } }

describe('op-frame21 grid cell composite', () => {
  it('defaults off', () => { expect(setting('gridCellComposite')).toBe('off'); });

  it('places a region\'s composite while resident, runs it only while its cell carries the frame, and removes it on release', () => {
    const scope = new Scope('frame21'), scene = new Scene(), camera = new PerspectiveCamera();
    scene.fog = new Fog(new Color(0.4, 0.5, 0.6), 10, 100);
    const home = cells[4]; if (home === undefined) throw new Error('Missing home');
    const feet = { x: 0, z: 0 };
    const gradeEffect = new GradeEffect(), saturation = new HueSaturationEffect(), contrast = new BrightnessContrastEffect(), tone = new ToneMappingEffect();
    const bloom = new BloomEffect({ intensity: 0.4 }), vignette = new VignetteEffect({ darkness: 0.35 });
    const pass = new EffectPass(camera, bloom, vignette, tone, saturation, contrast, gradeEffect), recompile = vi.spyOn(pass, 'recompile').mockImplementation(() => undefined);
    const passes: Pass[] = [pass];
    const composer = legacyDouble<EffectComposer>({ passes,
      addPass: (p: Pass, at?: number) => { passes.splice(at ?? passes.length, 0, p); },
      removePass: (p: Pass) => { const i = passes.indexOf(p); if (i !== -1) passes.splice(i, 1); } });
    const frame = new GridFrame({ host: { scene, camera, composer: () => composer,
      post: () => ({ grade: gradeEffect, saturation, contrast, bloom, vignette, tone }) }, scope, cells, home, homeIsFrame: false, half, feet: () => feet });
    const port = frameLookOf(scene); if (port?.composite === undefined) throw new Error('no composite port');
    frame.frame(); // install
    const installed = recompile.mock.calls.length;
    // a composite that is its whole chain: the carried engine chain is neutral, no bloom, vignette or rays of the engine's
    const chain = regionChain(toLevelSpec(PINE_HOLLOW), () => null, undefined, { ao: true }, wholeChainKnobs(true));
    expect(chain.grade).toMatchObject({ saturation: 0, brightness: 0, contrast: 0, gamma: 1 });
    expect(chain.post).toMatchObject({ bloomIntensity: 0, vignette: 0, rays: 0, ao: true }); expect(chain.post?.display).toBeUndefined();
    const releaseLook = port.contribute('1,0', { fog: null, chain });
    const display = new Effect('composite', 'void mainImage(const in vec4 i, const in vec2 uv, out vec4 o) { o = i; }', { blendFunction: BlendFunction.SRC });
    const side = new SidePass(), dispose = vi.spyOn(side, 'dispose');
    const release = port.composite('1,0', { display, passes: [side] });
    const list = passEffects(pass); if (list === null) throw new Error('no list');
    expect(list.indexOf(display)).toBe(list.indexOf(tone) + 1); // after the tone mapping, as it loads: one recompile
    expect(passes.indexOf(side)).toBe(passes.indexOf(pass) - 1); // right before the colour pass
    expect(display.blendMode.blendFunction).toBe(BlendFunction.NORMAL);
    expect(recompile).toHaveBeenCalledTimes(installed + 1);
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value, side.enabled]).toEqual([0, 1, false]);
    feet.x = pitch; frame.frame(); // inside: its composite alone, its pass running
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value, side.enabled]).toEqual([1, 0, true]);
    expect([bloom.intensity, vignette.darkness]).toEqual([0, 0]);
    feet.x = pitch - half; frame.frame(); // the 16 m edge band's centre line: half and half
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value, side.enabled]).toEqual([0.5, 0.5, true]);
    feet.x = half + 27.5; frame.frame(); // the road: the page's own, its pass idle
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value, side.enabled]).toEqual([0, 1, false]);
    expect([bloom.intensity, vignette.darkness]).toEqual([0.4, 0.35]);
    expect(recompile).toHaveBeenCalledTimes(installed + 1); // crossings move opacities only
    release();
    expect(passEffects(pass)?.includes(display)).toBe(false); expect(passes.includes(side)).toBe(false); expect(dispose).toHaveBeenCalled();
    releaseLook();
    scope.dispose();
    expect(passEffects(pass)).toEqual([bloom, vignette, tone, saturation, contrast, gradeEffect]);
    pass.dispose();
  });

  it('a composite placed before the install is placed by it', () => {
    const scope = new Scope('frame21-late'), scene = new Scene(), camera = new PerspectiveCamera();
    const home = cells[4]; if (home === undefined) throw new Error('Missing home');
    const gradeEffect = new GradeEffect(), saturation = new HueSaturationEffect(), contrast = new BrightnessContrastEffect(), tone = new ToneMappingEffect();
    const pass = new EffectPass(camera, tone, saturation, contrast, gradeEffect);
    vi.spyOn(pass, 'recompile').mockImplementation(() => undefined);
    const passes: Pass[] = [pass];
    let built = false;
    const composer = legacyDouble<EffectComposer>({ passes, addPass: (p: Pass, at?: number) => { passes.splice(at ?? passes.length, 0, p); }, removePass: () => undefined });
    const frame = new GridFrame({ host: { scene, camera, composer: () => { if (!built) throw new Error('not built'); return composer; },
      post: () => ({ grade: gradeEffect, saturation, contrast, tone }) }, scope, cells, home, homeIsFrame: false, half, feet: () => ({ x: pitch, z: 0 }) });
    const port = frameLookOf(scene); if (port?.composite === undefined) throw new Error('no composite port');
    port.contribute('1,0', { fog: null, chain: regionChain(toLevelSpec(PINE_HOLLOW), () => null, undefined, { ao: true }, wholeChainKnobs(true)) });
    const display = new Effect('composite', 'void mainImage(const in vec4 i, const in vec2 uv, out vec4 o) { o = i; }');
    const side = new SidePass();
    port.composite('1,0', { display, passes: [side] });
    frame.frame(); // composer not built yet: nothing placed
    expect(passes).toEqual([pass]);
    built = true; frame.frame(); frame.frame();
    expect(passes).toEqual([side, pass]);
    const list = passEffects(pass); if (list === null) throw new Error('no list');
    expect(list.indexOf(display)).toBe(list.indexOf(tone) + 1);
    expect([display.blendMode.opacity.value, tone.blendMode.opacity.value, side.enabled]).toEqual([1, 0, true]);
    scope.dispose();
    pass.dispose();
  });

  it('refuses a second copy of three\'s tone-mapping chunk in the colour pass, which never compiles (op-frame22)', () => {
    const scope = new Scope('frame22'), scene = new Scene(), camera = new PerspectiveCamera();
    const home = cells[4]; if (home === undefined) throw new Error('Missing home');
    const gradeEffect = new GradeEffect(), saturation = new HueSaturationEffect(), contrast = new BrightnessContrastEffect(), tone = new ToneMappingEffect();
    const pass = new EffectPass(camera, tone, saturation, contrast, gradeEffect);
    vi.spyOn(pass, 'recompile').mockImplementation(() => undefined);
    const passes: Pass[] = [pass];
    const composer = legacyDouble<EffectComposer>({ passes, addPass: (p: Pass, at?: number) => { passes.splice(at ?? passes.length, 0, p); }, removePass: () => undefined });
    const frame = new GridFrame({ host: { scene, camera, composer: () => composer, post: () => ({ grade: gradeEffect, saturation, contrast, tone }) },
      scope, cells, home, homeIsFrame: false, half, feet: () => ({ x: pitch, z: 0 }) });
    const port = frameLookOf(scene); if (port?.composite === undefined) throw new Error('no composite port');
    frame.frame();
    port.contribute('1,0', { fog: null, chain: regionChain(toLevelSpec(PINE_HOLLOW), () => null, 'clean', { ao: true }) });
    expect(() => port.composite?.('1,0', { display: new ToneMappingEffect() })).toThrow('tone-mapping chunk');
    // Sky Reach's NEUTRAL curve is its own effect: it shares the pass with the shell's tone mapping
    const sky = new SkyNeutralToneEffect();
    expect(sky.getFragmentShader()).not.toContain('tonemapping_pars_fragment');
    port.composite('1,0', { display: sky });
    const list = passEffects(pass); if (list === null) throw new Error('no list');
    expect(list.indexOf(sky)).toBe(list.indexOf(tone) + 1);
    frame.frame();
    expect([sky.blendMode.opacity.value, tone.blendMode.opacity.value]).toEqual([1, 0]);
    scope.dispose();
    pass.dispose();
  });
});
