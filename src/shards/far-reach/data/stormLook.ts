import type { GraphIr, GraphRef } from '@wildshard/format/materialGraph';
import { graphKit } from './graphKit';
import skyMapSources from './skyMapSources.json' with { type: 'json' };
import { SKY_SUN } from './skyLook';
import { STORM } from './storm';
import { STORM_NOISE } from './stormNoise';

/**
 * The crown storm's vortex graph (SHARD-PLATFORM M3: an SF59 material graph, look.materials `storm-ring`; world/storm.ts
 * builds one dished ring in it): the painted storm vortex seen from below (E399, mockup D: tex/stormeye.webp, the sea's maelstrom painting)
 * greyed toward mockup D's smoky slate, turning slowly, its edge ragged with the cloud field, lit by the lightning, dished so
 * the eye sits highest and the rim hangs low; seen from above, a sunlit cumulus spiral.
 */

/**
 * The ring as one SF59 material graph (`storm-ring` in look.materials; world/storm.ts draws the dished ring in it): the
 * cloud field is the cached linear noise (`noise`, R density), the painting the library's storm eye (`paint`, mirrored past
 * its edge as the old sampler did), `aFlash` the lightning (the ring's one per-vertex value, world/storm.ts sets it on a
 * strike). `radius`, `twist` and `spin` are the layer's (data/storm.ts), `dish` how far the eye sits above the rim.
 * GLSL's log has no graph op: the arms' log-spiral uses (x^h - 1) / h, h = 0.002 (within 0.01 of ln over the disc).
 */
export function stormRingGraph(row: { readonly noise: string; readonly paint: string; readonly radius: number; readonly twist: number; readonly spin: number; readonly dish: number; readonly sun: readonly [number, number, number] }): GraphIr {
  const k = graphKit(), { op, add, sub, mul, div, swz, smooth, clamp } = k;
  const rot = (p: string, a: string): string => { const c = op('cos', [a]), s = op('sin', [a]), x = swz(p, 'x'), y = swz(p, 'y'); return op('combine', [sub(mul(c, x), mul(s, y)), add(mul(s, x), mul(c, y))]); };
  const one = (x: GraphRef): string => op('oneMinus', [x]);
  // the vertex: dished, the eye highest
  const geo = op('positionGeometry'), lpV = div(swz(geo, 'xz'), row.radius);
  const offset = op('combine', [0, mul(row.dish, op('pow', [one(op('min', [op('length', [lpV]), 1])), 2])), 0]);
  const lp = k.varying(lpV), flash = k.varying(k.attr('aFlash', 'float')), centre = k.varying(op('objectOrigin'));
  // the cloud field: twisted toward the eye, turning slowly, the fine octave at another rate
  const t = op('time'), r = op('length', [lp]), th = op('atan', [swz(lp, 'y'), swz(lp, 'x')]);
  const a = add(mul(row.twist, op('pow', [one(op('min', [r, 1])), 1.6])), mul(t, row.spin));
  const q = mul(rot(lp, a), 1.35), q2 = mul(rot(lp, add(mul(a, 1.3), mul(t, row.spin * 0.7))), 3.1);
  const noise = (at: GraphRef): string => swz(k.tex('noise', at), 'x');
  const w = noise(add(mul(q, 0.5), 0.31)), qa = add(q, mul(sub(w, 0.5), 0.55));
  const base = noise(qa), fine = noise(q2);
  const sl = Math.hypot(row.sun[0], row.sun[2]), sunXZ: [number, number] = [row.sun[0] / sl, row.sun[2] / sl];
  const sunL = mul(rot(op('combine', [sunXZ[0], sunXZ[1]]), a), 0.035);
  const lit = clamp(add(mul(sub(base, noise(add(qa, sunL))), 9), 0.5), 0, 1);
  const ln = div(sub(op('pow', [add(r, 0.03), 0.002]), 1), 0.002);
  const arms = add(0.5, mul(0.5, op('sin', [add(sub(add(mul(th, 3), mul(ln, 5)), mul(t, row.spin * 9)), mul(base, 6))])));
  const d = sub(add(add(mul(base, 0.95), mul(fine, 0.35)), mul(arms, 0.16)), 0.32);
  const rim = one(smooth(0.6, 1, add(r, mul(sub(d, 0.4), 0.4))));
  const dens = clamp(mul(d, 1.6), 0, 1);
  const wp = op('positionWorld'), cam = op('cameraPosition');
  const toward = op('max', [op('dot', [op('normalize', [sub(wp, cam)]), [...row.sun]]), 0]);
  const out2 = op('select', [op('gt', [r, 0.001]), div(lp, op('max', [r, 0.001])), [0, 0]]);
  const sunSide = op('max', [op('dot', [out2, sunXZ]), 0]);
  // the painting: smoky slate masses, the eye a shade darker; a strike lights the eye and the arms near it
  const pq = add(mul(rot(lp, mul(t, row.spin * 0.35)), 0.83), 0.5), mirror = one(op('abs', [one(op('abs', [pq]))]));
  let under = mul(swz(k.tex('paint', mirror), 'xyz'), [0.78, 0.76, 0.84]);
  under = mul(k.mix(under, mul(op('dot', [under, [0.2126, 0.7152, 0.0722]]), [1.02, 0.97, 1]), 0.35), 1.3);
  under = mul(under, k.mix(0.75, 1, smooth(0, 0.22, r)));
  let c = add(under, mul([0.7605, 0.6724, 1], mul(mul(flash, op('exp', [mul(r, -4)])), 0.6)));
  let alpha = mul(mul(rim, one(smooth(0.5, 0.75, r))), 0.97);
  // the low sun stays clear, the edge gilded; haze with distance; thin when the camera is level with it; it gathers near the crown
  c = add(c, mul([1, 0.5841, 0.227], mul(smooth(0.93, 0.98, toward), 0.35)));
  alpha = mul(alpha, one(mul(smooth(0.993, 0.999, toward), 0.95)));
  const haze = smooth(220, 380, op('length', [sub(wp, cam)]));
  c = k.mix(c, [0.8469, 0.5841, 0.4342], mul(haze, 0.35));
  const near = smooth(3, 16, op('abs', [sub(swz(wp, 'y'), swz(cam, 'y'))]));
  const approach = one(mul(smooth(110, 170, op('length', [sub(swz(cam, 'xz'), swz(centre, 'xz'))])), 0.9));
  // seen from above: a sunlit cumulus spiral, the crowns cream-gold, the hollows lavender
  const above = smooth(1, 9, sub(swz(cam, 'y'), swz(wp, 'y')));
  let billow = k.mix([0.3325, 0.2542, 0.3916], [1, 0.8714, 0.7157], smooth(0.25, 0.85, add(add(mul(lit, 0.6), mul(one(dens), 0.2)), mul(arms, 0.3))));
  billow = k.mix(billow, [1, 0.5841, 0.227], mul(mul(sunSide, sunSide), 0.35));
  c = k.mix(c, billow, above);
  const outAlpha = mul(mul(mul(mul(alpha, one(mul(haze, 0.72))), near), approach), one(above));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, budget: { nodes: 240, samplers: 2, instructions: 480 },
    params: { noise: { type: 'texture', value: row.noise, role: 'data' }, paint: { type: 'texture', value: row.paint } }, nodes: k.nodes,
    stages: { 'vertex.offset': { offset }, surface: { colour: c, alpha: outAlpha } }, effectState: { blend: 'alpha', depthWrite: false, fog: false } };
}

const RING = STORM.layers[0];
/** The crown storm's ring look (its first layer's: the painted vortex is the first layer's alone). */
export const STORM_RING_GRAPH = stormRingGraph({ noise: STORM_NOISE.hash, paint: skyMapSources.stormeye.asset, radius: STORM.radius * RING.r, twist: RING.twist, spin: RING.spin, dish: 6, sun: SKY_SUN });
