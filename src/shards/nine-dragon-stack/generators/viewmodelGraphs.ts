import { heldRigGraphs } from './heldRigGraphs';
import { Color } from 'three';
import { heldEffects } from './heldEffects';
import type { GraphIr, GraphRef, GraphParam } from '@wildshard/format/materialGraph';
import { LookGraph } from './lookGraph';
import rows from '../data/viewmodelUniforms.json' with { type: 'json' };
import decals from '../data/decals.json' with { type: 'json' };
import motion from '../data/clothMotion.json' with { type: 'json' };

const C = decals.classes;
type Ref = GraphRef;
class Vm extends LookGraph {
  u(name: keyof typeof rows): string {
    const row = rows[name];
    if (typeof row === 'number') return this.p(name, 'float', row);
    if ('rgb' in row) return this.p(name, 'vec3', new Color(row.rgb).toArray());
    if ('v2' in row) return this.p(name, 'vec2', row.v2);
    if ('v3' in row) { const v = row.v3; const len = 'normalize' in row ? Math.hypot(...v) : 1; return this.p(name, 'vec3', v.map(x => x / len)); }
    if ('v4' in row) return this.p(name, 'vec4', row.v4);
    throw new Error('Palette is an array');
  }
  tex(name: string, uv: Ref): string { this.params[name] = { type: 'texture', role: 'lent', value: name }; return this.op('texture', [uv], { param: name }); }
  choose(c: Ref, a: Ref, b: Ref): string { return this.op('select', [c, a, b]); }
  eq(a: Ref, b: Ref): string { return this.op('eq', [a, b]); }
  gt(a: Ref, b: Ref): string { return this.op('gt', [a, b]); }
  neg(a: Ref): string { return this.mul(a, -1); }
  pow(a: Ref, b: Ref): string { return this.op('pow', [a, b]); }
  norm(a: Ref): string { return this.op('normalize', [a]); }
  dot(a: Ref, b: Ref): string { return this.op('dot', [a, b]); }
  view(a: Ref): string { return this.vec(...[[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(axis => this.dot(a, this.op('viewToWorld', [axis])))); }
  dir(a: Ref): string { return this.v(this.view(this.op('localToWorldVector', [this.op('skinDirection', [a])]))); }
  attr(name: string, type: NonNullable<GraphParam['type']> & ('vec3' | 'vec4'), flat = false): string { return this.op('varying', [this.a(name, type)], flat ? { interpolation: 'flat' } : {}); }
  band(x: Ref, e: number): string { const w = this.mul(this.max(this.op('fwidth', [x]), 1e-4), .75); return this.smooth(this.sub(e, w), this.add(e, w), x); }
  line(d: Ref, fw: Ref, w: Ref): string { return this.mul(this.clamp(this.sub(this.add(this.mul(this.max(w, 1), .5), .5), this.div(d, this.max(fw, 1e-6)))), this.min(w, 1)); }
  finishVm(colour: Ref, extra: GraphIr['stages'] = {}): GraphIr { return { ...this.finish({ ...extra, surface: { colour } }, { fog: false, depthWrite: true, singlePass: true }), doubleSided: false }; }
}

/** The same held draws, expressed as bounded arithmetic; no added hull draw. */
export function viewmodelGraphs(): Readonly<Record<string, GraphIr>> {
  const g = new Vm(), sw = g.sw.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), mul = g.mul.bind(g), div = g.div.bind(g), max = g.max.bind(g), mix = g.mix.bind(g), choose = g.choose.bind(g), band = g.band.bind(g);
  const cls = g.op('floor', [add(sw(g.attr('aMat', 'vec4', true), 'x'), .5)]), mat = g.attr('aMat', 'vec4', true), face = g.attr('aFace', 'vec4'), uv = g.op('uv');
  g.arrays['uPal'] = { type: 'vec3', value: rows.uPal.rgbs.map(hex => new Color(hex).toArray()) };
  const base = mul(g.op('arrayElement', [cls], { param: 'uPal' }), g.clamp(add(1, mul(sub(sw(choose(g.gt(g.p('uTexOn', 'float', 0), .5), sw(g.tex('uMapsTex', uv), 'xyz'), g.op('vertexColour')), 'z'), .5), g.u('uDetail'))), .35, 1.6));
  const maps = choose(g.gt(g.p('uTexOn', 'float', 0), .5), sw(g.tex('uMapsTex', uv), 'xyz'), g.op('vertexColour'));
  const normal = g.norm(g.view(g.op('normalWorld'))), macro = g.norm(g.dir(g.a('aNs', 'vec3')));
  const nb = sub(mul(sw(g.tex('uNrmTex', uv), 'xyz'), 2), 1), nl = g.vec(sw(nb, 'x'), sw(nb, 'z'), g.neg(sw(nb, 'y')));
  const axes = ['X', 'Y', 'Z'].map((axis, i) => g.dir(g.p(`asset${axis}`, 'vec3', [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0])));
  const nv = g.norm(add(add(mul(axes[0] ?? '', sw(nl, 'x')), mul(axes[1] ?? '', sw(nl, 'y'))), mul(axes[2] ?? '', sw(nl, 'z'))));
  let n: Ref = choose(g.gt(g.p('uTexOn', 'float', 0), .5), g.norm(mix(normal, nv, mul(.8, g.smooth(.2, .55, g.dot(nv, normal))))), normal);
  n = choose(g.op('frontFacing'), n, g.neg(n));
  const nm = choose(g.op('frontFacing'), macro, g.neg(macro)), view = g.norm(g.neg(g.op('positionView'))), ndl = g.dot(nm, g.u('uKey'));
  const rim = g.pow(sub(1, g.clamp(g.dot(n, view))), 3), R = sub(g.neg(view), mul(n, mul(2, g.dot(n, g.neg(view))))), H = g.norm(add(g.u('uKey'), [.1, .25, .3]));
  const ao = mix(1, sw(maps, 'x'), sw(g.u('uTune'), 'z')), wear = mul(g.smooth(.62, .86, sw(maps, 'y')), sw(g.u('uTune'), 'y')), crease = mul(g.smooth(.3, .1, sw(maps, 'y')), sw(g.u('uTune'), 'x'));
  const env = mix(g.u('uEnvLo'), g.u('uEnvHi'), g.smooth(-.35, .45, sw(R, 'y'))), spec = (power: number): string => g.pow(max(g.dot(R, H), 0), power);
  const is = (...ids: number[]): string => ids.map(id => g.eq(cls, id)).reduce((a, b) => g.op('or', [a, b]));
  const v1 = band(ndl, -.22), v2 = band(ndl, .32);
  let metal: Ref = mix(mul(base, [.2, .13, .08]), mul(base, [.6, .48, .34]), v1);
  metal = mul(mix(metal, mul(base, 1.1), v2), mix(mix(.2, .42, v2), 1, ao));
  metal = mix(metal, [1.18, 1.02, .72], mul(band(spec(48), .8), v1));
  metal = mix(metal, add(mul(base, 1.3), .015), mul(mul(wear, .35), v1));
  metal = add(mix(metal, mul(mul(metal, env), 1.8), sw(g.u('uTune'), 'w')), mul(mul(base, .3), band(mul(rim, max(sw(n, 'y'), 0)), .25)));
  const sky = g.smooth(.78, .97, g.dot(R, g.norm([-.25, .85, .45]))), street = g.smooth(.6, .92, g.dot(R, g.norm([.3, -.7, .6])));
  let steel: Ref = mix(mix(mul(base, .6), base, band(ndl, -.32)), mul(base, 1.18), band(ndl, .06));
  steel = add(mix(steel, [.3, .36, .46], mul(sky, .5)), mul([.22, .08, .1], mul(street, .5)));
  steel = choose(is(C.bevel), mix(steel, [.45, .66, .74], add(.12, mul(.3, sky))), steel);
  steel = mul(steel, add(.9, mul(.12, div(sw(face, 'y'), max(sw(face, 'w'), 1e-4)))));
  const etch = g.p('uEtch', 'vec4', decals.JIAN_DECAL_UV.etch), fu = g.p('uFu', 'vec4', decals.JIAN_DECAL_UV.fu);
  const etchUv = g.vec(mix(sw(etch, 'x'), sw(etch, 'z'), sw(uv, 'y')), mix(sw(etch, 'y'), sw(etch, 'w'), sw(uv, 'x'))), etchK = mul(sw(g.tex('uDecal', etchUv), 'x'), sub(1, g.smooth(.8, .97, sw(uv, 'y'))));
  steel = choose(g.op('lt', [sw(mat, 'z'), -.5]), mix(steel, add([.42, .5, .58], mul(sky, .2)), mul(etchK, .42)), steel);
  let lacquer: Ref = mix(mix(mul(base, .8), add(mul(base, 1.9), .012), band(ndl, .06)), [.66, .68, .74], mul(band(spec(40), .5), .85));
  lacquer = mul(add(lacquer, mul(mul(env, .05), rim)), mix(.4, 1, ao));
  const paperUv = g.vec(mix(sw(fu, 'x'), sw(fu, 'z'), sw(uv, 'x')), mix(sw(fu, 'y'), sw(fu, 'w'), sw(uv, 'y'))), paperTex = sw(g.tex('uDecal', paperUv), 'xyz');
  const paper = add(mul(paperTex, mix(.62, 1, band(g.op('abs', [ndl]), .12))), mul(mul(paperTex, .15), rim));
  let matte: Ref = mul(base, mix(mix(.46, .72, band(ndl, -.28)), 1, band(ndl, .24)));
  const leather = add(matte, add(mul([.44, .44, .46], mul(g.smooth(.1, .9, spec(10)), .09)), mul(mul(env, .1), rim)));
  matte = choose(is(C.glove, C.leather), leather, choose(is(C.silk, C.trim), add(matte, mul(mul(mul(base, .4), band(rim, .35)), band(ndl, -.05))), choose(is(C.cloth, C.sleeve), mul(matte, .98), choose(is(C.carbon), add(matte, mul([.4, .44, .5], mul(band(spec(30), .4), add(.4, mul(.6, sw(maps, 'z')))))), matte))));
  matte = add(matte, mul(mul(mul(base, .3), band(rim, .55)), band(ndl, -.1)));
  matte = mul(mix(matte, add(mul(matte, 1.12), .02), mul(wear, .4)), mix(.42, 1, ao));
  let colour: Ref = choose(is(C.brass, C.brassDark, C.gold), metal, choose(is(C.steel, C.bevel), steel, choose(is(C.lacquer), lacquer, choose(is(C.glow), base, choose(is(C.paper), paper, matte)))));
  const pa = sub(g.op('positionView'), g.u('uBladeA')), ba = sub(g.u('uBladeB'), g.u('uBladeA')), h = g.clamp(div(g.dot(pa, ba), max(g.dot(ba, ba), 1e-8))), d = sub(pa, mul(ba, h)), dist = g.op('length', [d]);
  const facing = g.clamp(add(mul(g.dot(n, div(g.neg(d), max(dist, 1e-5))), .7), .3)), spill = mul(div(sw(g.u('uSpill'), 'w'), add(1, div(mul(dist, dist), .0009))), facing);
  colour = choose(is(C.glow, C.steel, C.bevel), colour, add(colour, mul(mul(choose(is(C.brass, C.brassDark, C.gold), add(mul(base, 1.4), .1), add([.35, .35, .35], base)), sw(g.u('uSpill'), 'xyz')), max(spill, 0))));
  colour = add(colour, mul(mul(mul(mul(base, g.u('uEnvLo')), .35), max(g.neg(sw(n, 'y')), 0)), sub(1, g.u('uSutra'))));
  const ff = max(g.op('fwidth', [sw(face, 'xy')]), [1e-6, 1e-6]), flags = g.op('floor', [add(sw(mat, 'w'), .5)]), width = mul(g.u('uLinePx'), sw(mat, 'z'));
  let lines: Ref = 0;
  for (const [distance, footprint, bit] of [[sw(face, 'x'), sw(ff, 'x'), 1], [sub(sw(face, 'z'), sw(face, 'x')), sw(ff, 'x'), 2], [sw(face, 'y'), sw(ff, 'y'), 4], [sub(sw(face, 'w'), sw(face, 'y')), sw(ff, 'y'), 8]] as const) lines = max(lines, mul(g.op('mod', [g.op('floor', [div(flags, bit)]), 2]), g.line(distance, footprint, width)));
  lines = choose(g.gt(sw(mat, 'z'), 0), lines, 0);
  const ink = mix(g.u('uInk'), mul(g.u('uGold'), 1.3), g.u('uSutra'));
  colour = mix(colour, mul(colour, [.55, .6, .85]), mul(g.u('uSutra'), .35));
  colour = mul(colour, add(1, mul(sub(sw(g.tex('uSilk', div(g.op('fragCoord'), 220)), 'x'), .5), .1)));
  colour = choose(is(C.glow), colour, mix(colour, ink, g.clamp(max(lines, mul(crease, .85)))));
  const body = g.finishVm(mul(add(colour, mul(base, sw(mat, 'y'))), g.u('uExposure')));

  const k = new Vm(), ks = k.sw.bind(k), km = k.mul.bind(k), ka = k.add.bind(k), kc = k.a('aMat', 'vec4'), ci = k.op('floor', [ka(ks(kc, 'x'), .5)]);
  const built = [C.brass, C.brassDark, C.steel, C.lacquer, C.bevel, C.gold, C.carbon].map(id => k.eq(ci, id)).reduce((a, b) => k.op('or', [a, b]));
  const seed = k.dot(k.op('positionGeometry'), [311, 473, 231]), si = k.op('floor', [seed]), sf = k.op('fract', [seed]);
  const hash = (p: Ref): string => { let v = k.op('fract', [km(p, .1031)]); v = km(v, ka(v, 33.33)); return k.op('fract', [km(v, ka(v, v))]); };
  const noise = k.mix(hash(si), hash(ka(si, 1)), km(km(sf, sf), k.sub(3, km(sf, 2))));
  const brush = k.choose(built, 1, ka(.5, km(1.2, noise))), widthK = km(km(km(k.u('uHullPx'), k.p('uHullK', 'float', 1)), brush), k.choose(built, 1, 1.35));
  const w = k.choose(k.op('or', [k.eq(ci, C.glow), k.eq(ci, C.bevel)]), 0, widthK);
  const nvK = k.view(k.op('normalWorld')), dir = k.norm(ka(ks(nvK, 'xy'), [1e-5, 1e-5]));
  const viewK = k.view(k.sub(k.op('positionWorld'), k.op('cameraPosition'))), proj = k.p('projection', 'vec4', [1, 1, -1, -.2]), clipW = k.neg(ks(viewK, 'z'));
  const xy = ka(k.vec(km(ks(viewK, 'x'), ks(proj, 'x')), km(ks(viewK, 'y'), ks(proj, 'y'))), km(k.div(km(dir, km(w, 2)), k.u('uRes')), clipW));
  const clip = k.vec(xy, ka(ka(km(ks(viewK, 'z'), ks(proj, 'z')), ks(proj, 'w')), km(.0004, clipW)), clipW);
  const hull = k.finishVm(k.mix(k.u('uInk'), km(k.u('uGold'), 1.3), k.u('uSutra')), { 'vertex.normal': { normal: k.a('aHullN', 'vec3') }, 'vertex.clip': { position: clip } });
  const bases = { 'nine-vm-body': body, 'nine-vm-hull': hull, 'nine-vm-cloth': flutter(body), 'nine-vm-cloth-hull': flutter(hull) };
  const withHullWidth = (source: GraphIr, value: number): GraphIr => ({ ...source, params: { ...source.params, uHullK: { type: 'float', value } } });
  return { 'nine-vm-sheet': { ...bases['nine-vm-cloth'], doubleSided: true }, ...bases, ...heldEffects(), ...heldRigGraphs(bases), 'nine-vm-knot-hull': withHullWidth(hull, .55), 'nine-vm-hair-hull': withHullWidth(bases['nine-vm-cloth-hull'], .18), 'nine-vm-thin-hull': withHullWidth(bases['nine-vm-cloth-hull'], .55) };
}

/** Both existing cloth draws read the same baked field; no mutable geometry or frame callback. */
function flutter(source: GraphIr): GraphIr {
  const g = new LookGraph();
  Object.assign(g.nodes, source.nodes); Object.assign(g.params, source.params); Object.assign(g.arrays, source.arrays);
  const field = g.a('aCloth', 'vec4'), time = g.p('uTime', 'float', 0), phase = g.sw(field, 'y');
  const wave = (speed: number): string => g.op('sin', [g.add(g.mul(time, speed), phase)]);
  const offset = g.mul(g.vec(wave(motion.speed), 0, g.mul(wave(motion.secondSpeed), g.sw(field, 'z'))), g.sw(field, 'x'));
  let stages = source.stages;
  if (stages['vertex.clip'] === undefined) stages = { ...stages, 'vertex.position': { position: g.add(g.op('positionGeometry'), offset) } };
  else {
    const world = g.op('positionWorld'), delta = g.op('localToWorldVector', [offset]);
    for (const [id, row] of Object.entries(source.nodes)) if (row.op === 'positionWorld') g.nodes[id] = { op: 'add', in: [world, delta] };
  }
  const graph = g.finish(stages, source.effectState);
  return { ...graph, doubleSided: source.doubleSided ?? false };
}
