import { Color } from 'three';
import type { GraphIr, GraphRef } from '@wildshard/format/materialGraph';
import { LookGraph } from './lookGraph';

/** Held light ribbons use the same material graph interpreter as the world. */
export function heldEffects(): Readonly<Record<string, GraphIr>> {
  const g = new LookGraph(), s = g.sw.bind(g), m = g.mul.bind(g), a = g.add.bind(g), d = g.sub.bind(g);
  const uv = g.v(g.a('aUv', 'vec2')), x = s(uv, 'x'), along = s(uv, 'y');
  const age = g.clamp(g.v(g.a('aAge', 'float'))), seed = g.p('seed', 'float', 0);
  const hair = a(m(g.noise(g.vec(a(m(x, 46), seed), m(along, 3))), .65), m(g.noise(g.vec(a(m(x, 130), m(seed, 1.7)), m(along, 7))), .35));
  const dry = a(g.mix(.18, .78, age), m(d(1, x), .28));
  const body = g.smooth(d(dry, .08), a(dry, .08), hair);
  const inner = g.smooth(m(age, .55), a(a(m(age, .55), .25), m(.2, g.noise(g.vec(m(along, 9), seed)))), x);
  const edge = m(g.smooth(.86, .97, x), d(1, g.smooth(.985, 1, x)));
  const fade = m(d(1, age), d(1, age)), alpha = m(m(m(body, inner), fade), .9);
  const light = new Color(0xe9f2ff).toArray(), neon = new Color(0x9fe9ff).toArray();
  const trail = g.finish({ surface: { colour: a(m(light, m(alpha, .9)), m(neon, m(m(edge, fade), 2.2))) } });

  const h = new LookGraph(), hs = h.sw.bind(h), hm = h.mul.bind(h), ha = h.add.bind(h), hd = h.sub.bind(h);
  const view = (world: GraphRef): string => h.vec(...[[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(axis => h.op('dot', [world, h.op('viewToWorld', [axis])])));
  const position = view(hd(h.op('positionWorld'), h.op('cameraPosition'))), projection = h.p('projection', 'vec4', [1, 1, -1, -.2]);
  const projected = (p: GraphRef): string => h.div(hm(hs(p, 'xy'), hs(projection, 'xy')), hm(hs(p, 'z'), -1));
  const screen = projected(position), resolution = h.p('resolution', 'vec2', [1, 1]);
  const next = ha(position, view(h.op('localToWorldVector', [hm(h.a('aTan', 'vec3'), .01)])));
  const outside = ha(position, view(h.op('localToWorldVector', [h.vec(hm(h.a('aOut', 'float'), .01), 0, 0)])));
  const direction = h.op('normalize', [ha(hm(hd(projected(next), screen), resolution), 1e-6)]);
  const perp = h.vec(hm(hs(direction, 'y'), -1), hs(direction, 'x')), side = h.a('aSide', 'vec2');
  const width = h.op('select', [h.op('gt', [h.op('dot', [hm(perp, hs(side, 'x')), hm(hd(projected(outside), screen), resolution)]), 0]), 1, .3]);
  const w = hm(hs(position, 'z'), -1), px = h.p('pixels', 'float', 14);
  const xy = ha(hm(hs(position, 'xy'), hs(projection, 'xy')), hm(h.div(hm(perp, hm(hm(hs(side, 'x'), px), hm(width, 2))), resolution), w));
  const clip = h.vec(xy, ha(hm(hs(position, 'z'), hs(projection, 'z')), hs(projection, 'w')), w);
  const v = h.v(side), t = h.p('time', 'float', 0), y = hs(v, 'y');
  const n1 = h.noise(h.vec(hd(hm(y, 90), hm(t, 3.1)), ha(hm(hs(v, 'x'), 1.5), hm(t, .7))));
  const n2 = h.noise(h.vec(hd(hm(y, 230), hm(t, 7)), 3));
  const ratio = h.div(h.op('abs', [hs(v, 'x')]), ha(hm(.35, ha(.55, hm(.45, n1))), .12));
  const falloff = h.op('exp', [hm(hm(ratio, ratio), -2.2)]);
  const intensity = hm(hm(falloff, ha(.7, hm(.5, n2))), hm(h.smooth(0, .05, y), hd(1, h.smooth(.7, .76, y))));
  const halo = h.finish({ 'vertex.clip': { position: clip }, surface: { colour: hm(neon, intensity) } });
  return { 'nine-vm-trail': trail, 'nine-vm-edge': halo };
}
