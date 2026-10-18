import { validateGraph, type GraphIr, type GraphNode, type GraphParam, type GraphRef, type GraphStages, type GraphArrayParam } from '@wildshard/format/materialGraph';

/** Author arithmetic once, emit only admitted graph rows into the shardfile. */
export class LookGraph {
  readonly nodes: Record<string, GraphNode> = {};
  readonly params: Record<string, GraphParam> = {};
  readonly arrays: Record<string, GraphArrayParam> = {};
  private readonly memo = new Map<string, string>();
  op(op: string, inputs?: readonly GraphRef[], extra: Omit<GraphNode, 'op' | 'in'> = {}): string {
    const node = { op, ...(inputs === undefined ? {} : { in: inputs }), ...extra }, key = JSON.stringify(node), old = this.memo.get(key);
    if (old !== undefined) return old;
    const id = `n${Object.keys(this.nodes).length.toString(36)}`;
    this.nodes[id] = node; this.memo.set(key, id); return id;
  }
  p(name: string, type: GraphParam['type'], value: GraphParam['value']): string { this.params[name] = { type, value }; return this.op('param', undefined, { param: name }); }
  a(name: string, type: NonNullable<GraphNode['type']>): string { return this.op('attribute', undefined, { name, type }); }
  sw(a: GraphRef, mask: string): string { return this.op('swizzle', [a], { mask }); }
  add(a: GraphRef, b: GraphRef): string { return this.op('add', [a, b]); }
  sub(a: GraphRef, b: GraphRef): string { return this.op('sub', [a, b]); }
  mul(a: GraphRef, b: GraphRef): string { return this.op('mul', [a, b]); }
  div(a: GraphRef, b: GraphRef): string { return this.op('div', [a, b]); }
  max(a: GraphRef, b: GraphRef): string { return this.op('max', [a, b]); }
  min(a: GraphRef, b: GraphRef): string { return this.op('min', [a, b]); }
  mix(a: GraphRef, b: GraphRef, t: GraphRef): string { return this.op('mix', [a, b, t]); }
  smooth(a: GraphRef, b: GraphRef, x: GraphRef): string { return this.op('smoothstep', [a, b, x]); }
  clamp(a: GraphRef, lo: GraphRef = 0, hi: GraphRef = 1): string { return this.op('clamp', [a, lo, hi]); }
  v(a: GraphRef): string { return this.op('varying', [a]); }
  vec(...a: GraphRef[]): string { return this.op('combine', a); }
  hash(p: GraphRef): string {
    const a = this.op('fract', [this.mul(this.sw(p, 'xyx'), 0.1031)]);
    const b = this.add(a, this.op('dot', [a, this.add(this.sw(a, 'yzx'), 33.33)]));
    return this.op('fract', [this.mul(this.add(this.sw(b, 'x'), this.sw(b, 'y')), this.sw(b, 'z'))]);
  }
  noise(p: GraphRef): string {
    const i = this.op('floor', [p]), f = this.op('fract', [p]), u = this.mul(this.mul(f, f), this.sub(3, this.mul(f, 2)));
    return this.mix(this.mix(this.hash(i), this.hash(this.add(i, [1, 0])), this.sw(u, 'x')), this.mix(this.hash(this.add(i, [0, 1])), this.hash(this.add(i, [1, 1])), this.sw(u, 'x')), this.sw(u, 'y'));
  }
  /** Reuse the admitted silk program's transmission; additive light receives no inscatter. */
  fog(source: unknown, world: GraphRef): GraphRef {
    const checked = validateGraph(source, { trustedBudget: true });
    if (!checked.ok) throw new Error([...new Set(checked.errors)].slice(0, 12).join('\n'));
    const graph = checked.graph, output = graph.stages.fog?.colour;
    if (typeof output !== 'string') throw new Error('Missing silk fog output');
    const input = Object.entries(graph.nodes).find(([, row]) => row.op === 'fogInput')?.[0];
    const product = graph.nodes[output]?.in?.map(ref => typeof ref === 'string' ? graph.nodes[ref] : undefined).find(row => row?.op === 'mul' && row.in?.includes(input ?? ''));
    const transmission = product?.in?.find(ref => ref !== input);
    if (typeof transmission !== 'string') throw new Error('Missing silk transmission');
    const rename = (ref: GraphRef): GraphRef => typeof ref === 'string' && graph.nodes[ref] !== undefined ? `fog_${ref}` : ref;
    const rewrite = (row: GraphNode): GraphNode => ({ ...row, ...(row.in === undefined ? {} : { in: row.in.map(rename) }),
      ...(row.body === undefined ? {} : { body: { nodes: Object.fromEntries(Object.entries(row.body.nodes).map(([id, child]) => [id, rewrite(child)])), out: rename(row.body.out) } }) });
    for (const [id, row] of Object.entries(graph.nodes)) this.nodes[`fog_${id}`] = row.op === 'fogScale' ? { op: 'const', value: 1 } : row.op === 'positionWorld'
      ? { op: 'add', in: [world, [0, 0, 0]] }
      : rewrite(row);
    Object.assign(this.params, graph.params); Object.assign(this.arrays, graph.arrays);
    return rename(transmission);
  }
  finish(stages: GraphStages, state?: GraphIr['effectState']): GraphIr {
    const used = new Set<string>();
    const visit = (ref: unknown): void => {
      if (typeof ref === 'string' && this.nodes[ref] !== undefined && !used.has(ref)) { used.add(ref); for (const input of this.nodes[ref].in ?? []) visit(input);
        const body = this.nodes[ref].body;
        if (body !== undefined) visit(body); }
      else if (typeof ref === 'object' && ref !== null) for (const value of Object.values(ref)) visit(value);
    };
    visit(stages);
    const live = Object.entries(this.nodes).filter(([id]) => used.has(id));
    const ids = new Map(live.map(([id], index) => [id, `n${index.toString(36)}`]));
    const ref = (value: GraphRef): GraphRef => typeof value === 'string' ? ids.get(value) ?? value : value;
    const node = (row: GraphNode): GraphNode => ({ ...row, ...(row.in === undefined ? {} : { in: row.in.map(ref) }),
      ...(row.body === undefined ? {} : { body: { nodes: Object.fromEntries(Object.entries(row.body.nodes).map(([id, child]) => [id, node(child)])), out: ref(row.body.out) } }) });
    const compact = (value: unknown): unknown => typeof value === 'string' ? ids.get(value) ?? value
      : Array.isArray(value) ? value.map(compact) : typeof value === 'object' && value !== null ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compact(item)])) : value;
    const compactStages = compact(stages) as GraphStages;
    const nodes = Object.fromEntries(live.map(([id, row]) => [ids.get(id) ?? id, node(row)]));
    const names = new Set(Object.values(nodes).map(entry => entry.param));
    const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', doubleSided: true, effectState: state ?? { fog: false, blend: 'additive', depthWrite: false },
      budget: { nodes: 4096, samplers: 8, instructions: 8192 }, nodes, arrays: this.arrays, params: Object.fromEntries(Object.entries(this.params).filter(([id]) => names.has(id))), stages: compactStages };
    const checked = validateGraph(graph, { trustedBudget: true });
    if (!checked.ok) throw new Error([...new Set(checked.errors)].slice(0, 12).join('\n'));
    if (new TextEncoder().encode(JSON.stringify(checked.graph)).length > 64000) throw new Error('Nine graph exceeds 64,000 bytes');
    return { ...checked.graph, budget: { nodes: Math.max(1, checked.cost.nodes), samplers: Math.max(1, checked.cost.samplers), instructions: Math.max(1, checked.cost.instructions) } };
  }
}
