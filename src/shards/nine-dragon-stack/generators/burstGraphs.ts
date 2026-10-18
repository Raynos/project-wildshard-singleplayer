import { Color } from 'three';
import type { GraphIr, GraphRef } from '@wildshard/format/materialGraph';
import { LookGraph } from './lookGraph';
import grapple from '../data/grapple.json' with { type: 'json' };

function flash(life: number, size: number, colour: number, speed: number): GraphIr {
  const g = new LookGraph(), op = g.op.bind(g), mul = g.mul.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), sw = g.sw.bind(g);
  const age = sw(g.a('aBurst', 'vec2'), 'x'), k = g.div(age, life), fall = op('pow', [g.max(sub(1, k), 0), 2.2]);
  const p = sub(mul(op('uv'), 2), [1, 1]), angle = mul(age, speed), c = op('cos', [angle]), s = op('sin', [angle]);
  const rotated = g.vec(sub(mul(c, sw(p, 'x')), mul(s, sw(p, 'y'))), add(mul(s, sw(p, 'x')), mul(c, sw(p, 'y'))));
  const radius = mul(size, add(0.7, mul(k, 0.5)));
  const position = op('worldToLocal', [op('viewToWorld', [g.vec(mul(rotated, radius), 0)])]);
  const uv = g.v(p), r2 = op('dot', [uv, uv]), r = op('pow', [r2, 0.5]), a = op('atan', [sw(uv, 'y'), sw(uv, 'x')]);
  const core = add(mul(op('exp', [mul(r2, -60)]), 3), mul(op('exp', [mul(r2, -9)]), 0.6));
  const ray = (phase: number, power: number, fade: number, gain: number): string => mul(mul(op('pow', [op('abs', [op('cos', [add(mul(a, 3), phase)])]), power]), op('exp', [mul(r, -fade)])), gain);
  const rays = add(ray(0, 60, 3.2, 1.4), ray(1.047, 90, 5, 0.6)), ringRadius = add(0.15, mul(g.v(k), 0.8));
  const dr = g.div(sub(r, ringRadius), 0.03), ring = mul(mul(op('exp', [mul(mul(dr, dr), -1)]), sub(1, ringRadius)), 1.2);
  const color = new Color(colour).toArray(), hot = g.mix(color, [1, 1, 1], g.clamp(mul(core, 0.5)));
  const intensity = mul(mul(add(add(core, rays), ring), g.v(mul(fall, 2.2))), sub(1, g.smooth(0.8, 1, r)));
  return g.finish({ 'vertex.position': { position }, surface: { colour: mul(hot, intensity), alpha: 1 } });
}

/** One seeded, GPU-placed streak per spark; no per-frame CPU particle geometry. */
function sparks(): GraphIr {
  const g = new LookGraph(), op = g.op.bind(g), mul = g.mul.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), sw = g.sw.bind(g);
  const seed = g.a('aSeed', 'float'), age = sw(g.a('aBurst', 'vec2'), 'x');
  const random = (salt: number): string => g.hash(g.vec(seed, salt));
  const theta = mul(random(1), Math.PI * 2), cz = add(0.15, mul(random(2), 0.85)), sz = op('pow', [sub(1, mul(cz, cz)), 0.5]), speed = add(2.5, mul(random(3), 7.5));
  const velocity = g.vec(mul(mul(op('cos', [theta]), sz), speed), add(mul(mul(op('sin', [theta]), sz), speed), 1.5), mul(mul(cz, speed), -1));
  const lifetime = add(0.18, mul(random(4), 0.42)), heat = g.max(sub(1, g.div(age, lifetime)), 0);
  const at = (time: GraphRef): string => {
    const drag = g.div(sub(1, op('exp', [mul(time, -3)])), 3);
    return sub(mul(mul(velocity, drag), 0.55), mul(op('worldToLocal', [[0, 1, 0]]), mul(mul(mul(time, time), 4.9), 0.55)));
  };
  const uv = op('uv'), head = at(age), tail = at(g.max(sub(age, 0.03), 0)), along = sw(uv, 'x');
  const center = g.mix(head, tail, along), tangent = op('normalize', [add(sub(head, tail), [1e-5, 0, 0])]);
  const camera = sub(op('cameraPosition'), op('objectOrigin')), localEye = op('worldToLocal', [camera]), side = op('normalize', [add(op('cross', [tangent, sub(localEye, center)]), [1e-5, 1e-5, 0])]);
  const width = mul(mul(add(0.6, mul(heat, 0.8)), g.p('pixelScale', 'float', 0.00002)), g.max(op('viewDepth', [op('objectOrigin')]), 0.01)), position = add(center, mul(side, mul(sub(mul(sw(uv, 'y'), 2), 1), width)));
  // The native streak shape has two crossed sheets; a camera-facing ribbon needs only its X sheet.
  const ribbon = op('select', [op('gte', [op('abs', [sw(op('positionGeometry'), 'x')]), 0.25]), position, center]);
  const across = sub(1, op('abs', [sub(mul(sw(op('uv'), 'y'), 2), 1)]));
  const col = g.mix([1, 0.36, 0.08], [1, 0.92, 0.7], g.v(heat));
  return g.finish({ 'vertex.position': { position: ribbon }, surface: { colour: mul(mul(col, across), add(1, mul(g.v(heat), 3))), alpha: 1, discard: op('gte', [g.v(age), g.v(lifetime)]) } });
}

/** Existing effectField clock and geometry carry each graph's only live input. */
export function burstGraphs(): Readonly<Record<string, GraphIr>> {
  return { 'nine-grapple-muzzle': flash(0.13, 0.34, grapple.flashes.muzzle, 0), 'nine-grapple-bite': flash(0.24, 0.75, grapple.flashes.bite, 5),
    'nine-grapple-dock': flash(0.12, 0.2, grapple.flashes.dock, 0), 'nine-grapple-sparks': sparks() };
}
