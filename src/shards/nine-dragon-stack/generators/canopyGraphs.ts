import { Color } from 'three';
import { validateGraph, type GraphIr, type GraphNode, type GraphParam, type GraphRef } from '@wildshard/format/materialGraph';

type Mode = 'cards' | 'depth' | 'inner';
type FogSource = Readonly<Record<string, unknown>>;

/** The selected banyan crown, expressed in the same arithmetic as its original shaders.
 * Authoring only: the product consumes the resulting JSON, never this module. */
export function canopyGraphs(source: FogSource): Readonly<Record<string, GraphIr>> {
  const admitted = validateGraph(source['nine-silk-fog'], { trustedBudget: true });
  if (!admitted.ok) throw new Error(admitted.errors.join('\n'));
  const fog = admitted.graph, output = fog.stages.fog?.colour;
  if (typeof output !== 'string') throw new Error('Silk fog needs its compositing output');
  const sum = fog.nodes[output];
  if (sum?.op !== 'add' || sum.in?.length !== 2) throw new Error('Silk fog must add transmission and inscatter');
  const inputId = Object.entries(fog.nodes).find(([, node]) => node.op === 'fogInput')?.[0];
  const transmission = sum.in.find(ref => {
    if (typeof ref !== 'string') return false;
    const node = fog.nodes[ref];
    return node?.op === 'mul' && node.in?.includes(inputId ?? '');
  });
  if (typeof transmission !== 'string' || inputId === undefined) throw new Error('Silk fog needs its transmitted input');
  const transmittance = fog.nodes[transmission]?.in?.find(ref => ref !== inputId);
  const inscatter = sum.in.find(ref => ref !== transmission);
  if (transmittance === undefined || inscatter === undefined) throw new Error('Silk fog outputs are incomplete');
  const colour = (hex: number): readonly number[] => new Color(hex).toArray();
  const palette = [0x0c1310, 0x142019, 0x1e2e25, 0x2d3d31, 0x3f4e38].map(colour);

  const make = (mode: Mode): GraphIr => {
    const nodes: Record<string, GraphNode> = { ...fog.nodes }, memo = new Map<string, string>();
    let serial = 0;
    const op = (name: string, inputs?: readonly GraphRef[], extra: Omit<GraphNode, 'op' | 'in'> = {}): string => {
      const row: GraphNode = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }, key = JSON.stringify(row), old = memo.get(key);
      if (old !== undefined) return old;
      const id = `can${(serial++).toString(36)}`;
      if (nodes[id] !== undefined) throw new Error('Canopy node id collides with the fog');
      nodes[id] = row; memo.set(key, id); return id;
    };
    const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]);
    const sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]);
    const mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]);
    const div = (a: GraphRef, b: GraphRef): string => op('div', [a, b]);
    const sw = (a: GraphRef, mask: string): string => op('swizzle', [a], { mask });
    const max = (a: GraphRef, b: GraphRef): string => op('max', [a, b]);
    const mix = (a: GraphRef, b: GraphRef, t: GraphRef): string => op('mix', [a, b, t]);
    const smooth = (a: GraphRef, b: GraphRef, v: GraphRef): string => op('smoothstep', [a, b, v]);
    const select = (test: GraphRef, a: GraphRef, b: GraphRef): string => op('select', [test, a, b]);
    /** log2(max(x, 1)): range reduction plus the odd atanh series on [1,2).
     * The omitted tail is < 2e-7; no new runtime graph vocabulary is needed. */
    const positiveLog2 = (input: GraphRef): GraphRef => {
      let mantissa: GraphRef = max(input, 1), exponent: GraphRef = 0;
      for (const shift of [64, 32, 16, 8, 4, 2, 1]) {
        const take = op('step', [2 ** shift, mantissa]);
        exponent = add(exponent, mul(take, shift));
        // Divide by 1 or the power of two; a mixed tiny reciprocal can cancel to zero.
        mantissa = div(mantissa, add(1, mul(take, 2 ** shift - 1)));
      }
      const z = div(sub(mantissa, 1), add(mantissa, 1)), z2 = mul(z, z);
      let series: GraphRef = 1 / 13;
      for (const denominator of [11, 9, 7, 5, 3, 1]) series = add(1 / denominator, mul(z2, series));
      return add(exponent, mul(mul(z, series), 2 / Math.LN2));
    };
    const param = (name: string): string => op('param', undefined, { param: name });
    const varying = (ref: GraphRef): string => op('varying', [ref]);
    const attribute = (name: string, type: 'vec2' | 'vec3' | 'vec4'): string => op('attribute', undefined, { name, type });
    for (const [id, node] of Object.entries(nodes)) {
      if (node.op === 'fogInput') nodes[id] = { op: 'const', value: [0, 0, 0] };
      if (node.op === 'fogScale') nodes[id] = { op: 'const', value: 1 };
    }
    const params: Record<string, GraphParam> = {
      ...fog.params,
      // Live values are written by the eye hook before drawing, including resident cells.
      lightDir: { type: 'vec3', value: [0, 1, 0] },
      ink0: { type: 'vec3', value: [0, 0, 0] },
      ink1: { type: 'vec3', value: [0, 0, 0] },
      inkMid: { type: 'float', value: 1 },
      lineFade: { type: 'vec2', value: [0, 1] },
      atlas: { type: 'texture', value: 'canopy.atlas', role: 'lent' },
      atlasSize: { type: 'vec2', value: [1, 1] },
    };
    const arrays = { ...fog.arrays, leaf: { type: 'vec3' as const, value: palette } };
    const world = op('positionWorld'), root = param('rootAt'), local = sub(world, root);
    const lump = attribute('aLump', 'vec4');
    // worldToLocal exposes the transpose model basis. Its rows also transform
    // lump centres and shading normals exactly for a rotated/scaled Explorer model.
    const modelRows = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(axis => op('worldToLocal', [axis]));
    const modelVector = (point: GraphRef): string => op('combine', modelRows.map(row => op('dot', [row, point])));
    const lumpWorld = add(modelVector(sw(lump, 'xyz')), op('objectOrigin'));
    const plate = varying(select(op('gt', [sw(lump, 'w'), 0]), max(sub(op('viewDepth', [lumpWorld]), mul(sw(lump, 'w'), 0.85)), 0.2), op('viewDepth', [world])));
    const alphaDepth = div(op('cameraNear'), max(plate, op('cameraNear')));
    let out: GraphRef = [0, 0, 0], alpha: GraphRef = alphaDepth;
    if (mode !== 'depth') {
      const wp = varying(local), normal = op('normalize', [varying(op('normalize', [modelVector(op('normalLocal'))]))]);
      const tone = varying(attribute('aTone', 'vec2')), spill = varying(attribute('aSpill', 'vec3'));
      const camera = sub(op('cameraPosition'), root), delta = sub(camera, wp), distance = op('length', [delta]);
      const view = op('normalize', [delta]), ndl = op('dot', [normal, param('lightDir')]);
      const band = add(mul(smooth(-0.34, -0.26, ndl), 0.5), mul(smooth(0.3, 0.38, ndl), 0.5));
      let value: GraphRef = sub(add(0.14, mul(band, 0.22)), mul(sw(tone, 'y'), 0.12));
      let ink: GraphRef = 0;
      if (mode === 'cards') {
        const uv = sw(varying(attribute('aUv', 'vec4')), 'xy');
        const tx = op('texture', [uv], { param: 'atlas' }), luminance = op('dot', [sw(tx, 'xyz'), [0.2126, 0.7152, 0.0722]]);
        value = add(add(sub(add(0.06, mul(band, 0.18)), mul(sw(tone, 'y'), 0.45)), mul(sub(sw(tone, 'x'), 0.5), 0.26)), sub(smooth(0.18, 0.62, luminance), 0.4));
        ink = mul(sub(1, smooth(0.07, 0.2, luminance)), 0.9);
        const pixelUV = mul(uv, param('atlasSize')), dx = op('dFdx', [pixelUV]), dy = op('dFdy', [pixelUV]);
        const mip = mul(positiveLog2(max(op('dot', [dx, dx]), op('dot', [dy, dy]))), 0.5);
        const ta = mul(sw(tx, 'w'), add(1, mul(max(mip, 0), 0.25)));
        alpha = op('clamp', [add(div(sub(ta, 0.5), max(op('fwidth', [ta]), 1e-4)), 0.5), 0, 1]);
      }
      const clamped = mul(op('clamp', [value, 0, 1]), 4), i = op('floor', [clamped]), f = sub(clamped, i);
      const leaf = (index: number): string => op('arrayElement', [index], { param: 'leaf' });
      const low = select(op('gte', [i, 3]), leaf(3), select(op('gte', [i, 2]), leaf(2), select(op('gte', [i, 1]), leaf(1), leaf(0))));
      const high = select(op('gte', [i, 3]), leaf(4), select(op('gte', [i, 2]), leaf(3), select(op('gte', [i, 1]), leaf(2), leaf(1))));
      let col: GraphRef = mix(low, high, smooth(0.35, 0.65, f));
      const rim = mul(mul(op('pow', [sub(1, op('clamp', [op('abs', [op('dot', [normal, view])]), 0, 1])), 3]), smooth(-0.1, 0.5, sw(normal, 'y'))), sub(1, sw(tone, 'y')));
      col = add(col, mul(mul(leaf(4), rim), 0.15));
      col = add(col, mul(mul(col, spill), 1.6));
      const fg = varying(op('combine', [inscatter, transmittance]));
      const inkColour = mix(param('ink0'), param('ink1'), smooth(4, param('inkMid'), distance));
      const fade = sub(1, smooth(sw(param('lineFade'), 'x'), sw(param('lineFade'), 'y'), distance));
      col = mix(col, inkColour, mul(mul(ink, fade), op('pow', [max(sw(fg, 'w'), 1e-4), 0.7])));
      out = add(mul(col, sw(fg, 'w')), sw(fg, 'xyz'));
    }
    const used = new Set<string>();
    const visit = (ref: GraphRef): void => {
      if (typeof ref !== 'string' || used.has(ref)) return;
      const node = nodes[ref]; if (node === undefined) throw new Error(`Missing canopy input ${ref}`);
      used.add(ref);
      for (const input of node.in ?? []) visit(input);
      if (node.body !== undefined) {
        // Loop-local refs stay local; only their outer inputs join the root closure.
        const localIds = new Set(Object.keys(node.body.nodes));
        for (const child of Object.values(node.body.nodes)) for (const input of child.in ?? []) if (typeof input !== 'string' || !localIds.has(input)) visit(input);
        if (typeof node.body.out !== 'string' || !localIds.has(node.body.out)) visit(node.body.out);
      }
    };
    visit(out); visit(alpha);
    const liveNodes = Object.fromEntries(Object.entries(nodes).filter(([id]) => used.has(id)));
    const parameterNames = new Set<string>(), arrayNames = new Set<string>();
    const scan = (book: Readonly<Record<string, GraphNode>>): void => {
      for (const node of Object.values(book)) {
        if (node.param !== undefined) (node.op === 'arrayElement' ? arrayNames : parameterNames).add(node.param);
        if (node.body !== undefined) scan(node.body.nodes);
      }
    };
    scan(liveNodes);
    const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', effectState: { fog: false }, doubleSided: mode !== 'inner',
      budget: { nodes: 4096, samplers: 1, instructions: 8192 },
      params: Object.fromEntries(Object.entries(params).filter(([name]) => parameterNames.has(name))),
      arrays: Object.fromEntries(Object.entries(arrays).filter(([name]) => arrayNames.has(name))),
      nodes: liveNodes, stages: { surface: { colour: out, targetAlpha: alpha } } };
    const checked = validateGraph(graph, { trustedBudget: true });
    if (!checked.ok) throw new Error(`${mode}: ${checked.errors.join('\n')}`);
    return { ...checked.graph, budget: { nodes: Math.max(1, checked.cost.nodes), samplers: Math.max(1, checked.cost.samplers), instructions: Math.max(1, checked.cost.instructions) } };
  };
  return { 'nine-canopy-cards': make('cards'), 'nine-canopy-depth': make('depth'), 'nine-canopy-inner': make('inner') };
}
