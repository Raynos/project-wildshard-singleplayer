import type { GraphIr, GraphRef, GraphNode } from '@wildshard/format/materialGraph';
import { LookGraph } from './lookGraph';

type Ref = GraphRef;
/** Screen-space post graphs on the scaled post host: the uv, lent textures, the depth law and loops (postGraphs.ts, compositeGraph.ts). */
export class Screen extends LookGraph {
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
