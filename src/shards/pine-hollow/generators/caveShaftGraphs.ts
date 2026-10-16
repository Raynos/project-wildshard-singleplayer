// Pine Hollow's caveShaft look graphs, built at build time (SHARD-PLATFORM W2c): emitted into
// data/lookMaterials.generated.json by ./lookMaterials.ts; the ids and rows the play code reads stay in ../data/caveShaftLook.ts.
import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import { CAVE_SHAFT_LOOK } from '../data/caveShaftLook';

function shaftGraph(): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `c${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
  const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]), swz = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
  const p = op('positionWorld'), eye = op('cameraPosition'), t = op('time');
  const down = op('oneMinus', [swz(op('uv'), 'y')]);
  const rim = op('abs', [op('dot', [op('normalize', [op('normalWorld')]), op('normalize', [sub(eye, p)])])]);
  const along = mul(mul(sub(1, mul(down, 0.75)), op('smoothstep', [0, 0.06, down])), op('oneMinus', [op('smoothstep', [0.82, 1, down])]));
  const wave = mul(op('sin', [add(add(mul(swz(p, 'y'), 3.1), mul(t, 0.7)), mul(swz(p, 'x'), 5))]), op('sin', [sub(mul(swz(p, 'z'), 4.3), mul(t, 0.4))]));
  const mote = add(0.85, mul(wave, 0.15));
  const near = op('smoothstep', [0.8, 4, op('length', [sub(p, eye)])]);
  const shown = mul(mul(mul(mul(op('pow', [rim, 2.2]), along), mote), near), op('param', undefined, { param: 'intensity' }));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: { blend: 'additive', depthWrite: false, fog: false, singlePass: true },
    params: { intensity: { type: 'float', value: 0, min: 0, max: 4 } },
    nodes, stages: { surface: { colour: mul([1, 0.93, 0.78], shown), alpha: 1 } } };
}

/** The shaft's graph by look.materials id. */
export const CAVE_SHAFT_GRAPHS: Readonly<Record<string, GraphIr>> = { [CAVE_SHAFT_LOOK]: shaftGraph() };
