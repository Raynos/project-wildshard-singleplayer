import type { GraphIr } from '@wildshard/format/materialGraph';
import { LookGraph } from './lookGraph';
import fog from '../data/lookGraphs.json' with { type: 'json' };

/** Camera-facing emitter discs retain their bounded screen footprint and warm fog transmission. */
export function haloGraph(): GraphIr {
  const g = new LookGraph(), op = g.op.bind(g), sw = g.sw.bind(g), mul = g.mul.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), div = g.div.bind(g), max = g.max.bind(g), min = g.min.bind(g), mix = g.mix.bind(g);
  const root = g.p('rootAt', 'vec3', [0, 0, 0]), knobs = g.p('uHalo', 'vec4', [2, 1.2, 5, 0.12]);
  const kind = g.p('uHaloKind', 'vec4', [3, 1, 2, 1]), farRow = g.p('uHaloFar', 'vec4', [12, 28, 0.12, 0.5]);
  const at = g.a('aAt', 'vec3'), colour = g.a('aCol', 'vec4'), radius = g.a('aR', 'float'), corner = g.a('aCorner', 'vec2');
  const worldAt = add(at, root), toEye = sub(op('cameraPosition'), worldAt), distance = op('length', [toEye]);
  const far = g.smooth(sw(farRow, 'x'), sw(farRow, 'y'), distance), r = mul(mul(radius, sw(knobs, 'y')), mix(1, sw(farRow, 'w'), far));
  const centre = add(worldAt, mul(div(toEye, max(distance, 1e-3)), min(r, mul(distance, 0.5))));
  const depth = op('viewDepth', [centre]), projection = g.p('uHaloProjection', 'float', 1);
  const cap = div(mul(mul(sw(knobs, 'w'), 2), max(depth, 0.01)), projection), size = min(r, cap);
  const point = add(centre, add(mul(op('viewToWorld', [[1, 0, 0]]), mul(sw(corner, 'x'), size)), mul(op('viewToWorld', [[0, 1, 0]]), mul(sw(corner, 'y'), size))));
  const select = (test: string, a: string, b: string): string => op('select', [test, a, b]);
  const k = sw(colour, 'w'), gain = select(op('lt', [k, 0.5]), sw(kind, 'x'), select(op('lt', [k, 1.5]), sw(kind, 'y'), select(op('lt', [k, 2.5]), sw(kind, 'z'), sw(kind, 'w'))));
  const transmission = op('pow', [max(g.fog(fog['nine-silk-fog'], worldAt), 1e-4), 0.25]);
  const energy = mul(mul(mul(mul(mul(sw(colour, 'xyz'), gain), sw(knobs, 'x')), mix(1, sw(farRow, 'z'), far)), transmission), mul(g.smooth(1.2, sw(knobs, 'z'), distance), op('step', [0, depth])));
  const peak = max(sw(energy, 'x'), max(sw(energy, 'y'), sw(energy, 'z')));
  const position = op('select', [op('lt', [peak, 0.004]), [1e6, 1e6, 1e6], op('worldToLocal', [sub(point, op('objectOrigin'))])]);
  const c = g.v(corner), r2 = op('dot', [c, c]);
  const alpha = mul(add(mul(op('exp', [mul(r2, -9)]), 0.7), mul(op('exp', [mul(r2, -3.5)]), 0.3)), sub(1, r2));
  return g.finish({ 'vertex.position': { position }, surface: { colour: mul(g.v(energy), alpha), alpha: 1, discard: op('gte', [r2, 1]) } });
}
