import type { GraphIr } from '@wildshard/format/materialGraph';
import { LookGraph } from './lookGraph';

/** The existing fixed-topology rope ribbon, expanded in camera pixels. */
export function filamentGraph(): GraphIr {
  const g = new LookGraph(), op = g.op.bind(g), sw = g.sw.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), mul = g.mul.bind(g), div = g.div.bind(g), max = g.max.bind(g);
  const resolution = g.p('uRes', 'vec2', [1, 1]), projection = g.p('uProjection', 'vec2', [1, 1]);
  const right = op('viewToWorld', [[1, 0, 0]]), up = op('viewToWorld', [[0, 1, 0]]), origin = op('objectOrigin'), camera = op('cameraPosition');
  const world = (point: string): string => add(op('localToWorldVector', [point]), origin);
  const position = op('positionLocal'), current = world(position), previous = world(g.a('aPrev', 'vec3')), next = world(g.a('aNext', 'vec3'));
  const screen = (point: string): string => {
    const delta = sub(point, camera);
    return mul(div(mul(g.vec(op('dot', [delta, right]), op('dot', [delta, up])), projection), max(op('viewDepth', [point]), 1e-3)), resolution);
  };
  const direction = op('normalize', [add(sub(screen(next), screen(previous)), [1e-5, 0])]);
  const normal = g.vec(mul(sw(direction, 'y'), -1), sw(direction, 'x')), side = g.a('aSide', 'vec2');
  const core = g.p('uCorePx', 'float', 3), halo = g.p('uHaloPx', 'float', 16), half = add(mul(core, 0.5), halo);
  const offset = div(mul(mul(normal, mul(sw(side, 'x'), half)), mul(max(op('viewDepth', [current]), 1e-3), 2)), mul(resolution, projection));
  const shifted = add(current, add(mul(right, sw(offset, 'x')), mul(up, sw(offset, 'y'))));
  const local = op('worldToLocal', [sub(shifted, origin)]), uv = g.v(g.vec(sw(side, 'y'), mul(sw(side, 'x'), half)));
  const s = sw(uv, 'x'), px = op('abs', [sw(uv, 'y')]), profile = g.clamp(sub(add(mul(core, 0.5), 0.7), px));
  const gaussian = (x: string): string => op('exp', [mul(mul(x, x), -1)]);
  const skirt = gaussian(div(px, max(mul(halo, 0.45), 0.5)));
  const crawl = add(0.85, mul(g.smooth(0.4, 1, op('sin', [sub(mul(mul(s, g.p('uLen', 'float', 10)), 6), mul(g.p('uTime', 'float', 0), 38))])), 0.3));
  const pulse = mul(gaussian(div(sub(s, g.p('uPulse', 'float', -1)), 0.05)), 3.5);
  const colour = mul(mul(add(mul(g.p('uCore', 'vec3', [0.6, 0.97, 1]), mul(profile, 2.4)), mul(g.p('uHalo', 'vec3', [0.12, 0.8, 1]), mul(skirt, 0.8))), g.p('uI', 'float', 1)), add(crawl, pulse));
  return g.finish({ 'vertex.position': { position: local }, surface: { colour, alpha: 1 } });
}
