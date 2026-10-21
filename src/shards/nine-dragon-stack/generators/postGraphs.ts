import type { GraphIr, GraphRef, GraphNode } from '@wildshard/format/materialGraph';
import type { ScaledPostRow } from '@wildshard/format/scaledPost';
import { LookGraph } from './lookGraph';

const FLAG = { rh: .62, l0: .64, lr: .28, bond: 1.1 };

type Ref = GraphRef;
class Screen extends LookGraph {
  static serial = 0;
  private readonly prefix = `p${Screen.serial++}_`;
  private readonly cache = new Map<string, string>();
  override op(op: string, inputs?: readonly Ref[], extra: Omit<GraphNode, 'op' | 'in'> = {}): string {
    const row = { op, ...(inputs === undefined ? {} : { in: inputs }), ...extra }, key = JSON.stringify(row), old = this.cache.get(key);
    if (old !== undefined) return old;
    const id = `${this.prefix}${Object.keys(this.nodes).length}`; this.nodes[id] = row; this.cache.set(key, id); return id;
  }
  readonly uv = this.op('screenUV');
  scalar(name: string, value = 0): string { return this.p(name, 'float', value); }
  v2(name: string, value: readonly number[] = [0, 0]): string { return this.p(name, 'vec2', value); }
  v3(name: string, value: readonly number[] = [0, 0, 0]): string { return this.p(name, 'vec3', value); }
  v4(name: string, value: readonly number[] = [0, 0, 0, 0]): string { return this.p(name, 'vec4', value); }
  tex(name: string, at: Ref, volume = false): string { this.params[name] = { type: 'texture', role: 'lent', value: name }; return this.op(volume ? 'texture3D' : 'texture', [at], { param: name }); }
  choose(c: Ref, a: Ref, b: Ref): string { return this.op('select', [c, a, b]); }
  gt(a: Ref, b: Ref): string { return this.op('gt', [a, b]); }
  lt(a: Ref, b: Ref): string { return this.op('lt', [a, b]); }
  and(a: Ref, b: Ref): string { return this.op('and', [a, b]); }
  neg(a: Ref): string { return this.mul(a, -1); }
  fract(a: Ref): string { return this.op('fract', [a]); }
  floor(a: Ref): string { return this.op('floor', [a]); }
  abs(a: Ref): string { return this.op('abs', [a]); }
  pow(a: Ref, b: Ref): string { return this.op('pow', [a, b]); }
  norm(a: Ref): string { return this.op('normalize', [a]); }
  dot(a: Ref, b: Ref): string { return this.op('dot', [a, b]); }
  length(a: Ref): string { return this.op('length', [a]); }
  sum(...xs: Ref[]): Ref { return xs.reduce((a, b) => this.add(a, b), 0); }
  h11(p: Ref): string { let v = this.fract(this.mul(p, .1031)); v = this.mul(v, this.add(v, 33.33)); return this.fract(this.mul(v, this.add(v, v))); }
  matrix(name: string, vector: Ref): string {
    this.arrays[name] = { type: 'vec4', value: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]] };
    return this.sum(...['x', 'y', 'z', 'w'].map((mask, i) => this.mul(this.op('arrayElement', [i], { param: name }), this.sw(vector, mask)))) as string;
  }
  view(at: Ref, depth: Ref): string { const v = this.matrix('invProj', this.vec(this.sub(this.mul(at, 2), 1), this.sub(this.mul(depth, 2), 1), 1)); return this.div(this.sw(v, 'xyz'), this.sw(v, 'w')); }
  z(depth: Ref): string { const nf = this.v2('uNF', [.1, 1000]), n = this.sw(nf, 'x'), f = this.sw(nf, 'y'); return this.neg(this.div(this.mul(n, f), this.sub(this.mul(this.sub(f, n), depth), f))); }
  depth(at: Ref): string { return this.sw(this.tex('tDepth', at), 'x'); }
  inv(at: Ref): string { const d = this.depth(at); return this.choose(this.lt(d, 1), this.choose(this.lt(d, .3), 2, this.div(1, this.max(this.z(d), this.sw(this.v2('uNF', [.1, 1000]), 'x')))), 0); }
  loop(count: number, initial: Ref, body: (g: Screen, acc: Ref, index: Ref) => Ref): string {
    const g = new Screen(), value = body(g, g.op('acc'), g.op('index'));
    Object.assign(this.params, g.params); Object.assign(this.arrays, g.arrays);
    return this.op('loop', [initial], { count, body: { nodes: g.nodes, out: value } });
  }
  finishScreen(colour: Ref, alpha: Ref = 1): GraphIr { return this.finish({ post: { colour, alpha } }, undefined, 'post'); }
}
function bleedPre(): GraphIr {
  const g = new Screen(), tx = g.v2('uTexel'), pre = g.v2('uPre', [1, .08]), glow = g.v4('uGlow'), glow2 = g.v4('uGlow2');
  let total: Ref = [0, 0, 0], weight: Ref = 0, alpha: Ref = 0;
  for (const offset of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const at = g.add(g.uv, g.mul(tx, offset)), c = g.sw(g.tex('tSrc', at), 'xyz'), peak = g.max(g.sw(c, 'x'), g.max(g.sw(c, 'y'), g.sw(c, 'z'))), knee = g.sw(pre, 'y');
    const soft = g.clamp(g.add(g.sub(peak, g.sw(pre, 'x')), knee), 0, g.mul(2, knee));
    const picked = g.mul(c, g.div(g.max(g.div(g.mul(soft, soft), g.add(g.mul(4, knee), 1e-4)), g.sub(peak, g.sw(pre, 'x'))), g.max(peak, 1e-4)));
    const w = g.div(1, g.add(1, g.max(g.sw(picked, 'x'), g.max(g.sw(picked, 'y'), g.sw(picked, 'z')))));
    total = g.add(total, g.mul(picked, w)); weight = g.add(weight, w);
    const gr = g.div(g.sw(c, 'y'), g.max(g.sw(c, 'x'), 1e-4));
    const amber = g.mul(g.smooth(.42, .56, gr), g.sub(1, g.smooth(.9, 1, gr)));
    const warm = g.mul(g.clamp(g.sub(g.mul(g.div(g.sub(g.sw(c, 'x'), g.sw(c, 'z')), g.max(g.sw(c, 'x'), 1e-4)), 1.7), .35)), amber);
    const z = g.div(1, g.max(g.inv(at), 1e-6));
    alpha = g.add(alpha, g.mul(g.mul(g.mul(g.min(g.max(g.sub(peak, g.sw(glow, 'y')), 0), 2), warm), g.smooth(g.sw(glow, 'z'), g.sw(glow, 'w'), z)), g.sw(glow, 'x')));
  }
  return g.finishScreen(g.min(g.div(total, weight), [64, 64, 64]), g.choose(g.gt(g.sw(glow2, 'w'), .5), g.mul(alpha, .25), 0));
}
function bleed(up: boolean): GraphIr {
  const g = new Screen(), tx = g.v2('uTexel');
  let sum: Ref = up ? [0, 0, 0, 0] : g.mul(g.tex('tSrc', g.uv), 4);
  for (const offset of (up ? [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]])) {
    sum = g.add(sum, g.mul(g.tex('tSrc', g.add(g.uv, g.mul(tx, offset))), up && Math.abs(offset[0] ?? 0) === 1 ? 2 : 1));
  }
  let out: Ref = g.div(sum, up ? 12 : 8); if (up) out = g.add(out, g.tex('tAdd', g.uv));
  return g.finishScreen(g.sw(out, 'xyz'), g.sw(out, 'w'));
}
function reflectTrace(): GraphIr {
  const g = new Screen(), sw = g.sw.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), mul = g.mul.bind(g), div = g.div.bind(g), max = g.max.bind(g), min = g.min.bind(g), d = g.depth(g.uv), P = g.view(g.uv, d), W = sw(g.matrix('world', g.vec(P, 1)), 'xyz');
  const rect = g.v4('uRect'), stairs = g.v4('uRect2'), tune = g.v4('uK'), march = g.v2('uMarch', [90, .25]), time = g.scalar('uTime');
  const inside = (r: Ref): string => g.and(g.and(g.op('gte', [sw(W, 'x'), sw(r, 'x')]), g.op('lte', [sw(W, 'x'), sw(r, 'z')])), g.and(g.op('gte', [sw(W, 'z'), sw(r, 'y')]), g.op('lte', [sw(W, 'z'), sw(r, 'w')])));
  const square = g.and(inside(rect), g.lt(g.abs(sub(sw(W, 'y'), sw(tune, 'x'))), .05));
  const tx = g.v2('uTexel'), differences = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(offset => { const at = add(g.uv, mul(tx, offset)); return mul(sub(g.view(at, g.depth(at)), P), (offset[0] ?? 0) + (offset[1] ?? 0)); });
  const dx = g.choose(g.lt(g.dot(differences[0] ?? '', differences[0] ?? ''), g.dot(differences[1] ?? '', differences[1] ?? '')), differences[0] ?? '', differences[1] ?? '');
  const dy = g.choose(g.lt(g.dot(differences[2] ?? '', differences[2] ?? ''), g.dot(differences[3] ?? '', differences[3] ?? '')), differences[2] ?? '', differences[3] ?? '');
  const nw = g.norm(sw(g.matrix('world', g.vec(g.norm(g.op('cross', [dx, dy])), 0)), 'xyz'));
  const floor = g.and(g.and(g.lt(d, 1), g.op('gte', [d, .3])), g.op('or', [square, g.and(inside(stairs), g.gt(g.abs(sw(nw, 'y')), .95))]));
  const p = sw(W, 'xz'), row = g.floor(div(sw(p, 'y'), FLAG.rh)), off = mul(g.h11(mul(row, 3.7)), FLAG.bond), len = add(FLAG.l0, mul(FLAG.lr, g.h11(add(mul(row, 9.1), 2))));
  const f = g.vec(g.fract(div(add(sw(p, 'x'), off), len)), g.fract(div(sw(p, 'y'), FLAG.rh))), fw = max(g.op('fwidth', [p]), [1e-5, 1e-5]), jointWidth = max(g.min(mul(fw, 1.1), [.012, .012]), g.scalar('uFlagJoint', .012));
  const j = sub(1, g.smooth(jointWidth, add(jointWidth, fw), mul(g.min(f, sub(1, f)), g.vec(len, FLAG.rh))));
  const joint = max(mul(sw(j, 'x'), g.smooth(4, 9, div(len, sw(fw, 'x')))), mul(sw(j, 'y'), g.smooth(4, 9, div(FLAG.rh, sw(fw, 'y')))));
  const puddle = g.smooth(.42, .72, add(mul(g.noise(add(mul(p, .21), 3)), .6), mul(g.noise(mul(p, .83)), .4))), wet = mul(g.mix(.55, 1, puddle), sub(1, joint));
  const wob = sub(g.vec(g.noise(add(mul(p, [1.7, .6]), mul(time, .21))), g.noise(add(sub(mul(p, [.6, 1.7]), mul(time, .17)), 9.1))), .5);
  const rc = g.floor(div(p, 1.1)), rp = g.fract(add(mul(time, .7), g.hash(add(rc, 5)))), centre = mul(add(add(rc, .2), mul(g.vec(g.hash(add(rc, 1)), g.hash(add(rc, 2))), .6)), 1.1), dv = sub(p, centre), rr = g.length(dv), rz = div(sub(rr, mul(rp, .3)), .03);
  const ring = mul(g.op('exp', [g.neg(mul(rz, rz))]), sub(1, rp)), tilt = add(mul(wob, sw(tune, 'z')), mul(mul(div(dv, max(rr, 1e-3)), ring), sw(tune, 'w')));
  const nW = g.norm(g.vec(sw(tilt, 'x'), 1, sw(tilt, 'y'))), nV = g.norm(sw(g.matrix('view', g.vec(nW, 0)), 'xyz')), V = g.norm(P), R = sub(V, mul(nV, mul(2, g.dot(V, nV))));
  const fresnel = add(.02, mul(.98, g.pow(sub(1, g.clamp(g.neg(g.dot(V, nV)))), 5))), near = sw(g.v2('uNF', [.1, 1000]), 'x');
  let P1: Ref = add(P, mul(R, sw(march, 'x')));
  P1 = g.choose(g.gt(sw(P1, 'z'), mul(near, -2)), add(P, mul(R, div(sub(mul(near, -2), sw(P, 'z')), max(sw(R, 'z'), 1e-4)))), P1);
  const H0 = g.matrix('proj', g.vec(P, 1)), H1 = g.matrix('proj', g.vec(P1, 1)), k0 = div(1, sw(H0, 'w')), k1 = div(1, sw(H1, 'w')), S0 = mul(sw(H0, 'xy'), k0), ds = sub(mul(sw(H1, 'xy'), k1), S0), z0 = mul(sw(P, 'z'), k0), z1 = mul(sw(P1, 'z'), k1);
  let fmax: Ref = 1;
  for (const mask of ['x', 'y']) fmax = min(fmax, g.choose(g.gt(g.abs(sw(ds, mask)), 1e-6), div(sub(g.choose(g.gt(sw(ds, mask), 0), 1, -1), sw(S0, mask)), sw(ds, mask)), 1));
  const jitter = g.hash(add(div(g.uv, tx), mul(g.fract(mul(time, 3.7)), 29))), maxF = fmax;
  let state: Ref = [0, -1];
  for (const start of [0, 14]) state = g.loop(14, state, (b, acc, index) => {
    const fraction = b.mul(maxF, b.pow(b.div(b.add(b.add(index, start), jitter), 28), 1.6)), uv = b.add(b.mul(b.add(S0, b.mul(ds, fraction)), .5), .5), sd = b.depth(uv);
    const qz = b.neg(b.div(b.mix(z0, z1, fraction), b.mix(k0, k1, fraction))), sz = b.z(sd), hit = b.and(b.and(b.lt(sd, 1), b.op('gte', [sd, .3])), b.and(b.gt(qz, b.add(sz, .03)), b.lt(qz, b.add(b.add(sz, .45), b.mul(.05, sz)))));
    return b.choose(b.gt(b.sw(acc, 'y'), 0), acc, b.choose(hit, b.vec(b.sw(acc, 'x'), fraction), b.vec(fraction, -1)));
  });
  const refined = g.loop(5, state, (b, acc) => { const a = b.sw(acc, 'x'), z = b.sw(acc, 'y'), mid = b.mul(b.add(a, z), .5), at = b.add(b.mul(b.add(S0, b.mul(ds, mid)), .5), .5), q = b.neg(b.div(b.mix(z0, z1, mid), b.mix(k0, k1, mid))); return b.choose(b.gt(q, b.add(b.z(b.depth(at)), .03)), b.vec(a, mid), b.vec(mid, z)); });
  const hitF = sw(refined, 'y'), hitUv = add(mul(add(S0, mul(ds, hitF)), .5), .5), hitT = g.length(sub(div(g.mix(mul(P, k0), mul(P1, k1), hitF), g.mix(k0, k1, hitF)), P));
  const edge = mul(g.smooth([0, 0], [.06, .1], hitUv), sub(1, g.smooth([.94, .86], [1, 1], hitUv))), conf = mul(mul(sw(edge, 'x'), sw(edge, 'y')), sub(1, g.smooth(mul(sw(march, 'x'), .6), sw(march, 'x'), hitT)));
  const light = mul(mul(mul(mul(fresnel, wet), sw(tune, 'y')), conf), min(sw(g.tex('tColor', hitUv), 'xyz'), [32, 32, 32]));
  return g.finishScreen(mul(light, g.choose(g.and(floor, g.gt(sw(state, 'y'), 0)), 1, 0)), g.choose(floor, 1, 0));
}
function reflectStreak(): GraphIr {
  const g = new Screen(), c = g.tex('tSrc', g.uv), step = g.v2('uStep'); let sum: Ref = g.sw(c, 'xyz'), weight: Ref = 1;
  for (let i = 1; i <= 6; i++) {
    const w = Math.exp(-i * i / 14), a = g.tex('tSrc', g.add(g.uv, g.mul(step, i))), b = g.tex('tSrc', g.sub(g.uv, g.mul(step, i)));
    sum = g.add(sum, g.mul(g.add(g.mul(g.sw(a, 'xyz'), g.sw(a, 'w')), g.mul(g.sw(b, 'xyz'), g.sw(b, 'w'))), w)); weight = g.add(weight, g.mul(g.add(g.sw(a, 'w'), g.sw(b, 'w')), w));
  }
  return g.finishScreen(g.choose(g.gt(g.sw(c, 'w'), 0), g.div(sum, weight), [0, 0, 0]), g.sw(c, 'w'));
}
function haze(): GraphIr {
  const g = new Screen(), h = g.v4('uHz'), h2 = g.v4('uHz2'), d = g.depth(g.uv), vr = g.view(g.uv, 1), dirV = g.norm(vr), dir = g.norm(g.sw(g.matrix('world', g.vec(dirV, 0)), 'xyz')), eye = g.sw(g.matrix('world', [0, 0, 0, 1]), 'xyz');
  const dist = g.choose(g.and(g.lt(d, 1), g.op('gte', [d, .3])), g.min(g.sw(h, 'y'), g.div(g.z(d), g.max(g.neg(g.sw(dirV, 'z')), 1e-4))), g.sw(h, 'y')), ds = g.div(dist, 14), jitter = g.hash(g.add(g.mul(g.uv, 1024), g.mul(g.fract(g.mul(g.sw(h2, 'y'), 7.31)), 53)));
  const acc = g.loop(14, [0, 0, 0], (b, sum, i) => {
    const p = b.add(eye, b.mul(dir, b.mul(b.add(i, jitter), ds))), ground = b.scalar('uGroundY'), hk = b.op('exp', [b.neg(b.div(b.max(b.sub(b.sw(p, 'y'), ground), 0), b.sw(h, 'z')))]);
    const nz = b.add(.5, b.mul(b.op('noise', [b.add(b.mul(p, [.22, .12, .22]), b.vec(0, b.mul(b.sw(h2, 'y'), .35), b.mul(b.sw(h2, 'y'), .08)))]), .5)), sigma = b.mul(b.mul(b.sw(h, 'x'), hk), b.mix(1, b.add(.4, b.mul(1.2, nz)), b.sw(h, 'w')));
    const volume = (suffix: string): string => { const uv = b.mul(b.sub(p, b.v3(`uLpMin${suffix}`)), b.v3(`uLpInv${suffix}`)); let inside: Ref = 1;
      for (const mask of ['x', 'y', 'z']) inside = b.mul(inside, b.mul(b.op('step', [0, b.sw(uv, mask)]), b.op('step', [b.sw(uv, mask), 1])));
      return b.mix([0, 0, 0, .5], b.tex(`uLpVol${suffix}`, uv, true), inside); };
    const sample = b.sw(b.choose(b.gt(b.sw(p, 'y'), b.sw(b.v3('uLpMinA'), 'y')), volume('A'), volume('B')), 'xyz'), e = b.mul(b.mul(sample, sample), b.scalar('uLpMax')), cut = b.v4('uLpCut');
    let raw: Ref = b.choose(b.gt(b.sw(cut, 'x'), 0), b.div(b.mul(e, e), b.add(e, b.sw(cut, 'x'))), e);
    raw = b.choose(b.gt(b.sw(cut, 'w'), 0), b.div(raw, b.add(1, b.div(b.max(b.sw(raw, 'x'), b.max(b.sw(raw, 'y'), b.sw(raw, 'z'))), b.max(b.sw(cut, 'w'), 1e-4)))), raw);
    return b.add(sum, b.mul(b.max(b.sub(b.min(raw, b.sw(h2, 'z')), b.sw(h2, 'w')), 0), sigma));
  });
  return g.finishScreen(g.min(g.mul(g.mul(acc, ds), g.add(1, g.mul(g.sw(h2, 'x'), g.sub(1, g.abs(g.sw(dir, 'y')))))), [8, 8, 8]));
}

/** The original target/draw schedule, with bounded graph programs in place of GLSL. */
export function postRows(): Readonly<Record<'bleed' | 'reflect' | 'haze', ScaledPostRow>> {
  Screen.serial = 0;
  const g = new Screen(), add = g.finishScreen(g.sw(g.tex('tSrc', g.uv), 'xyz'), 0);
  return {
    bleed: { name: 'NdBleedPass', programs: { bleedPre: { graph: bleedPre(), links: ['uGlow', 'uGlow2'], depth: 'tDepth', camera: { uNF: 'nearFar' } }, bleedDown: { graph: bleed(false) }, bleedUp: { graph: bleed(true) } },
      targets: { mip0: { name: 'NdBleed.mip0', of: 'input', scale: .25, filter: 'linear' }, up0: { name: 'NdBleed.up0', of: 'mip0', scale: 1, filter: 'linear' }, mip1: { name: 'NdBleed.mip1', of: 'mip0', scale: .5, filter: 'linear' }, up1: { name: 'NdBleed.up1', of: 'mip1', scale: 1, filter: 'linear' }, mip2: { name: 'NdBleed.mip2', of: 'mip1', scale: .5, filter: 'linear' } },
      draws: [{ program: 'bleedPre', to: 'mip0', textures: { tSrc: 'input' }, texel: { uniform: 'uTexel', of: 'input' } }, { program: 'bleedDown', to: 'mip1', textures: { tSrc: 'mip0' }, texel: { uniform: 'uTexel', of: 'mip0' } }, { program: 'bleedDown', to: 'mip2', textures: { tSrc: 'mip1' }, texel: { uniform: 'uTexel', of: 'mip1' } }, { program: 'bleedUp', to: 'up1', textures: { tSrc: 'mip2', tAdd: 'mip1' }, texel: { uniform: 'uTexel', of: 'mip2' } }, { program: 'bleedUp', to: 'up0', textures: { tSrc: 'up1', tAdd: 'mip0' }, texel: { uniform: 'uTexel', of: 'up1' } }], settings: {}, outputs: { tight: 'mip0', wide: 'up0' } },
    reflect: { name: 'NdReflectPass', programs: { reflectTrace: { graph: reflectTrace(), links: ['uRect', 'uRect2', 'uK', 'uFlagJoint'], depth: 'tDepth', camera: { proj: 'projection', invProj: 'projectionInverse', view: 'view', world: 'world', uNF: 'nearFar' }, pack: { uK: [{ param: 'ground' }, 'gain', 'wobble', 'rings'], uMarch: ['maxDist', .25], uTime: [{ param: 'time' }] } }, reflectStreak: { graph: reflectStreak(), pack: { uStep: [0, { setting: 'streak', div: 6, per: { target: 'trace', axis: 'height' } }] } } }, targets: { trace: { name: 'NdReflect.trace', of: 'input', scale: .5, filter: 'nearest' }, b: { name: 'NdReflect.b', of: 'input', scale: .5, filter: 'linear' } }, draws: [{ program: 'reflectTrace', to: 'trace', textures: { tColor: 'input' }, texel: { uniform: 'uTexel', of: 'input' } }, { program: 'reflectStreak', to: 'b', textures: { tSrc: 'trace' } }], settings: { gain: 2, maxDist: 90, wobble: .045, rings: .12, streak: 20 }, when: 'gain', outputs: { reflection: 'b' }, drawnOnly: true },
    haze: { name: 'NdHazePass', programs: { hazeMarch: { graph: haze(), links: ['uGroundY', 'uLpMax', 'uLpVolA', 'uLpMinA', 'uLpInvA', 'uLpVolB', 'uLpMinB', 'uLpInvB', 'uLpCut'], depth: 'tDepth', camera: { invProj: 'projectionInverse', world: 'world', uNF: 'nearFar' }, pack: { uHz: ['density', 'maxDist', 'height', 'drift'], uHz2: ['forward', { param: 'time' }, 'cap', 'thr'] } }, hazeAdd: { graph: add, blend: 'addKeepAlpha' } }, targets: { haze: { name: 'NdHaze', of: 'input', scale: .5, filter: 'linear' } }, draws: [{ program: 'hazeMarch', to: 'haze' }, { program: 'hazeAdd', to: 'input', textures: { tSrc: 'haze' } }], settings: { density: 0, maxDist: 70, height: 18, drift: .5, forward: .35, cap: 1.4, thr: 1 }, when: 'density', outputs: { haze: 'haze' } },
  };
}
