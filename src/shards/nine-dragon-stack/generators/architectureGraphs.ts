import type { AuthorGraph as GraphIr, AuthorGraphRef as GraphRef, AuthorGraphStages as GraphStages } from '@wildshard/sdk/bake/materialGraph';
import { LookGraph } from './lookGraph';
import SHARED from '../data/sharedUniforms.json' with { type: 'json' };

const shapes = {
  uTime: 'float', uLinePx: 'float', uDpr: 'float', uGroundPx: 'float', uFlagJoint: 'float', uPaintFlag: 'float', uDry: 'float', uLpMax: 'float', uLpAmb: 'float', uInkMid: 'float', uFogBase: 'float', uFogStart: 'float', uWeave: 'float',
  uLineFade: 'vec2', uTilePitch: 'vec2', uWetSky: 'vec2',
  uWashTint: 'vec3', uInk0: 'vec3', uInk1: 'vec3', uLightDir: 'vec3', uShade: 'vec3', uPaintStone: 'vec3', uPaintInk: 'vec3', uFogBaseCol: 'vec3', uWinWarm: 'vec3', uWinCool: 'vec3', uWinDark: 'vec3', uPaper: 'vec3', uPaperDeep: 'vec3', uSutraWin: 'vec3', uGold: 'vec3', uGoldDim: 'vec3', uSilver: 'vec3', uSky: 'vec3', uFacadeWash: 'vec3', uLpMinA: 'vec3', uLpMinB: 'vec3', uLpInvA: 'vec3', uLpInvB: 'vec3',
  uPaintK: 'vec4', uPaintK2: 'vec4', uLpGain: 'vec4', uLpCut: 'vec4', uLpAmber: 'vec4', uLpSpec: 'vec4', uFlag: 'vec4',
} as const;

type Ref = GraphRef;
/** Build-time arithmetic only. Each existing draw gets its own admitted graph. */
class Surface extends LookGraph {
  readonly root = this.p('rootAt', 'vec3', [0, 0, 0]);
  readonly world = this.sub(this.op('positionWorld'), this.root);
  readonly eye = this.sub(this.op('cameraPosition'), this.root);
  readonly delta = this.sub(this.eye, this.world);
  readonly distance = this.op('length', [this.delta]);
  readonly view = this.div(this.delta, this.max(this.distance, 1e-4));
  readonly normal = this.op('select', [this.op('frontFacing'), this.op('normalWorld'), this.mul(this.op('normalWorld'), -1)]);
  readonly coord = this.op('fragCoord');
  readonly depth = this.v(this.op('viewDepth', [this.op('positionWorld')]));
  readonly tint = this.v(this.op('instanceColour'));
  readonly colour = this.mul(this.op('vertexColour'), this.tint);
  override noise(p: Ref): string { return this.add(this.mul(this.op('noise', [p]), 0.5), 0.5); }
  u(name: keyof typeof shapes): string {
    const type = shapes[name];
    return this.p(name, type, type === 'float' ? 0 : type === 'vec2' ? [0, 0] : type === 'vec3' ? [0, 0, 0] : [0, 0, 0, 0]);
  }
  tex(name: string, uv: Ref, layer?: Ref): string {
    this.params[name] = { type: 'texture', role: 'lent', value: name };
    return this.op(layer === undefined ? 'texture' : 'textureArray', layer === undefined ? [uv] : [uv, layer], { param: name });
  }
  flat(value: Ref): string { return this.op('varying', [value], { interpolation: 'flat' }); }
  attr(name: string, type: 'float' | 'vec2' | 'vec3' | 'vec4', flat = false): string { return flat ? this.flat(this.a(name, type)) : this.v(this.a(name, type)); }
  neg(a: Ref): string { return this.mul(a, -1); }
  abs(a: Ref): string { return this.op('abs', [a]); }
  floor(a: Ref): string { return this.op('floor', [a]); }
  fract(a: Ref): string { return this.op('fract', [a]); }
  eq(a: Ref, b: Ref): string { return this.op('eq', [a, b]); }
  gt(a: Ref, b: Ref): string { return this.op('gt', [a, b]); }
  lt(a: Ref, b: Ref): string { return this.op('lt', [a, b]); }
  step(a: Ref, b: Ref): string { return this.op('step', [a, b]); }
  choose(c: Ref, a: Ref, b: Ref): string { return this.op('select', [c, a, b]); }
  pow(a: Ref, b: Ref): string { return this.op('pow', [a, b]); }
  bit(f: Ref, b: number): string { return this.op('mod', [this.floor(this.div(f, b)), 2]); }
  h11(p: Ref): string { let a = this.fract(this.mul(p, 0.1031)); a = this.mul(a, this.add(a, 33.33)); return this.fract(this.mul(a, this.add(a, a))); }
  line(d: Ref, fw: Ref, w: Ref): string { return this.mul(this.clamp(this.sub(this.add(this.mul(this.max(w, 1), 0.5), 0.5), this.div(d, this.max(fw, 1e-6)))), this.min(w, 1)); }
  cover(x: Ref, a: Ref, b: Ref, fw: Ref): string { const w = this.max(fw, 1e-5); return this.clamp(this.div(this.sub(this.min(this.add(x, this.mul(w, 0.5)), b), this.max(this.sub(x, this.mul(w, 0.5)), a)), w)); }
  rule(x: Ref, pitch: Ref, fw: Ref, w: Ref): string {
    const spacing = this.div(pitch, this.max(fw, 1e-6)), distance = this.mul(this.abs(this.sub(this.fract(this.add(this.div(x, pitch), 0.5)), 0.5)), pitch);
    return this.mix(this.clamp(this.div(w, spacing)), this.line(distance, fw, w), this.smooth(3, 6, spacing));
  }
  projected(p: Ref): string { const n = this.abs(this.normal); return this.choose(this.gt(this.sw(n, 'y'), 0.6), this.sw(p, 'xz'), this.choose(this.gt(this.sw(n, 'x'), this.sw(n, 'z')), this.sw(p, 'zy'), this.sw(p, 'xy'))); }
  /** `wall` (0 / 1, with the face's `seed`): LEGACY's paintWall, the layer shifted per face and its strength swung by a slow
   *  noise (patches of heavier grime, 0.55-1.45) */
  paint(q: Ref, layer: Ref, scale: Ref, strength: Ref, ratio: Ref = 2, wall?: { readonly on: Ref; readonly seed: Ref }): string {
    const o = wall === undefined ? null : this.mul(this.vec(this.mul(this.hash(this.vec(wall.seed, 1.7)), 17), 0), wall.on);
    const tex = this.sw(this.tex('uPaint', o === null ? this.div(q, scale) : this.add(this.div(q, scale), o), layer), 'xyz');
    const fine = this.add(this.div(q, this.mul(scale, 0.383)), [0.37, 0.61]);
    const detail = this.sw(this.tex('uPaint', o === null ? fine : this.add(fine, this.mul(this.sw(o, 'x'), 1.37)), 2), 'xyz');
    const k = wall === undefined || o === null ? strength : this.mul(strength, this.mix(1, this.add(0.55, this.mul(this.noise(this.add(this.mul(q, 0.07), o)), 0.9)), wall.on));
    const m = this.mul(this.mul(tex, ratio), this.mix([1, 1, 1], this.mul(detail, 2), this.mul(this.sw(this.u('uPaintK2'), 'x'), 0.55)));
    const d = this.clamp(this.sub(1, this.op('dot', [m, [0.3333, 0.3333, 0.3333]]))), ink = this.u('uPaintInk');
    const tinted = this.mul(m, this.mix([1, 1, 1], this.div(ink, this.max(this.op('dot', [ink, [0.3333, 0.3333, 0.3333]]), 1e-3)), this.mul(d, this.sw(this.u('uPaintK2'), 'y'))));
    return this.mix([1, 1, 1], tinted, this.clamp(k));
  }
  sampleVolume(wp: Ref): string {
    const sample = (suffix: 'A' | 'B'): string => {
      const name = `uLpVol${suffix}`, uv = this.mul(this.sub(wp, this.u(`uLpMin${suffix}`)), this.u(`uLpInv${suffix}`));
      this.params[name] = { type: 'texture', role: 'lent', value: name };
      const inside = this.mul(this.mul(this.step(0, this.sw(uv, 'x')), this.step(this.sw(uv, 'x'), 1)), this.mul(this.mul(this.step(0, this.sw(uv, 'y')), this.step(this.sw(uv, 'y'), 1)), this.mul(this.step(0, this.sw(uv, 'z')), this.step(this.sw(uv, 'z'), 1))));
      return this.mix([0, 0, 0, 0.5], this.op('texture3D', [uv], { param: name }), inside);
    };
    return this.choose(this.gt(this.sw(wp, 'y'), this.sw(this.u('uLpMinA'), 'y')), sample('A'), sample('B'));
  }
  raw(wp: Ref): string {
    const s = this.sw(this.sampleVolume(wp), 'xyz'), e = this.mul(this.mul(s, s), this.u('uLpMax')), cut = this.u('uLpCut');
    const knee = this.choose(this.gt(this.sw(cut, 'x'), 0), this.div(this.mul(e, e), this.add(e, this.sw(cut, 'x'))), e);
    const peak = this.max(this.sw(knee, 'x'), this.max(this.sw(knee, 'y'), this.sw(knee, 'z')));
    return this.choose(this.gt(this.sw(cut, 'w'), 0), this.div(knee, this.add(1, this.div(peak, this.max(this.sw(cut, 'w'), 1e-4)))), knee);
  }
  pools(colour: Ref, wp: Ref, normal: Ref): string {
    const s = this.sampleVolume(wp), ny = this.sw(normal, 'y'), up = this.sub(this.mul(this.sw(s, 'w'), 2), 1), gain = this.u('uLpGain');
    const facing = this.add(this.add(this.mul(this.max(up, 0), this.mix(this.sw(gain, 'z'), 1, this.clamp(this.add(this.mul(ny, 0.5), 0.5)))), this.mul(this.max(this.neg(up), 0), this.clamp(this.sub(0.6, this.mul(ny, 0.6)), 0.15, 1))), this.mul(this.sub(1, this.abs(up)), this.choose(this.lt(this.abs(ny), 0.5), 1, 0.85)));
    const e = this.mul(this.mul(this.sw(s, 'xyz'), this.sw(s, 'xyz')), this.u('uLpMax')), amber = this.u('uLpAmber');
    const a = this.mul(this.smooth(this.sw(amber, 'z'), this.sw(amber, 'w'), this.div(this.sw(e, 'y'), this.max(this.sw(e, 'x'), 1e-4))), this.step(this.sw(e, 'z'), this.sw(e, 'y')));
    const keep = this.mix(this.sw(this.u('uLpCut'), 'z'), this.max(this.sw(this.u('uLpCut'), 'z'), this.sw(amber, 'x')), a);
    const light = this.mul(this.mul(this.raw(wp), facing), this.mix(1, keep, this.smooth(0.5, 0.9, ny)));
    const peak = this.max(this.sw(colour, 'x'), this.max(this.sw(colour, 'y'), this.sw(colour, 'z'))), low = this.min(this.sw(colour, 'x'), this.min(this.sw(colour, 'y'), this.sw(colour, 'z')));
    const sat = this.div(this.sub(peak, low), this.max(peak, 1e-4));
    const albedo = this.mix(colour, this.mul(this.vec(this.op('dot', [colour, [0.2126, 0.7152, 0.0722]]), this.op('dot', [colour, [0.2126, 0.7152, 0.0722]]), this.op('dot', [colour, [0.2126, 0.7152, 0.0722]])), 1.15), this.mul(this.sw(this.u('uLpSpec'), 'w'), this.sub(1, this.smooth(0.2, 0.5, sat))));
    return this.mul(this.mul(this.mul(albedo, light), this.sw(gain, 'x')), this.step(0.5, this.sw(gain, 'w')));
  }
  shade(colour: Ref): string {
    const lit = this.smooth(-0.03, 0.03, this.sub(this.op('dot', [this.normal, this.u('uLightDir')]), 0.08));
    const shadow = this.mul(this.mix(this.mul(colour, this.u('uShade')), colour, lit), this.mix(1, 0.5, this.smooth(0.35, 0.8, this.neg(this.sw(this.normal, 'y')))));
    return this.add(this.mul(shadow, this.u('uLpAmb')), this.pools(colour, this.world, this.normal));
  }
  output(colour: Ref, emit: Ref, lines: Ref, worldKit = false, extra: GraphStages = {}): GraphIr {
    const ink = this.mix(this.u('uInk0'), this.u('uInk1'), this.smooth(worldKit ? 4 : 8, worldKit ? this.u('uInkMid') : 70, this.distance));
    const fade = this.sub(1, this.smooth(this.sw(this.u('uLineFade'), 'x'), this.sw(this.u('uLineFade'), 'y'), this.distance));
    let result: Ref = this.mix(colour, ink, this.mul(this.clamp(lines), fade));
    // Base-air compensation gives emission its longer reach; the epilogue owns the exact silk bands.
    const trans = this.op('exp', [this.neg(this.mul(this.u('uFogBase'), this.max(this.sub(this.distance, this.u('uFogStart')), 0)))]);
    result = this.add(result, this.div(emit, this.pow(this.max(trans, 1e-4), 0.75)));
    const graph = this.finish({ ...extra, surface: { colour: result, targetAlpha: this.div(this.op('cameraNear'), this.max(this.depth, this.op('cameraNear'))), ...extra.surface } }, { fog: 'nine-silk-fog', depthWrite: true });
    return { ...graph, doubleSided: false };
  }
}

/** Facade dressing: preserve all twelve pattern classes in a separate graph. */
function facade(small: boolean): GraphIr {
  const g = new Surface(), sw = g.sw.bind(g), mul = g.mul.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), max = g.max.bind(g), min = g.min.bind(g), mix = g.mix.bind(g);
  const a = g.op('normalize', [g.a('aTan', 'vec3')]), b = g.op('cross', [g.op('normalLocal'), a]);
  const su = g.op('length', [g.op('localToWorldVector', [a])]), sv = g.op('length', [g.op('localToWorldVector', [b])]);
  const face = g.v(mul(g.a('aFace', 'vec4'), g.vec(su, sv, su, sv))), q = sw(face, 'xy'), size = sw(face, 'zw'), fw = max(g.op('fwidth', [q]), [1e-6, 1e-6]);
  const pat = g.attr('aPat', 'vec4', true), misc = g.attr('aMisc', 'vec2', true), kind = g.op('mod', [g.floor(add(sw(pat, 'x'), 0.5)), 32]);
  const keep = g.step(31.5, sw(pat, 'x')), base = mul(mul(g.op('vertexColour'), mix(g.tint, [1, 1, 1], keep)), mul(g.u('uWashTint'), g.u('uFacadeWash')));
  const x = sw(q, 'x'), y = sw(q, 'y'), w = sw(size, 'x'), h = sw(size, 'y'), fx = sw(fw, 'x'), fy = sw(fw, 'y'), fwm = max(fx, fy);
  const width = mul(mul(g.u('uLinePx'), g.u('uDpr')), 0.62), lw = mul(width, sw(misc, 'y')), flags = g.floor(add(sw(pat, 'w'), 0.5));
  let lines: Ref = 0;
  for (const [distance, footprint, bit] of [[x, fx, 1], [sub(w, x), fx, 2], [y, fy, 4], [sub(h, y), fy, 8]] as const) lines = max(lines, mul(g.bit(flags, bit), g.line(distance, footprint, lw)));
  const rule = (value: Ref, pitch: Ref, footprint: Ref, scale: number): string => g.rule(value, pitch, footprint, mul(width, scale));
  const line = (distance: Ref, footprint: Ref, scale: number): string => g.line(distance, footprint, mul(width, scale));
  let colour: Ref = base, emit: Ref = mul(g.colour, sw(misc, 'x'));
  const use = (k: number, col: Ref, ink: Ref, em?: Ref): void => { const on = g.eq(kind, k); colour = g.choose(on, col, colour); lines = g.choose(on, max(lines, ink), lines); if (em !== undefined) emit = g.choose(on, em, emit); };
  const worldX = add(sw(g.world, 'x'), sw(g.world, 'z')), finish = g.floor(add(mul(sw(pat, 'z'), 0.5), 1e-3));
  const weather = add(add(0.93, mul(g.noise(g.vec(mul(worldX, 0.45), mul(sw(g.world, 'y'), 0.3))), 0.1)), mul(g.noise(g.vec(mul(worldX, 1.7), mul(sw(g.world, 'y'), 1.3))), 0.04));
  const runs = mul(g.smooth(0.5, 0.85, g.noise(g.vec(mul(worldX, 6.5), 0.5))), g.noise(g.vec(add(mul(worldX, 1.3), 9), g.floor(g.div(sw(g.world, 'y'), 3)))));
  let wall = mul(mul(base, weather), sub(1, mul(mul(runs, g.smooth(0.25, 1, g.div(y, h))), 0.28)));
  wall = mul(wall, sub(1, mul(sub(1, g.smooth(0.24, 1.1, y)), 0.16)));
  const tileInk = max(rule(x, 0.3, fx, 0.5), rule(y, 0.3, fy, 0.5)), boardInk = rule(worldX, 0.26, fx, 0.55);
  const finishInk = g.choose(g.eq(finish, 1), mul(tileInk, 0.32), g.choose(g.eq(finish, 3), mul(boardInk, 0.6), g.choose(g.eq(finish, 2), mul(rule(x, 1.25, fx, 0.7), 0.55), 0)));
  use(1, wall, max(finishInk, max(max(line(y, fy, 1.3), line(sub(h, y), fy, 1.3)), mul(line(g.abs(sub(y, 0.24)), fy, 0.7), 0.75))));
  const tp = g.u('uTilePitch'), tx = sw(tp, 'x'), ty = sw(tp, 'y'), tileFar = sub(1, g.smooth(2, 5, g.div(tx, fx))), bx = mul(g.abs(sub(g.fract(g.div(x, tx)), 0.5)), 2);
  let tiles = mul(base, add(0.92, mul(g.hash(g.floor(g.div(q, tp))), 0.14)));
  tiles = mul(tiles, g.paint(q, 5, tp, mul(sw(g.u('uPaintK'), 'x'), sw(g.u('uPaintK'), 'w')), 3));
  tiles = mul(tiles, mix(add(0.8, mul(sub(1, mul(bx, bx)), 0.3)), 1, tileFar));
  const lum = g.op('dot', [tiles, [0.3, 0.59, 0.11]]);
  tiles = mix(tiles, mul(mix(g.vec(lum, lum, lum), tiles, 0.68), 0.72), tileFar);
  use(2, tiles, max(rule(y, ty, fy, 0.9), mul(rule(x, tx, fx, 0.6), 0.7)));
  use(3, base, max(rule(x, sw(pat, 'y'), fx, 0.95), g.choose(g.gt(sw(pat, 'z'), 0), rule(y, sw(pat, 'z'), fy, 0.95), 0)));
  const stripe = g.cover(g.fract(g.div(x, max(sw(pat, 'y'), 1e-5))), 0, 0.5, g.div(fx, max(sw(pat, 'y'), 1e-5)));
  use(4, mul(mix(base, [0.86, 0.84, 0.78], mul(stripe, sw(pat, 'z'))), add(0.94, mul(g.noise(mul(q, 3)), 0.12))), 0);
  const leaf = g.div(g.projected(g.world), 0.16), cells = g.floor(leaf), local = g.fract(leaf);
  let first: Ref = 9, second: Ref = 9, leafId: Ref = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cell = add(cells, [i, j]), rr = sub(add([i, j], g.vec(g.hash(cell), g.hash(add(cell, 17.3)))), local), d = g.op('dot', [rr, rr]), nearest = g.lt(d, first);
    second = g.choose(nearest, first, min(second, d)); first = min(first, d); leafId = g.choose(nearest, g.hash(add(cell, 3.1)), leafId);
  }
  const leafFw = max(g.op('fwidth', [sw(leaf, 'x')]), g.op('fwidth', [sw(leaf, 'y')])), leafDetail = g.smooth(2, 5, g.div(1, leafFw));
  use(5, mix(base, mul(base, add(0.7, mul(leafId, 0.6))), leafDetail), mul(mul(line(mul(sub(g.pow(second, 0.5), g.pow(first, 0.5)), 0.5), leafFw, 0.8), leafDetail), 0.6));
  const centre = g.vec(mul(w, 0.66), mul(h, 0.5)), radius = mul(h, 0.36), distance = g.op('length', [sub(q, centre)]);
  const fan = max(line(g.abs(sub(distance, radius)), fwm, 0.9), line(g.abs(sub(distance, mul(radius, 0.22))), fwm, 0.7));
  const grille = mul(rule(y, 0.06, fy, 0.6), mul(g.step(0.05, x), g.step(x, mul(w, 0.36))));
  use(6, mix(base, mul(base, 0.62), g.step(distance, radius)), max(fan, mul(grille, 0.8)));
  use(7, mul(base, add(0.96, mul(g.hash(g.vec(g.floor(g.div(y, max(sw(pat, 'y'), 1e-5))), sw(pat, 'w'))), 0.08))), mul(rule(y, sw(pat, 'y'), fy, 0.7), 0.85));
  use(8, mul(base, add(0.9, mul(g.noise(g.vec(mul(x, 4), mul(sw(g.world, 'y'), 0.3))), 0.2))), rule(sw(g.world, 'y'), sw(pat, 'y'), g.op('fwidth', [sw(g.world, 'y')]), 1.1));
  const inset = min(min(x, sub(w, x)), min(y, sub(h, y)));
  use(9, base, line(g.abs(sub(inset, 0.05)), fwm, 0.8), mul(mul(g.colour, sw(misc, 'x')), mix(0.7, 1, g.step(0.05, inset))));
  use(10, mul(base, mix(1, 0.92, g.step(0.11, inset))), mul(max(line(g.abs(sub(inset, 0.06)), fwm, 0.8), line(g.abs(sub(inset, 0.11)), fwm, 0.55)), g.smooth(2, 5, g.div(0.06, fwm))));
  const pc = g.choose(g.gt(sw(pat, 'y'), 0), sw(pat, 'y'), 0.2), capD = g.op('length', [g.vec(mul(sub(g.fract(g.div(x, pc)), 0.5), pc), sub(y, mul(h, 0.5)))]), capR = min(mul(pc, 0.43), mul(h, 0.47)), capDetail = g.smooth(2, 5, g.div(pc, fx));
  const disc = sub(1, g.smooth(sub(capR, fwm), add(capR, fwm), capD));
  use(12, mix(mul(base, 0.25), mul(base, 1.2), mix(0.66, disc, capDetail)), mul(max(line(g.abs(sub(capD, capR)), fwm, 0.8), mul(line(g.abs(sub(capD, mul(capR, 0.45))), fwm, 0.5), 0.55)), capDetail));
  const grid = g.div(q, g.vec(sw(pat, 'z'), sw(pat, 'y'))), cell = g.floor(grid), f = g.fract(grid), gridFw = max(g.op('fwidth', [grid]), [1e-6, 1e-6]), seed = g.floor(g.div(flags, 16));
  const bayW = add(2, g.step(0.5, g.hash(g.vec(seed, 1.7)))), bay = g.floor(g.div(sw(cell, 'x'), bayW)), timber = g.step(0.72, g.hash(g.vec(bay, add(seed, 3.3))));
  const farBase = mul(mul(base, add(0.84, mul(g.hash(g.vec(bay, add(seed, 5.7))), 0.26))), mix([1, 1, 1], [0.55, 0.42, 0.32], mul(timber, 0.85)));
  const win = mul(g.cover(sw(f, 'x'), 0.18, 0.82, sw(gridFw, 'x')), g.cover(sw(f, 'y'), 0.3, 0.8, sw(gridFw, 'y'))), lit = g.step(g.hash(add(cell, mul(seed, 7))), add(0.48, mul(timber, 0.12)));
  const farDetail = g.smooth(2, 6, g.div(1, max(sw(gridFw, 'x'), sw(gridFw, 'y'))));
  use(11, mix(mul(farBase, 0.8), mix(farBase, mul(farBase, [0.42, 0.47, 0.58]), mul(win, sub(1, lit))), farDetail), mul(rule(y, sw(pat, 'y'), fy, 1), 0.8), mul([1, 0.7, 0.38], mul(mix(0.135, mul(win, lit), farDetail), 1.15)));
  const concrete = g.op('and', [g.op('and', [g.op('not', [g.eq(kind, 2)]), g.op('not', [g.eq(kind, 3)])]), g.op('and', [g.op('and', [g.op('not', [g.eq(kind, 4)]), g.op('not', [g.eq(kind, 5)])]), g.op('and', [g.op('not', [g.eq(kind, 9)]), g.op('not', [g.eq(kind, 12)])])])]);
  const paintQ = g.choose(g.gt(g.abs(sw(g.normal, 'y')), 0.6), sw(g.world, 'xz'), g.vec(worldX, sw(g.world, 'y')));
  colour = g.choose(concrete, mul(colour, g.paint(paintQ, 4, 6, mul(mul(sw(g.u('uPaintK'), 'x'), sw(g.u('uPaintK'), 'z')), sw(g.u('uPaintStone'), 'z')))), colour);
  colour = mul(g.shade(colour), add(1, mul(sub(sw(g.tex('uSilk', mul(g.projected(g.world), 0.9)), 'x'), 0.5), 0.08)));
  const shrink = g.p('shrink', 'vec2', small ? [55, 85] : [0, 0]), origin = sub(g.op('objectOrigin'), g.root), shrinkDistance = g.op('length', [sub(g.eye, origin)]);
  const scale = g.choose(g.gt(sw(shrink, 'y'), 0), sub(1, g.smooth(sw(shrink, 'x'), sw(shrink, 'y'), shrinkDistance)), 1);
  return g.output(colour, emit, lines, false, { 'vertex.position': { position: add(g.op('instanceOrigin'), mul(sub(g.op('positionLocal'), g.op('instanceOrigin')), scale)) } });
}

/**
 * NR12: the coarse L1 parents (generators/scene.ts; the props family, productDefinition.ts), a 5 % sloppy copy whose face
 * coordinates no longer hold: their wall tone, with the facade's far lit-window grid (kind 11 above) laid out on the upright
 * faces, so a tower past the ring reads as walls and lit rooms, not a flat slab.
 */
/** QA6: the coarse towers' share of the silk fog (its `fogScale`): past the ring they stand 240-380 m off, below the portal
 *  decks in the fog's deep air, which at full strength left them flat fog slabs where LEGACY drew a hazy band of lit towers
 *  (cams 17 / 18). */
const COARSE_FOG = 0.6;
function coarseFacade(): GraphIr {
  const g = new Surface(), sw = g.sw.bind(g), mul = g.mul.bind(g), sub = g.sub.bind(g), max = g.max.bind(g), mix = g.mix.bind(g);
  const base = mul(g.op('vertexColour'), mul(g.u('uWashTint'), g.u('uFacadeWash')));
  // along the face: the horizontal axis across its flat normal (screen derivatives: the copy's smoothed normals swim), so a
  // facade at any yaw keeps upright rows of windows
  const flatN = g.op('normalize', [g.op('cross', [g.op('dFdx', [g.world]), g.op('dFdy', [g.world])])]);
  const across = g.op('normalize', [g.vec(g.neg(sw(flatN, 'z')), sw(flatN, 'x'))]);
  const grid = g.div(g.vec(g.op('dot', [sw(g.world, 'xz'), across]), sw(g.world, 'y')), [2.4, 3.1]), cell = g.floor(grid), f = g.fract(grid);
  const fw = max(g.op('fwidth', [grid]), [1e-6, 1e-6]), upright = sub(1, g.smooth(0.5, 0.8, g.abs(sw(flatN, 'y'))));
  const win = mul(mul(g.cover(sw(f, 'x'), 0.18, 0.82, sw(fw, 'x')), g.cover(sw(f, 'y'), 0.3, 0.8, sw(fw, 'y'))), upright), lit = g.step(g.hash(cell), 0.5);
  const detail = g.smooth(2, 6, g.div(1, max(sw(fw, 'x'), sw(fw, 'y'))));
  const colour = mix(mul(base, 0.8), mix(base, mul(base, [0.42, 0.47, 0.58]), mul(win, sub(1, lit))), detail);
  const emit = mul([1, 0.7, 0.38], mul(mix(mul(upright, 0.135), mul(win, lit), detail), 1.15));
  return g.output(g.shade(colour), emit, 0, false, { 'vertex.scale': { fog: COARSE_FOG } });
}

/** Interior mapping stays one instanced quad per opening, including split panes. */
function windows(): GraphIr {
  const g = new Surface(), sw = g.sw.bind(g), mul = g.mul.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), div = g.div.bind(g), max = g.max.bind(g), min = g.min.bind(g), mix = g.mix.bind(g), choose = g.choose.bind(g);
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(axis => g.op('localToWorldVector', [axis]));
  const ax = axes[0] ?? '', ay = axes[1] ?? '', az = axes[2] ?? '';
  const Wv = g.op('length', [ax]), Hv = g.op('length', [ay]), ux = div(ax, Wv), uy = div(ay, Hv), uz = g.op('normalize', [az]);
  const toEye = sub(g.op('cameraPosition'), g.op('objectOrigin'));
  const camera = g.flat(g.vec(g.op('dot', [toEye, ux]), g.op('dot', [toEye, uy]), g.op('dot', [toEye, uz]))), W = g.flat(Wv), H = g.flat(Hv);
  // the quad's own corner (-0.5..0.5): positionLocal is the instanced position once three's instancing has run (NR3)
  const pos = g.op('positionGeometry'), P0 = g.v(g.vec(mul(sw(pos, 'x'), Wv), mul(sw(pos, 'y'), Hv), 0)), win = g.attr('aWin', 'vec4', true), wall = g.attr('aWall', 'vec3', true);
  const seed = sw(win, 'x'), lit = sw(win, 'y'), curtain = sw(win, 'z'), style = g.floor(add(sw(win, 'w'), 0.5));
  const door = g.bit(style, 16), lattice = g.bit(style, 32), split = mul(sub(1, door), sub(1, lattice));
  const n = choose(g.gt(split, 0.5), g.clamp(g.floor(div(W, 0.62)), 1, 4), 1), pier = choose(g.gt(n, 1), 0.17, 0), pw = div(sub(W, mul(pier, sub(n, 1))), n);
  const xx = add(sw(P0, 'x'), mul(W, 0.5)), kx = g.clamp(g.floor(div(xx, add(pw, pier))), 0, sub(n, 1)), xl = sub(xx, mul(kx, add(pw, pier)));
  const hasT = mul(mul(split, g.step(1.3, H)), g.step(g.h11(add(mul(seed, 4.7), 0.3)), 0.4)), yT = mul(H, 0.68), ky = mul(hasT, g.step(yT, sw(P0, 'y')));
  const y0 = choose(g.gt(ky, 0.5), add(yT, 0.06), 0), y1 = choose(g.op('and', [g.gt(hasT, 0.5), g.lt(ky, 0.5)]), sub(yT, 0.06), H), pH = sub(y1, y0);
  const one = g.op('and', [g.lt(n, 1.5), g.lt(hasT, 0.5)]), ps = choose(one, seed, add(add(add(seed, mul(kx, 17.3)), mul(ky, 5.1)), 0.7));
  const hp = g.h11(add(mul(ps, 1.37), 0.5)), h2 = g.h11(add(mul(ps, 3.91), 1.3)), h3 = g.h11(add(mul(ps, 6.13), 2.1));
  const litP = choose(one, lit, choose(g.gt(lit, 0), choose(g.lt(hp, 0.86), lit, 0), choose(g.lt(hp, 0.24), 0.95, 0)));
  const curP = choose(one, curtain, choose(g.lt(h3, 0.4), mix(0.2, 0.7, g.h11(mul(ps, 5.3))), 0));
  const cool = g.op('and', [g.gt(split, 0.5), g.lt(h2, 0.08)]), shutter = choose(g.op('and', [g.gt(split, 0.5), g.op('and', [g.gt(h2, 0.08), g.lt(h2, 0.2)])]), mix(0.25, 1, g.h11(mul(ps, 7.7))), 0);
  const blinds = mul(split, mul(g.step(0.2, h2), g.step(h2, 0.3))), lightC = choose(cool, [0.78, 0.92, 1], mul(g.tint, add(0.9, mul(g.h11(mul(ps, 9.7)), 0.2))));
  const pcx = add(add(mul(W, -0.5), mul(kx, add(pw, pier))), mul(pw, 0.5)), offset = g.vec(pcx, y0, 0), P = sub(P0, offset), cam = sub(camera, offset);
  const direction = g.op('normalize', [sub(P, cam)]), d = g.vec(sw(direction, 'xy'), min(sw(direction, 'z'), -1e-3)), glass = add(P, mul(d, div(0.16, g.neg(sw(d, 'z')))));
  const q = g.vec(add(sw(glass, 'x'), mul(pw, 0.5)), sw(glass, 'y')), fwg = max(max(g.op('fwidth', [sw(q, 'x')]), g.op('fwidth', [sw(q, 'y')])), 1e-5);
  const inGlass = mul(mul(g.step(g.abs(sw(glass, 'x')), mul(pw, 0.5)), g.step(0, sw(glass, 'y'))), g.step(sw(glass, 'y'), pH));
  const rw = max(add(pw, 1.4), 2.8), D = add(2.6, mul(g.h11(mul(ps, 7.1)), 2.8)), sill = add(mix(0.95, 0, door), y0), floorY = g.neg(sill), ceilY = sub(2.75, sill), backZ = sub(-0.16, D);
  const tx = div(sub(choose(g.gt(sw(d, 'x'), 0), mul(rw, 0.5), mul(rw, -0.5)), sw(glass, 'x')), choose(g.gt(g.abs(sw(d, 'x')), 1e-5), sw(d, 'x'), 1e-5));
  const ty = div(sub(choose(g.gt(sw(d, 'y'), 0), ceilY, floorY), sw(glass, 'y')), choose(g.gt(g.abs(sw(d, 'y')), 1e-5), sw(d, 'y'), 1e-5)), tz = div(sub(backZ, sw(glass, 'z')), sw(d, 'z'));
  const t = min(min(g.abs(tx), g.abs(ty)), tz), hit = add(glass, mul(d, t)), back = g.eq(t, tz), side = g.eq(t, g.abs(tx));
  const roomPaint = choose(g.lt(g.h11(mul(ps, 3.3)), 0.5), [0.86, 0.8, 0.66], choose(g.lt(g.h11(mul(ps, 5.9)), 0.5), [0.7, 0.8, 0.72], [0.7, 0.76, 0.84]));
  const roomWall = mix(roomPaint, [0.95, 0.78, 0.56], mul(litP, 0.6));
  let rc: Ref = choose(back, roomWall, choose(side, mul(roomWall, 0.78), choose(g.gt(sw(d, 'y'), 0), mul(roomWall, 1.05), mul([0.46, 0.34, 0.24], add(0.9, mul(g.h11(ps), 0.2))))));
  const edgeY = min(sub(sw(hit, 'y'), floorY), sub(ceilY, sw(hit, 'y'))), edgeX = sub(mul(rw, 0.5), g.abs(sw(hit, 'x')));
  const eD = choose(back, min(edgeX, edgeY), choose(side, min(g.abs(sub(sw(hit, 'z'), backZ)), edgeY), min(g.abs(sub(sw(hit, 'z'), backZ)), edgeX)));
  const fwh = max(g.op('dot', [g.op('fwidth', [hit]), [1, 1, 1]]), 1e-5), width = mul(mul(g.u('uLinePx'), g.u('uDpr')), 0.62);
  let roomLines: Ref = g.line(max(eD, 0), fwh, mul(width, 0.9));
  const zf = sub(-0.16, mul(D, add(0.45, mul(g.h11(mul(ps, 9.1)), 0.25)))), tf = div(sub(zf, sw(glass, 'z')), sw(d, 'z')), furnitureHit = add(glass, mul(d, tf));
  const furnitureX = mul(mul(sub(g.h11(mul(ps, 2.7)), 0.5), rw), 0.8), furnitureW = add(0.5, mul(g.h11(mul(ps, 4.3)), 0.6)), furnitureTop = add(add(floorY, 1), mul(g.h11(mul(ps, 8.3)), 1.1));
  const furn = g.op('and', [g.lt(tf, t), g.op('and', [g.lt(g.abs(sub(sw(furnitureHit, 'x'), furnitureX)), furnitureW), g.lt(sw(furnitureHit, 'y'), furnitureTop)])]);
  rc = choose(furn, [0.3, 0.22, 0.17], rc);
  roomLines = choose(furn, g.line(min(sub(furnitureW, g.abs(sub(sw(furnitureHit, 'x'), furnitureX))), sub(furnitureTop, sw(furnitureHit, 'y'))), max(g.op('dot', [g.op('fwidth', [sw(furnitureHit, 'xy')]), [1, 1]]), 1e-5), mul(width, 0.9)), roomLines);
  const tubeZ = sub(-0.16, mul(D, 0.35)), tube = mul(mul(g.cover(sw(hit, 'z'), sub(tubeZ, 0.06), add(tubeZ, 0.06), fwh), g.cover(g.abs(sw(hit, 'x')), 0, 0.6, fwh)), choose(g.op('and', [g.op('not', [back]), g.op('and', [g.gt(sw(d, 'y'), 0), g.op('and', [g.eq(t, g.abs(ty)), g.op('not', [furn])])])]), 1, 0));
  const fall = sub(1, mul(g.clamp(div(sub(g.neg(sw(hit, 'z')), 0.16), D)), 0.35)), litC = add(mul(mul(rc, lightC), mul(fall, 0.95)), mul(lightC, mul(tube, 2.5)));
  let room: Ref = mix(mul(rc, [0.13, 0.15, 0.2]), litC, litP);
  const cx = mix(sw(q, 'x'), sub(pw, sw(q, 'x')), g.step(0.5, g.h11(mul(ps, 1.9)))), cur = choose(g.gt(curP, 0), g.cover(cx, 0, mul(curP, pw), fwg), 0);
  const curC = choose(g.lt(g.h11(mul(ps, 12.7)), 0.4), [0.78, 0.7, 0.52], choose(g.lt(g.h11(mul(ps, 13.1)), 0.5), [0.6, 0.18, 0.12], [0.42, 0.56, 0.66]));
  const curLit = mul(mul(curC, mix(0.25, 1, litP)), mix([1, 1, 1], lightC, mul(litP, 0.6))), bl = mul(blinds, sub(1, cur));
  room = mix(room, curLit, cur); room = mix(room, mul(mix([0.7, 0.68, 0.6], lightC, mul(litP, 0.7)), mix(0.3, 0.95, litP)), mul(bl, 0.7));
  const frame = sub(1, mul(g.cover(sw(q, 'x'), 0.04, sub(pw, 0.04), fwg), g.cover(sw(q, 'y'), 0.04, sub(pH, 0.04), fwg))), mull = g.op('mod', [style, 4]);
  const vertical = choose(g.eq(mull, 1), mul(g.abs(sub(g.fract(add(div(sw(q, 'x'), div(pw, 3)), 0.5)), 0.5)), div(pw, 3)), g.abs(sub(sw(q, 'x'), mul(pw, choose(g.eq(mull, 3), 0.52, 0.5)))));
  const horizontal = choose(g.op('or', [g.eq(mull, 0), g.eq(mull, 2)]), g.line(g.abs(sub(sw(q, 'y'), mul(pH, choose(g.eq(mull, 0), 0.7, 0.5)))), fwg, div(0.04, fwg)), 0);
  const gridSize = g.vec(pw, pH), latticePitch = div(gridSize, max([2, 3], g.floor(add(div(gridSize, [0.3, 0.32]), 0.5)))), ld = mul(g.abs(sub(g.fract(add(div(q, latticePitch), 0.5)), 0.5)), latticePitch);
  const latticeMask = sub(1, g.cover(min(sw(ld, 'x'), sw(ld, 'y')), 0.017, 99, fwg));
  const mullM = max(max(frame, max(g.line(vertical, fwg, div(0.04, fwg)), horizontal)), mul(lattice, latticeMask)), frameK = g.op('mod', [g.floor(div(style, 4)), 4]);
  const frameC = choose(g.gt(lattice, 0.5), [0.2, 0.12, 0.08], choose(g.eq(frameK, 0), [0.1, 0.11, 0.13], choose(g.eq(frameK, 1), [0.72, 0.74, 0.74], choose(g.eq(frameK, 2), [0.2, 0.36, 0.3], [0.42, 0.18, 0.12]))));
  const fres = add(0.06, mul(g.pow(sub(1, g.clamp(g.neg(sw(d, 'z')))), 3), 0.5)), reflection = mix(mul(g.u('uSky'), 0.34), mul(g.u('uSky'), 0.56), div(sw(glass, 'y'), max(pH, 0.01)));
  let colour: Ref = mix(mix(room, reflection, mul(mul(fres, mix(1, 0.25, litP)), sub(1, mul(cur, 0.6)))), frameC, mullM);
  let emit: Ref = mul(add(mul(mul(mul(mul(sub(litC, mul(mul(rc, lightC), 0.2)), litP), sub(1, mul(fres, 0.4))), 0.78), mul(sub(1, mul(cur, 0.5)), sub(1, mul(bl, 0.35)))), mul(curLit, mul(mul(cur, litP), 0.45))), sub(1, mullM));
  let lines: Ref = max(mul(mul(mul(roomLines, 0.8), sub(1, mullM)), sub(1, bl)), mul(mul(bl, g.rule(sw(q, 'y'), 0.05, fwg, mul(width, 0.9))), sub(1, mullM)));
  const sy = mul(pH, sub(1, shutter)), closed = g.op('and', [g.gt(shutter, 0), g.gt(sw(P, 'y'), sy)]);
  colour = choose(closed, mul([0.4, 0.43, 0.43], add(0.92, mul(g.h11(add(g.floor(div(sw(P, 'y'), 0.07)), ps)), 0.12))), colour); emit = choose(closed, [0, 0, 0], emit);
  lines = choose(closed, max(mul(g.rule(sw(P, 'y'), 0.07, g.op('fwidth', [sw(P, 'y')]), mul(width, 0.6)), 0.7), g.line(g.abs(sub(sw(P, 'y'), sy)), g.op('fwidth', [sw(P, 'y')]), width)), lines);
  const reveal = mul(wall, choose(g.lt(g.abs(tx), g.abs(ty)), 0.86, choose(g.gt(sw(d, 'y'), 0), 0.6, 1.04)));
  colour = mix(reveal, colour, inGlass); emit = mul(emit, inGlass);
  const fwP = max(g.op('fwidth', [sw(P0, 'xy')]), [1e-5, 1e-5]), coverage = mul(g.cover(xl, 0, pw, sw(fwP, 'x')), g.cover(sw(P0, 'y'), y0, y1, sw(fwP, 'y')));
  const detail = g.smooth(4, 12, div(pw, sw(fwP, 'x'))), avgLit = mul(mul(lightC, [0.84, 0.72, 0.58]), 0.88), avgDark = mix(mul(wall, [0.26, 0.29, 0.36]), mul(g.u('uSky'), 0.4), 0.2);
  const average = mix(mix(avgDark, avgLit, mul(litP, sub(1, mul(curP, 0.3)))), [0.4, 0.43, 0.43], shutter);
  colour = mul(mix(average, colour, detail), mix(g.u('uLpAmb'), 1, g.clamp(litP)));
  emit = mul(mix(mul(avgLit, mul(mul(litP, 0.75), sub(1, shutter))), emit, detail), coverage);
  const wallC = mul(wall, mul(g.u('uWashTint'), g.u('uFacadeWash')));
  colour = mix(g.shade(wallC), colour, coverage);
  const edge = min(min(g.abs(xl), g.abs(sub(pw, xl))), min(g.abs(sub(sw(P0, 'y'), y0)), g.abs(sub(y1, sw(P0, 'y')))));
  lines = max(lines, g.line(edge, max(sw(fwP, 'x'), sw(fwP, 'y')), mul(width, 1.1)));
  return g.output(colour, emit, mul(lines, mix(0.5, 1, detail)));
}

/** `nr13: false` builds the kit graphs as before NR13 and NR16 (no tread glints, every face painted at full strength, a
 *  bare window grid for kind 1): the declaration oracle's predecessor. */
export function architectureGraphs(options: { readonly nr13?: boolean } = {}): Readonly<Record<string, GraphIr>> {
  const nr13 = options.nr13 !== false;
  return { 'nine-architecture': architecture(false, nr13), 'nine-architecture-cut': architecture(true, nr13), 'nine-facade': facade(false), 'nine-facade-small': facade(true), 'nine-windows': windows(), 'nine-coarse-facade': coarseFacade() };
}

/** NR16: kind 1, one cell of LEGACY's facade (style.ts): a storey per row and a window module per column, each rolling
 *  its own window (narrow or wide, a mullion, a transom, a curtain, lit by its floor's odds) with ruled frames and a sill
 *  lip; from 12 px a cell carries a painter's clutter (a cage, boards, laundry, an AC unit, a banner) and some a pipe; far
 *  off a cell averages to its wash and glass. `wall` scales the painted base, `glass` adds unpainted, `keep` scales the
 *  emit (boards and AC units cover the light). */
function facadeCell(g: Surface, q: Ref, gu: Ref, gv: Ref, wpx: Ref, rowP: Ref, colP: Ref, seed: Ref): { wall: Ref; glass: Ref; emit: Ref; keep: Ref; ink: Ref } {
  const sw = g.sw.bind(g), mul = g.mul.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), div = g.div.bind(g), max = g.max.bind(g), min = g.min.bind(g), mix = g.mix.bind(g), abs = g.abs.bind(g), cover = g.cover.bind(g);
  const px = (d: Ref, w: Ref): string => g.line(d, 1, w), ruledPx = (d: Ref, w: Ref, spacing: Ref): string => mix(g.clamp(div(w, spacing)), px(d, w), g.smooth(3, 6, spacing));
  const when = (on: Ref, k: Ref): string => mix(1, k, on), above = (x: Ref, a: number): string => sub(1, g.step(x, a));
  const grid = div(q, g.vec(colP, rowP)), cell = g.floor(grid), f = g.fract(grid), fx = sw(f, 'x'), fy = sw(f, 'y'), Qx = sw(q, 'x'), Qy = sw(q, 'y');
  const colPx = div(colP, gu), rowPx = div(rowP, gv), cellPx = min(colPx, rowPx), blk = g.smooth(3, 7, cellPx);
  const h1 = g.hash(add(cell, mul(seed, 13.1))), h2 = g.hash(add(add(mul(sw(cell, 'yx'), 1.7), mul(seed, 5.3)), 11)), h3 = g.hash(add(add(mul(cell, 0.73), seed), 3));
  const litP = add(0.2, mul(g.hash(g.vec(mul(sw(cell, 'y'), 0.37), mul(seed, 2.1))), 0.3)), isLit = g.step(h1, litP);
  const sv = g.hash(g.vec(seed, 7)), wide = g.step(0.72, h2), wax = mix(add(0.16, mul(sv, 0.1)), 0.07, wide), wbx = mix(sub(0.84, mul(sv, 0.1)), 0.93, wide);
  const win = mul(cover(fx, wax, wbx, div(gu, colP)), cover(fy, 0.26, 0.8, div(gv, rowP)));
  const wallK = sub(1, mul(mul(g.smooth(0.72, 0.97, fy), 0.45), blk));
  const glass = mul(mul(mix(g.u('uWinDark'), mul(g.u('uWinDark'), 1.35), mul(g.smooth(0.26, 0.8, sub(1, fy)), 0.6)), mix(0.85, 1.1, h3)), g.u('uWashTint'));
  const warm = mul(mix(g.u('uWinWarm'), g.u('uWinCool'), g.step(0.85, h2)), add(0.55, mul(h3, 0.5)));
  const curtain = mul(mul(g.step(0.5, h3), isLit), cover(fx, wax, mix(wax, wbx, add(0.35, mul(h2, 0.3))), div(gu, colP))), cw = mul(curtain, win);
  const area = mul(sub(wbx, wax), 0.54), a85 = mul(area, 0.85);
  // col = mix(avg, cell, blk): avg = base 0.89 beside the glass's share; cell = the wall, the glass, a curtain over it
  let wall: Ref = add(mul(sub(1, blk), mul(0.89, sub(1, a85))), mul(blk, mul(mul(wallK, sub(1, win)), sub(1, cw))));
  let glassC: Ref = add(mul(sub(1, blk), mul(glass, a85)), mul(blk, add(mul(glass, mul(win, sub(1, cw))), mul([0.702, 0.594, 0.45], cw))));
  const emit = mul(mix(mul(g.u('uWinWarm'), mul(mul(litP, area), 0.55)), mul(warm, mul(mul(isLit, win), sub(1, mul(curtain, 0.6)))), blk), 0.8);
  // the sill lip, the window's frame, mullion, transom and sill; below ~6 px each averages to its share
  const inXh = mul(g.step(wax, fx), g.step(fx, wbx)), inYh = mul(g.step(0.26, fy), g.step(fy, 0.8));
  const dfx = mul(min(abs(sub(fx, wax)), abs(sub(fx, wbx))), colPx), dfy = mul(min(abs(sub(fy, 0.26)), abs(sub(fy, 0.8))), rowPx);
  const mullOn = g.step(0.3, h2), tranOn = g.step(0.45, h3);
  const covU = max(mul(px(dfx, mul(wpx, 0.85)), inYh), mul(mul(px(mul(abs(sub(fx, 0.5)), colPx), mul(wpx, 0.6)), inYh), mullOn));
  const covV = max(max(mul(px(dfy, mul(wpx, 0.85)), inXh), mul(mul(px(mul(abs(sub(fy, 0.638)), rowPx), mul(wpx, 0.55)), inXh), tranOn)),
    mul(mul(px(mul(abs(sub(fy, 0.21)), rowPx), mul(wpx, 0.8)), g.step(sub(wax, 0.05), fx)), g.step(fx, add(wbx, 0.05))));
  const avgU = mul(g.clamp(div(mul(wpx, add(1.7, mul(mullOn, 0.6))), colPx)), 0.54), avgV = mul(g.clamp(div(mul(wpx, add(2.5, mul(tranOn, 0.55))), rowPx)), sub(wbx, wax));
  const lu = mix(avgU, covU, g.smooth(3, 6, mul(mul(colPx, min(wax, sub(0.5, wax))), 2))), lv = mix(avgV, covV, g.smooth(3, 6, mul(rowPx, 0.24)));
  let ink: Ref = max(g.rule(Qy, rowP, gv, mul(wpx, 1.35)), mul(max(lu, lv), blk));
  // the clutter, in the cell's metres (m), each on its own roll of t4 / t5
  const det = g.smooth(11, 24, cellPx), t4 = g.hash(add(add(mul(cell, 1.31), mul(seed, 3.7)), 19)), t5 = g.hash(add(add(mul(cell, 2.17), mul(seed, 1.9)), 7));
  const mx = mul(fx, colP), my = mul(fy, rowP), Ax = mul(wax, colP), Bx = mul(wbx, colP), Ay = mul(rowP, 0.26), By = mul(rowP, 0.8);
  let cWall: Ref = wall, cGlass: Ref = glassC, clut: Ref = 0, keep: Ref = 1;
  // a security cage over the window
  const cage = mul(above(t4, 0.7), g.step(t4, 0.82)), cax = sub(Ax, 0.06), cbx = add(Bx, 0.06), cay = sub(Ay, 0.05), cby = add(By, 0.1);
  const inC = mul(mul(cover(mx, cax, cbx, gu), cover(my, cay, cby, gv)), cage);
  const rails = px(div(min(min(abs(sub(my, cay)), abs(sub(my, cby))), abs(sub(my, mix(cay, cby, 0.55)))), gv), mul(wpx, 0.8));
  clut = max(clut, mul(max(g.rule(Qx, 0.13, gu, mul(wpx, 0.6)), max(px(div(min(abs(sub(mx, cax)), abs(sub(mx, cbx))), gu), mul(wpx, 0.9)), rails)), inC));
  cWall = mul(cWall, when(inC, 0.82)); cGlass = mul(cGlass, when(inC, 0.82));
  // boarded up
  const inW = mul(mul(cover(mx, Ax, Bx, gu), cover(my, Ay, By, gv)), mul(above(t4, 0.82), g.step(t4, 0.9)));
  cWall = mix(cWall, 1.04, inW); cGlass = mul(cGlass, sub(1, inW)); clut = max(clut, mul(g.rule(Qy, 0.1, gv, mul(wpx, 0.5)), inW)); keep = mul(keep, sub(1, inW));
  // laundry on a pole, up to three pieces
  const laundry = above(t4, 0.9), py = sub(By, 0.05), pole = mul(px(div(abs(sub(my, py)), gv), mul(wpx, 0.7)), cover(mx, sub(Ax, 0.2), add(Bx, 0.2), gu));
  const k = g.floor(div(sub(mx, Ax), 0.42)), cx0 = add(add(Ax, mul(k, 0.42)), 0.04), cx1 = add(cx0, 0.3), hk = g.hash(g.vec(k, add(add(mul(sw(cell, 'x'), 3.1), sw(cell, 'y')), seed)));
  const cy0 = sub(sub(py, 0.45), mul(hk, 0.35)), hung = mul(mul(mul(g.step(0, k), g.step(k, 2)), g.step(0.25, hk)), laundry);
  const inCl = mul(mul(cover(mx, cx0, cx1, gu), cover(my, cy0, py, gv)), hung);
  const cloth = g.choose(g.lt(hk, 0.45), [0.62, 0.2, 0.14], g.choose(g.lt(hk, 0.62), [0.22, 0.34, 0.55], g.choose(g.lt(hk, 0.8), [0.86, 0.84, 0.78], [0.55, 0.43, 0.25])));
  cWall = mul(cWall, sub(1, inCl)); cGlass = mix(cGlass, mul(cloth, 0.85), inCl);
  const clo = mul(max(mul(px(div(min(abs(sub(mx, cx0)), abs(sub(mx, cx1))), gu), mul(wpx, 0.6)), cover(my, cy0, py, gv)), mul(px(div(abs(sub(my, cy0)), gv), mul(wpx, 0.6)), cover(mx, cx0, cx1, gu))), hung);
  clut = max(clut, max(mul(pole, laundry), clo));
  // an AC unit at the sill
  const ax0 = mul(colP, 0.5), ax1 = add(ax0, 0.72), inA = mul(mul(cover(mx, ax0, ax1, gu), cover(my, 0.12, 0.62, gv)), sub(1, g.step(0.3, t5)));
  cWall = mix(cWall, 1.16, inA); cGlass = mul(cGlass, sub(1, inA)); keep = mul(keep, sub(1, inA));
  const acEdge = max(mul(px(div(min(abs(sub(mx, ax0)), abs(sub(mx, ax1))), gu), mul(wpx, 0.8)), cover(my, 0.12, 0.62, gv)), mul(px(div(min(abs(sub(my, 0.12)), abs(sub(my, 0.62))), gv), mul(wpx, 0.8)), cover(mx, ax0, ax1, gu)));
  const grille = mul(mul(g.rule(sub(my, 0.12), 0.09, gv, mul(wpx, 0.45)), cover(mx, add(ax0, 0.08), add(ax0, 0.4), gu)), cover(my, 0.18, 0.56, gv));
  clut = max(clut, mul(max(acEdge, grille), sub(1, g.step(0.3, t5))));
  // a cloth banner under the next floor's slab
  const by0 = mul(rowP, 0.84), by1 = mul(rowP, 0.97), banner = above(t5, 0.955), inB = mul(mul(cover(mx, 0.1, sub(colP, 0.1), gu), cover(my, by0, by1, gv)), banner);
  cWall = mul(cWall, sub(1, inB)); cGlass = mix(cGlass, g.choose(g.lt(t4, 0.5), [0.42, 0.1, 0.08], [0.1, 0.18, 0.32]), inB);
  clut = max(clut, mul(max(mul(px(div(min(abs(sub(my, by0)), abs(sub(my, by1))), gv), mul(wpx, 0.8)), cover(mx, 0.1, sub(colP, 0.1), gu)),
    mul(px(div(min(abs(sub(mx, 0.1)), abs(sub(mx, sub(colP, 0.1)))), gu), mul(wpx, 0.8)), cover(my, by0, by1, gv))), banner));
  wall = mix(wall, cWall, det); glassC = mix(glassC, cGlass, det); ink = max(ink, mul(clut, det));
  // a downpipe in some columns, and a faint bay seam
  const pipeOn = g.step(0.8, g.hash(g.vec(sw(cell, 'x'), mul(seed, 5.7)))), pipeAt = mul(mul(pipeOn, cover(mx, 0.1, 0.24, gu)), blk);
  wall = mix(wall, 1.08, pipeAt); glassC = mul(glassC, sub(1, pipeAt));
  ink = max(ink, mul(mul(ruledPx(div(min(mx, sub(colP, mx)), gu), mul(wpx, 0.45), colPx), 0.6), g.step(0.5, g.fract(mul(seed, 7.3)))));
  ink = max(ink, mul(mul(pipeOn, max(px(div(abs(sub(mx, 0.1)), gu), mul(wpx, 0.6)), px(div(abs(sub(mx, 0.24)), gu), mul(wpx, 0.6)))), g.smooth(4, 9, div(0.14, gu))));
  return { wall, glass: glassC, emit, keep: g.choose(g.gt(det, 0), keep, 1), ink };
}

/** The world kit retains its encoded kinds, explicit surfaces and edge masks. */
function architecture(cut: boolean, nr13: boolean): GraphIr {
  const g = new Surface(), sw = g.sw.bind(g), mul = g.mul.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), div = g.div.bind(g), max = g.max.bind(g), min = g.min.bind(g), mix = g.mix.bind(g), choose = g.choose.bind(g);
  const face = g.attr('aFace', 'vec4'), pat = g.attr('aPat', 'vec4', true), misc = g.attr('aMisc', 'vec4', true), off = g.attr('aOff', 'vec2'), spill = g.attr('aSpill', 'vec3');
  const kind = g.floor(add(sw(pat, 'x'), 0.5)), flags = g.floor(add(sw(misc, 'w'), 0.5)), surf = g.floor(div(flags, 4096));
  const accent = g.bit(flags, 16), gloss = g.bit(flags, 32), gold = g.bit(flags, 64), base = mul(g.colour, mix(g.u('uWashTint'), [1, 1, 1], accent));
  const uv = sw(face, 'xy'), sz = sw(face, 'zw'), q = add(uv, off), x = sw(uv, 'x'), y = sw(uv, 'y'), w = sw(sz, 'x'), h = sw(sz, 'y');
  const footprint = (value: Ref): string => max(g.op('length', [g.vec(g.op('dFdx', [value]), g.op('dFdy', [value]))]), 1e-6);
  const gu = footprint(x), gv = footprint(y), fw = max(gu, gv), thin = mix(1, 0.62, g.smooth(8, 70, g.distance)), Wr = mul(mul(g.u('uLinePx'), g.u('uDpr')), thin);
  const W = mul(Wr, sw(misc, 'y')), Wg = mul(mul(g.u('uGroundPx'), g.u('uDpr')), mix(1, 0.55, g.smooth(6, 60, g.distance)));
  let lines: Ref = 0;
  for (const [distance, pixel, edge, ground] of [[x, gu, 1, 256], [sub(w, x), gu, 2, 512], [y, gv, 4, 1024], [sub(h, y), gv, 8, 2048]] as const) lines = max(lines, mul(max(g.bit(flags, edge), g.bit(flags, ground)), g.line(distance, pixel, mix(W, Wg, g.bit(flags, ground)))));
  const detail = sub(1, g.smooth(15, 30, g.distance)), pk = mul(mul(sw(g.u('uPaintK'), 'x'), choose(g.eq(surf, 1), 0, 1)), detail);
  const wet = mul(sw(misc, 'z'), sub(1, g.u('uDry'))), Qx = sw(q, 'x'), Qy = sw(q, 'y');
  // Every kind takes exactly one paint (its own, or the explicit surface's): the kind chain carries the colour the paint
  // multiplies and kind 1's window light beside it, so the chain samples nothing and branches per kind, and the one paint
  // is sampled after it with the kind's parameters (none where its strength is 0, past the detail range)
  let colour: Ref = base, emit: Ref = mul(base, sw(misc, 'x'));
  const use = (k: number, col: Ref, ink: Ref): void => { const on = g.eq(kind, k); colour = choose(on, col, colour); lines = choose(on, max(lines, ink), lines); };
  const grid = div(q, g.vec(sw(pat, 'z'), sw(pat, 'y'))), cell = g.floor(grid), local = g.fract(grid), gridFw = max(g.op('fwidth', [grid]), [1e-6, 1e-6]), seed = sw(pat, 'w');
  // kind 1's unpainted share, built after the paint (the predecessor's node order)
  let glassAdd: () => Ref;
  if (nr13) {
    const cell1 = facadeCell(g, q, gu, gv, Wr, sw(pat, 'y'), sw(pat, 'z'), seed);
    use(1, mul(base, cell1.wall), cell1.ink);
    emit = choose(g.eq(kind, 1), mul(add(emit, cell1.emit), cell1.keep), emit);
    glassAdd = () => cell1.glass;
  } else {
    const win = mul(g.cover(sw(local, 'x'), 0.17, 0.83, sw(gridFw, 'x')), g.cover(sw(local, 'y'), 0.24, 0.82, sw(gridFw, 'y'))), isLit = g.step(g.hash(add(cell, mul(seed, 7))), 0.5), cool = g.step(0.92, g.hash(add(cell, seed)));
    const light = mix(g.u('uWinWarm'), g.u('uWinCool'), cool), windowC = mix(mul(base, g.u('uWinDark')), mul(light, 0.6), isLit);
    use(1, mul(base, sub(1, win)), mul(max(g.rule(Qy, sw(pat, 'y'), gv, mul(Wr, 0.8)), g.rule(Qx, sw(pat, 'z'), gu, mul(Wr, 0.45))), 0.65));
    emit = add(emit, mul(light, mul(mul(win, isLit), choose(g.eq(kind, 1), 1.15, 0))));
    glassAdd = () => mul(windowC, win);
  }
  const pitch = g.u('uTilePitch'), tiles = mul(base, add(0.93, mul(g.hash(g.floor(div(q, pitch))), 0.14)));
  use(2, tiles, max(g.rule(Qy, sw(pitch, 'y'), gv, mul(Wr, 0.8)), mul(g.rule(Qx, sw(pitch, 'x'), gu, mul(Wr, 0.55)), 0.8)));
  const p = sw(g.world, 'xz'), course = g.floor(div(sw(p, 'y'), 0.62)), length = add(0.64, mul(g.h11(add(mul(course, 9.1), 2)), 0.28)), offset = mul(g.h11(mul(course, 3.7)), 1.1);
  const cx = g.floor(div(add(sw(p, 'x'), offset), length)), stoneLocal = g.vec(sub(add(sw(p, 'x'), offset), mul(cx, length)), sub(sw(p, 'y'), mul(course, 0.62))), stoneSize = g.vec(length, 0.62);
  const stoneFw = max(g.op('fwidth', [p]), [1e-5, 1e-5]), stoneEdge = min(stoneLocal, sub(stoneSize, stoneLocal)), jointW = max(min(mul(stoneFw, 1.1), [0.012, 0.012]), g.u('uFlagJoint'));
  const joint2 = mul(sub(1, g.smooth(jointW, add(jointW, stoneFw), stoneEdge)), g.smooth(4, 9, div(stoneSize, stoneFw))), joint = max(sw(joint2, 'x'), sw(joint2, 'y'));
  const id = g.hash(g.vec(cx, course)), puddle = g.smooth(0.42, 0.72, add(mul(g.noise(add(mul(p, 0.21), 3)), 0.6), mul(g.noise(mul(p, 0.83)), 0.4))), wAmt = choose(g.gt(wet, 0), mul(wet, mix(0.55, 1, puddle)), 0);
  const speckle = add(add(mul(g.noise(mul(p, 23)), 0.4), mul(g.noise(mul(p, 61)), 0.35)), mul(g.noise(mul(p, 157)), 0.25));
  let stone = mul(mul(base, add(sub(1, mul(sw(g.u('uFlag'), 'x'), 0.6)), mul(sw(g.u('uFlag'), 'x'), id))), add(sub(1, mul(sw(g.u('uFlag'), 'y'), 0.5)), mul(sw(g.u('uFlag'), 'y'), speckle)));
  stone = mul(stone, sub(1, mul(wAmt, 0.6)));
  use(3, stone, mul(joint, 0.6));
  const wetPool = choose(g.eq(kind, 3), mul(wAmt, sub(1, joint)), mul(mul(wet, 0.5), g.step(0.6, sw(g.normal, 'y'))));
  const fresnel = add(0.04, mul(g.pow(sub(1, g.clamp(g.op('dot', [g.normal, g.view]))), 5), 0.96));
  const reflection = sub(mul(g.normal, mul(g.op('dot', [g.normal, g.view]), 2)), g.view), spec = g.u('uLpSpec');
  // the light volume's four reflection taps only where a sheen shows (gloss or wet, inside the detail range)
  const sheenK = mul(max(mul(gloss, 0.45), wetPool), mul(fresnel, detail));
  const sheen = choose(g.gt(sheenK, 0), mul(mul(add(mul(g.raw(add(g.world, mul(reflection, sw(spec, 'y')))), 0.6), mul(g.raw(add(g.world, mul(reflection, sw(spec, 'z')))), 0.4)), sw(spec, 'x')), sheenK), [0, 0, 0]);
  emit = add(emit, add(sheen, mul(g.u('uFogBaseCol'), mul(mul(wetPool, fresnel), sw(g.u('uWetSky'), 'x')))));
  // NR13: the wet treads' glints (LEGACY style.ts, E281): a step's tread (a narrow wet top, under 0.6 m deep) catches light
  // along its long edges, just inside the ruled ground line: broken cells of light that twinkle, the lamps' and the sky's
  // reflection; far off they average into one bright line. Looking up a flight a riser's top edge (a low, long wet face) is
  // the nosing seen from below and takes the same glints. The shared `uGlint` row's constants are the graph's own param
  // (no frame channel), and each cell keeps one phase of LEGACY's twinkle: the kit graph reads no clock
  if (nr13) {
    const glint = g.p('treadGlint', 'vec4', SHARED.uGlint.v4), ny = sw(g.normal, 'y'), lo = min(w, h);
    const tread = mul(g.step(0.9, ny), sub(1, g.step(0.6, lo))), riser = mul(mul(sub(1, g.step(0.3, g.abs(ny))), sub(1, g.step(0.5, h))), g.step(mul(h, 2), w));
    const across = mul(tread, sub(1, g.step(h, w))), onRiser = mul(riser, sub(1, tread));
    const dpxU = min(div(x, gu), div(sub(w, x), gu)), dpxV = min(div(y, gv), div(sub(h, y), gv));
    const dE = choose(g.gt(onRiser, 0.5), div(sub(h, y), gv), choose(g.gt(across, 0.5), dpxU, dpxV));
    const along = choose(g.gt(across, 0.5), y, x), ga = choose(g.gt(across, 0.5), gv, gu), edgeW = mul(Wg, 0.5);
    const band = mul(g.smooth(sub(edgeW, 0.5), add(edgeW, 0.5), dE), sub(1, g.smooth(add(edgeW, 1.5), add(edgeW, 3), dE)));
    const cellL = sw(glint, 'w'), runs = choose(g.gt(across, 0.5), sw(g.world, 'x'), sw(g.world, 'z'));
    const hc = g.hash(g.vec(g.floor(div(along, cellL)), add(add(mul(seed, 7), g.floor(mul(sw(g.world, 'y'), 5))), g.floor(mul(runs, 3)))));
    const twinkle = add(0.55, mul(g.op('sin', [mul(hc, 40)]), 0.45));
    const spark = mul(mul(g.step(sub(1, sw(glint, 'y')), hc), twinkle), sub(1, g.smooth(0.2, 0.45, g.abs(sub(g.fract(div(along, cellL)), 0.5)))));
    const glintOn = mul(mul(mul(g.step(1e-4, sw(glint, 'x')), g.step(0.3, wet)), max(tread, riser)), detail);
    const gk = mul(mul(mix(mul(sw(glint, 'y'), 0.45), spark, g.smooth(0.7, 2.5, div(cellL, max(ga, 1e-5)))), band), glintOn);
    const glintLight = add(add(mul(g.raw(add(g.world, mul(reflection, 1.5))), 1.5), mul(g.u('uFogBaseCol'), 0.45)), mul(min(spill, [1, 1, 1]), sw(glint, 'z')));
    emit = add(emit, choose(g.gt(gk, 0), mul(glintLight, mul(mul(gk, sw(glint, 'x')), wet)), [0, 0, 0]));
  }
  const cp = sw(pat, 'z'), bars = g.rule(Qx, cp, gu, mul(Wr, 0.9)), mid = mul(g.line(g.abs(sub(y, mul(h, 0.5))), gv, mul(Wr, 0.8)), g.step(0.5, sw(pat, 'y')));
  const barCoverage = max(max(bars, mid), lines); use(4, base, barCoverage);
  const inset = min(min(x, sub(w, x)), min(y, sub(h, y))), density = g.smooth(3, 7, div(0.06, fw));
  const panelLines = mul(max(g.line(g.abs(sub(inset, 0.06)), fw, mul(Wr, 0.8)), g.line(g.abs(sub(inset, 0.12)), fw, mul(Wr, 0.55))), density);
  let panelLayer: Ref = choose(g.gt(surf, 4.5), 7, choose(g.gt(accent, 0.5), 6, 3)), panel: { at: Ref; scale: Ref; strength: Ref } | null = null;
  if (nr13) {
    // NR16: LEGACY's kind 5 (style.ts), a carved stone or timber panel: the double inset frame over a shade deeper field and
    // two ruyi clouds a bay, carved; a balustrade-sized stone panel takes the carved frieze paint instead (uPaintStone.y,
    // the frieze then replaces the frame and clouds), any other stone panel the wall paint, a board (accent) lacquer and a
    // timber one (surf 5) planks. Its predecessor painted every panel with the panel layer at full strength: rubble
    const isBoard = max(accent, mul(g.step(4.5, surf), g.step(surf, 5.5))), ratio = div(w, max(h, 1e-3));
    const friezeFace = mul(mul(g.step(0.3, h), g.step(h, 1.2)), mul(g.step(1.8, ratio), g.step(ratio, 8)));
    const keep = sub(1, mul(mul(mul(pk, friezeFace), sub(1, isBoard)), sw(g.u('uPaintStone'), 'y')));
    const fh = max(sub(min(w, h), 0.24), 0.05), cw = mul(fh, 1.5), fp = g.vec(div(sub(x, 0.12), cw), div(sub(y, 0.12), fh));
    const mc = g.vec(g.fract(sw(fp, 'x')), sw(fp, 'y')), inField = g.step(0.12, inset), dm = g.smooth(8, 16, div(fh, fw)), size = g.vec(cw, fh);
    const d1 = mul(sub(mc, [0.3, 0.46]), size), d2 = mul(sub(mc, [0.7, 0.54]), size), r1 = mul(fh, 0.26), r2 = mul(fh, 0.24);
    const l1 = g.op('length', [d1]), l2 = g.op('length', [d2]);
    const s1 = min(add(g.abs(sub(l1, r1)), mul(g.step(sw(d1, 'y'), mul(fh, -0.02)), 9)), g.abs(sub(l1, mul(r1, 0.5))));
    const s2 = min(add(g.abs(sub(l2, r2)), mul(g.step(mul(fh, 0.02), sw(d2, 'y')), 9)), g.abs(sub(l2, mul(r2, 0.5))));
    const join = add(g.abs(sub(mul(sub(sw(mc, 'y'), 0.5), fh), mul(mul(sub(sw(mc, 'x'), 0.5), cw), 0.25))), mul(g.step(0.2, g.abs(sub(sw(mc, 'x'), 0.5))), 9));
    const carve = min(min(s1, s2), join), relief = mul(mul(inField, dm), keep);
    const ink = max(mul(panelLines, keep), mul(mul(g.line(carve, fw, mul(Wr, 0.55)), relief), 0.9));
    const field = mul(base, mix(1, 0.9, mul(mul(g.step(0.12, inset), density), keep)));
    use(5, mul(field, sub(1, mul(mul(sub(1, g.smooth(0, mul(fh, 0.1), carve)), relief), 0.07))), ink);
    const timber = g.gt(surf, 4.5), board = g.gt(isBoard, 0.5), frieze = g.gt(friezeFace, 0.5);
    panelLayer = choose(board, choose(timber, 7, 6), choose(frieze, 3, 2));
    panel = { at: choose(g.op('and', [frieze, g.op('not', [board])]), sw(face, 'xy'), q),
      scale: choose(board, choose(timber, [1.5, 1.5], [1.3, 1.3]), choose(frieze, sz, [1.7, 1.7])),
      strength: choose(board, mul(mul(pk, sw(g.u('uPaintK'), 'w')), choose(timber, 1, 0.6)),
        mul(mul(pk, sw(g.u('uPaintK'), 'z')), choose(frieze, sw(g.u('uPaintStone'), 'y'), sw(g.u('uPaintStone'), 'x')))) };
  } else use(5, mul(base, mix(1, 0.9, mul(g.step(0.12, inset), density))), panelLines);
  const rq = mul(g.vec(add(Qx, Qy), sub(Qx, Qy)), 0.7071), gr = max(footprint(sw(rq, 'x')), footprint(sw(rq, 'y'))), meshCoverage = max(max(g.rule(sw(rq, 'x'), cp, gr, mul(Wr, 0.8)), g.rule(sw(rq, 'y'), cp, gr, mul(Wr, 0.8))), lines);
  use(6, base, meshCoverage);
  const leaf = div(g.projected(g.world), 0.24), leafCell = g.floor(leaf), leafLocal = g.fract(leaf), leafFw = max(g.op('fwidth', [sw(leaf, 'x')]), g.op('fwidth', [sw(leaf, 'y')]));
  // A jittered cell boundary gives the same fine gongbi ruling without nine unrolled neighbour copies.
  const leafEdge = min(min(sw(leafLocal, 'x'), sub(1, sw(leafLocal, 'x'))), min(sw(leafLocal, 'y'), sub(1, sw(leafLocal, 'y'))));
  use(7, mul(base, add(0.72, mul(g.hash(leafCell), 0.55))), mul(g.line(leafEdge, leafFw, mul(Wr, 0.6)), mul(g.smooth(2.5, 6, div(1, leafFw)), 0.45)));
  use(8, mix(base, [0.86, 0.84, 0.78], mul(g.cover(g.fract(div(Qx, cp)), 0, 0.5, div(gu, cp)), sw(pat, 'y'))), 0);
  const surfaceLayer = choose(g.eq(surf, 4), 6, choose(g.eq(surf, 5), 7, choose(g.op('or', [g.eq(surf, 3), g.eq(surf, 6)]), 4, 2)));
  const own = (k: number, value: Ref, other: Ref): string => choose(g.eq(kind, k), value, other);
  const paintAt = own(3, p, panel === null ? q : own(5, panel.at, q)), paintLayer = own(1, 4, own(2, 5, own(3, 0, own(5, panelLayer, surfaceLayer))));
  // NR13: an explicit surface paints as LEGACY's (style.ts): a wall (surf 2, or bare stone) layer 2 at 1.7 m and
  // pk·uPaintK.z·uPaintStone.x, rough stone (3, 6) layer 4 at 6 m and ·uPaintStone.z, faces (4, 5) layers 6 / 7 at 1.3 / 1.5 m
  // and pk·uPaintK.w; a face with no surface takes no paint (its predecessor painted it at full pk: blotched walls)
  const wallScale = (): string => nr13 ? choose(g.eq(surfaceLayer, 4), 6, choose(g.eq(surfaceLayer, 6), 1.3, choose(g.eq(surfaceLayer, 7), 1.5, 1.7))) : choose(g.eq(surfaceLayer, 4), 6, 1.7);
  const scaleNow = nr13 ? wallScale() : null;
  const paintScale = own(1, [6, 6], own(2, pitch, own(3, [2.4, 2.4], own(5, panel?.scale ?? [1.5, 1.5], scaleNow === null ? g.vec(wallScale(), wallScale()) : g.vec(scaleNow, scaleNow)))));
  const surfaceStrength = ((): Ref => {
    if (!nr13) return pk;
    const bare = choose(g.op('and', [g.lt(surf, 0.5), g.eq(kind, 9)]), 2, surf), stoneK = mul(pk, sw(g.u('uPaintK'), 'z'));
    return choose(g.eq(bare, 2), mul(stoneK, sw(g.u('uPaintStone'), 'x')), choose(g.op('or', [g.eq(bare, 3), g.eq(bare, 6)]), mul(stoneK, sw(g.u('uPaintStone'), 'z')),
      choose(g.op('or', [g.eq(bare, 4), g.eq(bare, 5)]), mul(pk, sw(g.u('uPaintK'), 'w')), 0)));
  })();
  const paintStrength = own(1, mul(mul(pk, sw(g.u('uPaintK'), 'z')), sw(g.u('uPaintStone'), 'z')), own(2, nr13 ? 0 : mul(pk, sw(g.u('uPaintK'), 'w')), own(3, mul(mul(pk, sw(g.u('uPaintK'), 'y')), g.u('uPaintFlag')), own(5, panel?.strength ?? mul(pk, sw(g.u('uPaintK'), 'w')), surfaceStrength))));
  // NR16: the facade cell and the wall / rough-stone surfaces paint as LEGACY's paintWall (layers 2 and 4); glazed tiles
  // (kind 2) take only their per-tile tint and ruled courses, no paint (LEGACY's surface paint skips kinds 1, 2, 3 and 5)
  const wallPaint = nr13 ? { on: choose(g.op('or', [g.eq(paintLayer, 2), g.eq(paintLayer, 4)]), 1, 0), seed } : undefined;
  const painted = choose(g.gt(paintStrength, 0), g.paint(paintAt, paintLayer, paintScale, paintStrength, own(2, 3, own(3, 2.5, 2)), wallPaint), [1, 1, 1]);
  colour = add(mul(colour, painted), choose(g.eq(kind, 1), glassAdd(), [0, 0, 0]));
  const surface = colour;
  const shaded = g.shade(colour), wetShade = mul(shaded, mul(sub(1, mul(wet, mix(0.6, 0.9, g.step(0.6, sw(g.normal, 'y'))))), mix([1, 1, 1], [0.88, 0.95, 1.1], wet)));
  colour = choose(g.eq(kind, 3), shaded, wetShade);
  // NR16: LEGACY adds the baked neon spill on the unshaded surface (its kit's col), half of it on wet faces but the
  // flagstones; the port lit the shaded colour, so a wall facing away from the key took its spill through uShade (B back's
  // glazed tiles read lilac-grey where LEGACY's are pale pink)
  const spillOn = nr13 ? mul(surface, choose(g.eq(kind, 3), 1, sub(1, mul(wet, 0.5)))) : colour;
  colour = add(colour, mul(mul(spillOn, min(spill, [0.7, 0.7, 0.7])), mul(1.3, mix(1, 0.4, accent))));
  const deep = mul(sub(1, g.smooth(-150, 70, sw(g.world, 'y'))), 0.9), luminance = g.op('dot', [colour, [0.2126, 0.7152, 0.0722]]);
  const deepC = mix(g.u('uPaperDeep'), g.u('uPaper'), g.clamp(mul(luminance, 1.6)));
  colour = mix(colour, mix(deepC, mul(colour, 0.5), mul(accent, 0.6)), mul(deep, 0.85));
  emit = mix(emit, mul(g.u('uSutraWin'), g.op('dot', [emit, [0.33, 0.33, 0.33]])), mul(deep, 0.7));
  const inkGold = mix(mul(g.u('uGold'), 1.35), g.u('uGoldDim'), g.smooth(8, 150, g.distance));
  colour = mix(colour, inkGold, mul(mul(g.clamp(lines), gold), sub(1, g.smooth(sw(g.u('uLineFade'), 'x'), sw(g.u('uLineFade'), 'y'), g.distance))));
  emit = add(emit, mul(g.u('uGold'), mul(mul(g.clamp(lines), gold), 0.8)));
  const grain = sub(sw(g.tex('uSilk', mul(g.projected(g.world), 1.9)), 'x'), 0.5);
  colour = mul(colour, add(1, mul(mul(grain, g.u('uWeave')), mul(detail, 2))));
  const pixel = g.floor(g.coord), bx = g.op('mod', [sw(pixel, 'x'), 4]), by = g.op('mod', [sw(pixel, 'y'), 4]);
  let threshold: Ref = 0;
  for (const [i, value] of [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].entries()) threshold = choose(g.eq(add(bx, mul(by, 4)), i), value / 16 + 1 / 32, threshold);
  const coverage = choose(g.eq(kind, 4), barCoverage, meshCoverage), clippedKind = g.op('or', [g.eq(kind, 4), g.eq(kind, 6)]);
  const discard = g.op('and', [clippedKind, g.op('lte', [coverage, threshold])]);
  return { ...g.output(colour, emit, cut ? choose(clippedKind, 1, lines) : lines, true, cut ? { surface: { discard } } : {}), doubleSided: cut };
}
