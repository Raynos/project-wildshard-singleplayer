import bleed from '../data/composite.json' with { type: 'json' };
import layout from '../data/layoutPlan.json' with { type: 'json' };
import light from '../data/light.json' with { type: 'json' };
import ao from '../data/aoLook.json' with { type: 'json' };
import bindings from '../data/lookBindings.json' with { type: 'json' };
import sharedUniforms from '../data/sharedUniforms.json' with { type: 'json' };
import type { PostGraphLookRow } from '@wildshard/format/postGraphLook';
import type { postRows } from './postGraphs';
import { NINE_MANIFEST_ROWS } from './manifestRows';
import { Color, Vector3 } from 'three';

/** The Jiehua frame's authored rows: its bleed tuning and the uniforms its composite graph (compositeGraph.ts) reads. */
const B = bleed;
const uniforms = {
  uHasBleed: 0, uRainHaze: 6, uReflK: 0, uTexel: { v2: [0, 0] }, uLineScale: 1, uLines: 1,
  uSilPx: { v2: [2.1, 1.2] }, uSilFade: { v2: [60, 170] }, uSilGain: 0.35,
  uNF: { v2: [0.1, 1000] }, uSharp: 0,
  uBleed: { v4: [B.tight, B.wide / 4, B.stain, B.stainResponse] },
  uBleed2: { v4: [B.weave, B.warp, B.edge, B.exposure] },
  uRain: { v4: [B.rain, B.rainAngle, B.rainSpeed, 2] },
  uGrade: { v3: [B.vignette, B.grain, B.shadowBlue] }, uTone: { v4: [B.toe, B.toeEnd, B.vibrance, B.warm] },
} as const;
export function compositeRows(): { readonly bleed: typeof bleed; readonly uniforms: typeof uniforms } { return { bleed, uniforms }; }

/**
 * E315 (Jake, on the Nine Dragon models board: the Kowloon stele, the lotus-bud finial and the roll shutter open dark): the
 * Model Explorer lights Nine Dragon's specimens like a studio, not the city's blue-hour night. While the studio is up
 * (`explore.studio`, with the turntable; the world is hidden while a model is on show) the ambient is raised, the shade
 * wash lifted toward white, the top light turned to come from the side the turntable opens on (the sky's sun, the
 * engine's compassDir of the level's sun row), and the washes drawn dry; held, so all four come back when it closes.
 */
function specimenLight(): { param: string; index?: number; value: number }[] {
  const S = bindings.specimen, { azimuth, elevation } = NINE_MANIFEST_ROWS.sky.sun, az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180;
  const sun = new Vector3(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize(), h = Math.hypot(sun.x, sun.z);
  const key = new Vector3((sun.x / h) * (1 - S.keyUp), S.keyUp, (sun.z / h) * (1 - S.keyUp)).normalize();
  const shade = new Color(sharedUniforms.uShade.rgb).lerp(new Color(1, 1, 1), S.lift).toArray();
  return [{ param: 'uLpAmb', value: S.ambient }, { param: 'uDry', value: 1 },
    ...shade.map((value, index) => ({ param: 'uShade', index, value })), ...key.toArray().map((value, index) => ({ param: 'uLightDir', index, value }))];
}

/** The Jiehua frame as a post-graph look (G599 N1, game/looks/postGraphLook): the wet floor, the haze march and the bleed
 *  pyramid off the phone, the composite graph over them, the learned LUT, the pixel terms, the studio / practice edges. */
export function postGraphRow(passes: ReturnType<typeof postRows>): PostGraphLookRow {
  const { Y0, WELL, STREET, PLAZA, STAIR } = layout, rain = (value: number) => ({ param: 'uRain', index: 0, value });
  const fog = ['uFogBase', 'uFogStart', 'uFogBaseCol', 'uShaft', 'uShaftK', 'uShaftLit', 'uFogDeep', 'uDeepAir', 'uDeepAir2', 'uPuff'];
  const params = { time: 'uTime', ground: Y0 };
  return { passes, composite: { pass: 'composite', output: 'composite' }, live: 'nine-shared',
    sides: [
      // the wet floor at the square's datum: the plaza, the street north through the gate, the stair-street's foot; and
      // (dome C2) the stair-street's treads and landings, any height
      { pass: 'reflect', tiers: ['desktop'], params, constants: { uRect: { v4: [WELL.x0 - 2, STREET.z0, Math.max(PLAZA.x1, STAIR.x0) + 4, PLAZA.z1 + 10] },
        uRect2: { v4: [STAIR.x0, STAIR.z0, 102, STAIR.z1] }, uK: { v4: [Y0, 1, 0.045, 0.12] } } },
      { pass: 'haze', tiers: ['desktop'], params, constants: { uGroundY: Y0 } },
      { pass: 'bleed', tiers: ['desktop'] }],
    inputs: { tTight: { side: 'bleed', output: 'tight' }, tWide: { side: 'bleed', output: 'wide' }, tHaze: { side: 'haze', output: 'haze' }, tRefl: { side: 'reflect', output: 'reflection' } },
    flags: { uHasBleed: { inputs: ['tTight', 'tWide'], on: 1 }, uRainHaze: { inputs: ['tHaze'], on: 6 }, uReflK: { inputs: ['tRefl'], on: 1 } },
    uniforms: { ...uniforms, ...light.glow, datum: Y0 },
    aliases: { uInk: 'uInk0', ...Object.fromEntries(fog.map(key => [`${key.charAt(1).toLowerCase()}${key.slice(2)}`, key])) },
    // line widths are authored at 3×: below 2.5× the phone's 2× draws them 20 % heavier; the drizzle's px scale; the unsharp
    // mask where the buffer is under the 3× screen; the screen-space pieces' buffer size
    pixel: [{ of: 'ratio', param: 'uDpr', scale: 1 / bindings.lines.authored, below: { at: bindings.lines.below, times: bindings.lines.heavier } },
      { of: 'ratio', param: 'uRain', index: 3 }, { of: 'step', param: 'uSharp', at: 2.5, below: 0.35, above: 0 }, { of: 'buffer', param: 'uRes' }],
    lut: { url: light.lut, texture: 'uLut', amount: 'uLutAmt' },
    // the streak cards' gain: the whole wet-floor reflection where no reflection pass runs
    lent: [{ look: 'nine-streaks', param: 'cardOn', side: 'reflect', drawn: bindings.cardOn, absent: 1 }],
    events: [{ event: 'practice.active', on: { set: [rain(0)], display: 0 }, off: { set: [rain(B.rain)], display: 1 } },
      // the studio's clear air (no drizzle, no base fog, no band depth) and its specimen light until it closes
      { event: 'explore.studio', on: { set: [rain(0)], hold: [{ param: 'uFogBase', value: 0 }, { param: 'uBands', index: 2, each: true, value: 0 }, ...specimenLight()] }, off: { set: [rain(B.rain)] } }],
    ao: { ...ao, color: [ao.color[0] ?? 0, ao.color[1] ?? 0, ao.color[2] ?? 0], fog: [ao.fog[0] ?? 0, ao.fog[1] ?? 0] },
    // E281: the engine cloud layer has no place in a blue-hour sky; the painted sky owns the horizon inside its cell (G321)
    sky: { clouds: false, planet: true, ownSky: true } };
}
