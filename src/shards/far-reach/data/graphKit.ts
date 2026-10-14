import type { GraphNode, GraphRef, GraphValueType } from '@wildshard/format/materialGraph';

/** One SF59 graph builder: each call adds a node and returns its id (Sky's looks author their graphs with it, as data). */
export interface GraphKit {
  readonly nodes: Record<string, GraphNode>;
  readonly op: (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>) => string;
  readonly add: (a: GraphRef, b: GraphRef) => string;
  readonly sub: (a: GraphRef, b: GraphRef) => string;
  readonly mul: (a: GraphRef, b: GraphRef) => string;
  readonly div: (a: GraphRef, b: GraphRef) => string;
  readonly mix: (a: GraphRef, b: GraphRef, t: GraphRef) => string;
  readonly smooth: (e0: GraphRef, e1: GraphRef, x: GraphRef) => string;
  readonly clamp: (x: GraphRef, lo: GraphRef, hi: GraphRef) => string;
  readonly swz: (a: string, mask: string) => string;
  readonly attr: (name: string, type: GraphValueType) => string;
  readonly varying: (a: GraphRef) => string;
  readonly tex: (param: string, at: GraphRef) => string;
}

/** A fresh builder over its own node table (ids `g0`, `g1`, …). */
export function graphKit(): GraphKit {
  const nodes: Record<string, GraphNode> = {};
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `g${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  return { nodes, op,
    add: (a, b) => op('add', [a, b]), sub: (a, b) => op('sub', [a, b]), mul: (a, b) => op('mul', [a, b]), div: (a, b) => op('div', [a, b]),
    mix: (a, b, t) => op('mix', [a, b, t]), smooth: (e0, e1, x) => op('smoothstep', [e0, e1, x]), clamp: (x, lo, hi) => op('clamp', [x, lo, hi]),
    swz: (a, mask) => op('swizzle', [a], { mask }), attr: (name, type) => op('attribute', undefined, { name, type }),
    varying: (a) => op('varying', [a]), tex: (param, at) => op('texture', [at], { param }) };
}
