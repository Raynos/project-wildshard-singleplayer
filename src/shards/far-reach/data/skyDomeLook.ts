import type { GraphIr } from '@wildshard/format/materialGraph';
import { graphKit } from './graphKit';

/**
 * The painted golden-hour dome as one SF59 material graph (SHARD-PLATFORM M3; the painted look compiles it with the
 * backdrop, look/sky.ts): the panorama strip (`pano`, its heading inside `padU` + `scaleU` of the strip's width) sampled by
 * heading and elevation from the camera (so the painted sun stays on the true sun direction wherever the camera stands), its
 * zenith above and nadir below, a veil of the painted haze (`haze`, the look's heading strip) over the far-island band, the
 * glow round the sun rolled off (the sun glow cards carry the hot core). Unlit, unfogged, no depth write.
 */
export function skyDomeGraph(padU: number, scaleU: number): GraphIr {
  const k = graphKit(), { op, add, sub, mul, swz, smooth, mix, clamp } = k;
  const deg = (radians: string): string => mul(radians, 57.29578);
  const lum = (c: string): string => op('dot', [c, [0.2126, 0.7152, 0.0722]]);
  const n = op('normalize', [sub(op('positionWorld'), op('cameraPosition'))]), ny = swz(n, 'y');
  // the elevation (degrees) and the heading (0 … 1 from −z toward +x)
  const elev = deg(op('atan', [ny, op('length', [swz(n, 'xz')])]));
  const heading = op('fract', [add(mul(op('atan', [swz(n, 'x'), op('negate', [swz(n, 'z')])]), 1 / 6.2831853), 1)]);
  const vTop = sub(0.5508, mul(elev, 1 / 66.667));
  let c = swz(k.tex('pano', op('combine', [add(padU, mul(heading, scaleU)), op('oneMinus', [clamp(vTop, 0.002, 0.998)])])), 'xyz');
  // a veil of the painted haze over the far-island band just above the horizon (council R1C-12: the matte's islands must
  // stay simpler than the playable ones in front of them)
  const band = mul(smooth(-1.5, 1, elev), op('oneMinus', [smooth(9, 22, elev)]));
  c = mix(c, swz(k.tex('haze', op('combine', [heading, 0.5])), 'xyz'), mul(band, 0.15));
  // less magenta (E392 judge: the mockups' sky is gold low and lavender-blue high, ours pink-magenta)
  const mag = op('max', [0, sub(op('min', [swz(c, 'x'), swz(c, 'z')]), swz(c, 'y'))]);
  c = add(c, op('combine', [0, mul(mag, 0.55), mul(mul(mag, -0.25), op('oneMinus', [smooth(4, 30, elev)]))]));
  c = mix(c, mul(c, [0.92, 0.97, 1.08]), mul(smooth(14, 40, elev), 0.6));
  // round 7 (the views' upper sky: proposal B chroma 84 vs the mockup's 25): the band up to ~22 deg toward its own grey
  c = mix(c, mul(lum(c), [1.04, 1, 0.95]), mul(mul(op('oneMinus', [smooth(16, 26, elev)]), smooth(-2, 2, elev)), 0.22));
  // (round 8, seats B and C: the upper sky 11-13 darker than the mockups') warmer and lighter
  c = mix(c, mul(c, [1.28, 1.14, 0.98]), mul(smooth(18, 40, elev), 0.6));
  // (round 9: still lavender) toward a warm peach of a higher luminance
  c = mix(c, mul([1.22, 0.98, 0.8], op('max', [mul(lum(c), 1.35), 0.42])), mul(smooth(16, 34, elev), 0.5));
  // the painted glow round the sun rolled off (round 7, seat B: the hot blob ~0.35 of the frame wide); the glow cards
  // carry the hot core. The angle to the sun: atan(sin, cos)
  const cosSun = clamp(op('dot', [n, [-0.1357, 0.1047, -0.9852]]), -1, 1);
  const toSun = deg(op('atan', [op('pow', [op('oneMinus', [mul(cosSun, cosSun)]), 0.5]), cosSun]));
  const r = mul(toSun, 1 / 18);
  c = mul(c, op('oneMinus', [mul(mul(mul(smooth(0.55, 0.95, lum(c)), 0.42), op('exp', [op('negate', [mul(r, r)])])), smooth(1.2, 3, toSun))]));
  c = mix(c, [0.2358, 0.2063, 0.3176], smooth(0.05, -0.12, vTop));
  c = mix(c, [0.3573, 0.1791, 0.2178], smooth(0.95, 1.1, vTop));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, nodes: k.nodes,
    params: { pano: { type: 'texture', value: 'pano' }, haze: { type: 'texture', value: 'haze' } },
    stages: { surface: { colour: c } }, effectState: { depthWrite: false, fog: false, singlePass: true } };
}
