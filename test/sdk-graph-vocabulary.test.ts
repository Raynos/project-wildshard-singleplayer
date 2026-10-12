// SHARD-PLATFORM SF51-p (sp-o8): the graph vocabulary Nine Dragon's raw GLSL needs (progress/shard-platform/nine-port/
// README.md, "Raw GLSL fit inventory"): `atan`, `mod`, code-fed params, `varying`, `attribute`, `fragCoord` and the
// surface `discard`. Each real Nine program is re-authored in TSL through `graph()` and proven against its GLSL: the
// portal disc node for node, and all three by a CPU evaluation of the graph IR against a line-by-line transcription of
// the shipped GLSL. Nine itself is not switched over: its graph looks wait for the graphMaterials row (E435).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { attribute, atan, dot, exp, float, floor, fract, length, mix, mod, positionGeometry, screenCoordinate, select, sin, smoothstep, vec2, vec3, varying, abs, pow } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { graph, param } from '../src/sdk/materials';
import { validateGraph, type GraphIr, type GraphRef } from '../src/format/materialGraph';
import { compileGraph } from '../src/engine/render/graph/compile';

/** a graph as its stage outputs' expression trees (ids are free; an attribute keeps its name and type) */
function canonical(ir: GraphIr): Record<string, unknown> {
  const key = (ref: GraphRef, depth = 0): string => {
    if (depth > 128) throw new Error('graph too deep');
    if (typeof ref !== 'string') return JSON.stringify(ref);
    const node = ir.nodes[ref];
    if (node === undefined) throw new Error(`unknown node ${ref}`);
    if (node.op === 'const') return JSON.stringify(node.value);
    if (node.op === 'param') return `param:${node.param ?? ''}=${JSON.stringify(ir.params?.[node.param ?? ''])}`;
    if (node.op === 'attribute') return `attribute:${node.name ?? ''}:${node.type ?? ''}`;
    return `${node.op}${node.mask === undefined ? '' : `.${node.mask}`}(${(node.in ?? []).map((input) => key(input, depth + 1)).join(',')})`;
  };
  const stages: Record<string, Record<string, string>> = {};
  const isRef = (value: unknown): value is GraphRef => typeof value === 'string' || typeof value === 'number' || (Array.isArray(value) && value.every((n: unknown) => typeof n === 'number'));
  for (const [stage, outputs] of Object.entries(ir.stages) as [string, object | undefined][]) {
    const row: Record<string, string> = {}, slots: object = outputs ?? {};
    for (const [slot, ref] of Object.entries(slots) as [string, unknown][]) row[slot] = isRef(ref) ? key(ref) : JSON.stringify(ref);
    stages[stage] = row;
  }
  return { kind: ir.kind, model: ir.model, params: ir.params ?? {}, stages };
}

// ---- a CPU evaluation of graph IR (float64; a value is its components) ----
type V = readonly number[];
type Feeds = Readonly<Record<string, V>>;
function evaluate(ir: GraphIr, out: GraphRef, feeds: Feeds): V {
  const memo = new Map<string, V>();
  const lanes = (xs: readonly V[]): number => Math.max(...xs.map((x) => x.length));
  const zip = (xs: readonly V[], f: (...c: number[]) => number): V => Array.from({ length: lanes(xs) }, (_, i) => f(...xs.map((x) => x.length === 1 ? (x[0] ?? 0) : (x[i] ?? 0))));
  const smooth = (e0: number, e1: number, x: number): number => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
  const feed = (name: string): V => { const v = feeds[name]; if (v === undefined) throw new Error(`no feed ${name}`); return v; };
  const ref = (r: GraphRef): V => {
    if (typeof r === 'number') return [r];
    if (typeof r !== 'string') return r;
    const hit = memo.get(r); if (hit !== undefined) return hit;
    const n = ir.nodes[r]; if (n === undefined) throw new Error(`unknown node ${r}`);
    const ins = (n.in ?? []).map(ref), [a = [0], b = [0], c = [0]] = ins;
    const s = (x: V): number => x[0] ?? 0;
    let v: V;
    switch (n.op) {
      case 'const': v = typeof n.value === 'number' ? [n.value] : n.value ?? [0]; break;
      case 'param': v = feed(`param:${n.param ?? ''}`); break;
      case 'attribute': v = feed(`attribute:${n.name ?? ''}`); break;
      case 'positionGeometry': case 'fragCoord': v = feed(n.op); break;
      case 'varying': v = a; break; // a linear pass-through interpolates to itself
      case 'add': v = zip([a, b], (x, y) => x + y); break;
      case 'sub': v = zip([a, b], (x, y) => x - y); break;
      case 'mul': v = zip([a, b], (x, y) => x * y); break;
      case 'div': v = zip([a, b], (x, y) => x / y); break;
      case 'mod': v = zip([a, b], (x, y) => x - y * Math.floor(x / y)); break;
      case 'pow': v = zip([a, b], (x, y) => Math.max(x, 0) ** y); break;
      case 'atan': v = zip([a, b], Math.atan2); break;
      case 'sin': v = a.map(Math.sin); break;
      case 'exp': v = a.map(Math.exp); break;
      case 'abs': v = a.map(Math.abs); break;
      case 'negate': v = a.map((x) => -x); break;
      case 'floor': v = a.map(Math.floor); break;
      case 'fract': v = a.map((x) => x - Math.floor(x)); break;
      case 'length': v = [Math.hypot(...a)]; break;
      case 'dot': v = [a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0)]; break;
      case 'mix': v = zip([a, b, c], (x, y, t) => x + (y - x) * t); break;
      case 'smoothstep': v = zip([a, b, c], smooth); break;
      case 'eq': v = [s(a) === s(b) ? 1 : 0]; break;
      case 'lte': v = [s(a) <= s(b) ? 1 : 0]; break;
      case 'select': v = s(a) !== 0 ? b : c; break;
      case 'swizzle': v = (n.mask ?? 'x').split('').map((k) => a['xyzw'.indexOf(k)] ?? 0); break;
      case 'combine': v = ins.flat(); break;
      default: throw new Error(`the test evaluator has no ${n.op}`);
    }
    memo.set(r, v);
    return v;
  };
  return ref(out);
}
function surfaceRef(ir: GraphIr, slot: 'colour' | 'discard'): GraphRef {
  const r = ir.stages.surface?.[slot];
  if (r === undefined) throw new Error(`no surface ${slot}`);
  return r;
}

// ---- Nine's portal swirl disc (runtime/looks/portalLook.ts VS_DISC + FS_DISC) ----
const uTime = param('uTime', { type: 'float', value: 0 }), uR = param('uR', { type: 'float', value: 1, min: 0 });
function portalDisc(): GraphIr {
  const p = varying(positionGeometry.xy).div(uR); // vP = position.xy (vertex); vec2 p = vP / uR
  const r = length(p), a = atan(p.y, p.x);
  const arms = float(0.5).add(float(0.5).mul(sin(a.mul(3).add(r.mul(9)).sub(uTime.mul(2.2)))));
  const fine = float(0.5).add(float(0.5).mul(sin(a.mul(7).sub(r.mul(16)).add(uTime.mul(3.1)))));
  const edge = smoothstep(1, 0.82, r), core = smoothstep(0.55, 0, r);
  const col = mix(vec3(0.12, 0.75, 1), vec3(1, 0.22, 0.7), arms).mul(float(0.45).add(float(0.55).mul(fine))).add(vec3(0.75, 0.6, 1).mul(core));
  const k = edge.mul(float(0.22).add(float(0.5).mul(arms).mul(fine)).add(float(0.35).mul(core)));
  return graph({ model: 'unlit', surface: { colour: col.mul(k) } });
}
/** the disc transcribed from FS_DISC into IR by hand, statement by statement */
const DISC_IR: GraphIr = {
  version: 1, kind: 'material', model: 'unlit',
  params: { uTime: { type: 'float', value: 0 }, uR: { type: 'float', value: 1, min: 0 } },
  nodes: {
    vP: { op: 'varying', in: ['xy'] }, xy: { op: 'swizzle', mask: 'xy', in: ['pos'] }, pos: { op: 'positionGeometry' },
    R: { op: 'param', param: 'uR' }, T: { op: 'param', param: 'uTime' },
    p: { op: 'div', in: ['vP', 'R'] }, r: { op: 'length', in: ['p'] },
    py: { op: 'swizzle', mask: 'y', in: ['p'] }, px: { op: 'swizzle', mask: 'x', in: ['p'] }, a: { op: 'atan', in: ['py', 'px'] },
    a3: { op: 'mul', in: ['a', 3] }, r9: { op: 'mul', in: ['r', 9] }, t22: { op: 'mul', in: ['T', 2.2] },
    armsArg: { op: 'sub', in: ['armsSum', 't22'] }, armsSum: { op: 'add', in: ['a3', 'r9'] },
    arms: { op: 'add', in: [0.5, 'armsHalf'] }, armsHalf: { op: 'mul', in: [0.5, 'armsSin'] }, armsSin: { op: 'sin', in: ['armsArg'] },
    a7: { op: 'mul', in: ['a', 7] }, r16: { op: 'mul', in: ['r', 16] }, t31: { op: 'mul', in: ['T', 3.1] },
    fineDiff: { op: 'sub', in: ['a7', 'r16'] }, fineArg: { op: 'add', in: ['fineDiff', 't31'] }, fineSin: { op: 'sin', in: ['fineArg'] },
    fine: { op: 'add', in: [0.5, 'fineHalf'] }, fineHalf: { op: 'mul', in: [0.5, 'fineSin'] },
    edge: { op: 'smoothstep', in: [1, 0.82, 'r'] }, core: { op: 'smoothstep', in: [0.55, 0, 'r'] },
    hue: { op: 'mix', in: [[0.12, 0.75, 1], [1, 0.22, 0.7], 'arms'] },
    shade: { op: 'add', in: [0.45, 'fine55'] }, fine55: { op: 'mul', in: [0.55, 'fine'] },
    lit: { op: 'mul', in: ['hue', 'shade'] }, glow: { op: 'mul', in: [[0.75, 0.6, 1], 'core'] }, col: { op: 'add', in: ['lit', 'glow'] },
    af: { op: 'mul', in: ['a5', 'fine'] }, a5: { op: 'mul', in: [0.5, 'arms'] }, kIn: { op: 'add', in: [0.22, 'af'] },
    c35: { op: 'mul', in: [0.35, 'core'] }, kSum: { op: 'add', in: ['kIn', 'c35'] }, k: { op: 'mul', in: ['edge', 'kSum'] },
    out: { op: 'mul', in: ['col', 'k'] },
  },
  stages: { surface: { colour: 'out' } },
};
/** FS_DISC, line by line in JS */
function discGlsl(vP: readonly [number, number], time: number, radius: number): number[] {
  const smooth = (e0: number, e1: number, x: number): number => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
  const p = [vP[0] / radius, vP[1] / radius] as const;
  const r = Math.hypot(p[0], p[1]), a = Math.atan2(p[1], p[0]);
  const arms = 0.5 + 0.5 * Math.sin(a * 3 + r * 9 - time * 2.2);
  const fine = 0.5 + 0.5 * Math.sin(a * 7 - r * 16 + time * 3.1);
  const edge = smooth(1, 0.82, r), core = smooth(0.55, 0, r);
  const from = [0.12, 0.75, 1], to = [1, 0.22, 0.7], glow = [0.75, 0.6, 1];
  const col = from.map((f, i) => (f + ((to[i] ?? 0) - f) * arms) * (0.45 + 0.55 * fine) + (glow[i] ?? 0) * core);
  const k = edge * (0.22 + 0.5 * arms * fine + 0.35 * core);
  return col.map((x) => x * k);
}

// ---- Nine's jian heat halo (vm/jian.ts FS_HALO; its varying vS is the aSide attribute) ----
const uColor = param('uColor', { type: 'vec3', value: [1, 0.6, 0.3] }), uGain = param('uGain', { type: 'float', value: 1, min: 0 });
function jianHalo(): GraphIr {
  const vS = varying(attribute('aSide', 'vec2'));
  const h21 = (q: Node<'vec2'>): Node<'float'> => {
    const f = fract(q.mul(vec2(123.34, 456.21)));
    const g = f.add(dot(f, f.add(45.32)));
    return fract(g.x.mul(g.y));
  };
  const vn = (q: Node<'vec2'>): Node<'float'> => {
    const i = floor(q), f0 = fract(q), f = f0.mul(f0).mul(float(3).sub(float(2).mul(f0)));
    return mix(mix(h21(i), h21(i.add(vec2(1, 0))), f.x), mix(h21(i.add(vec2(0, 1))), h21(i.add(vec2(1, 1))), f.x), f.y);
  };
  const along = vS.y;
  const n1 = vn(vec2(along.mul(90).sub(uTime.mul(3.1)), vS.x.mul(1.5).add(uTime.mul(0.7))));
  const n2 = vn(vec2(along.mul(230).sub(uTime.mul(7)), 3));
  const w = float(0.55).add(float(0.45).mul(n1));
  const a0 = exp(pow(abs(vS.x).div(float(0.35).mul(w).add(0.12)), 2).negate().mul(2.2));
  const a1 = a0.mul(float(0.7).add(float(0.5).mul(n2)));
  const a = a1.mul(smoothstep(0, 0.05, along).mul(float(1).sub(smoothstep(0.7, 0.76, along))));
  return graph({ model: 'unlit', surface: { colour: uColor.mul(a).mul(uGain) } });
}
function haloGlsl(vS: readonly [number, number], time: number, colour: readonly number[], gain: number): number[] {
  const fr = (x: number): number => x - Math.floor(x);
  const smooth = (e0: number, e1: number, x: number): number => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
  const h21 = (p0: readonly [number, number]): number => {
    let p = [fr(p0[0] * 123.34), fr(p0[1] * 456.21)] as const;
    const d = p[0] * (p[0] + 45.32) + p[1] * (p[1] + 45.32);
    p = [p[0] + d, p[1] + d];
    return fr(p[0] * p[1]);
  };
  const vn = (p: readonly [number, number]): number => {
    const i = [Math.floor(p[0]), Math.floor(p[1])] as const, f0 = [fr(p[0]), fr(p[1])];
    const f = f0.map((x) => x * x * (3 - 2 * x)), fx = f[0] ?? 0, fy = f[1] ?? 0;
    const lerp = (x: number, y: number, t: number): number => x + (y - x) * t;
    return lerp(lerp(h21(i), h21([i[0] + 1, i[1]]), fx), lerp(h21([i[0], i[1] + 1]), h21([i[0] + 1, i[1] + 1]), fx), fy);
  };
  const along = vS[1];
  const n1 = vn([along * 90 - time * 3.1, vS[0] * 1.5 + time * 0.7]);
  const n2 = vn([along * 230 - time * 7, 3]);
  const w = 0.55 + 0.45 * n1;
  let a = Math.exp(-((Math.abs(vS[0]) / (0.35 * w + 0.12)) ** 2) * 2.2);
  a *= 0.7 + 0.5 * n2;
  a *= smooth(0, 0.05, along) * (1 - smooth(0.7, 0.76, along));
  return colour.map((c) => c * a * gain);
}

// ---- Nine's ordered dither (runtime/looks/look.ts bayer4 + `if (cov <= bayer4(gl_FragCoord.xy)) discard;`) ----
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const cov = param('cov', { type: 'float', value: 0.5, min: 0, max: 1 });
function bayerClip(): GraphIr {
  const p = mod(floor(screenCoordinate), 4);
  const i = p.x.add(p.y.mul(4));
  let chain: Node<'float'> = float(BAYER[15] ?? 0);
  for (let k = 14; k >= 0; k--) chain = select(i.equal(k), float(BAYER[k] ?? 0), chain);
  const bayer = chain.div(16).add(1 / 32);
  return graph({ model: 'unlit', surface: { colour: vec3(1, 1, 1), discard: cov.lessThanEqual(bayer) } });
}
function bayerGlsl(fc: readonly [number, number]): number {
  const p = fc.map((x) => { const f = Math.floor(x); return f - 4 * Math.floor(f / 4); });
  const i = (p[0] ?? 0) + (p[1] ?? 0) * 4;
  return (BAYER[i] ?? 0) / 16 + 1 / 32;
}

/** the GLSL three's node back-end writes for a compiled graph (the engine's handler on a stand-in renderer) */
async function glslOf(ir: GraphIr, geometry: THREE.BufferGeometry): Promise<{ vertex: string; fragment: string }> {
  const { EngineNodesHandler } = await import('../src/engine/render/nodes/engineNodesHandler');
  const renderer: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(renderer instanceof THREE.WebGLRenderer)) throw new Error('renderer prototype');
  const props = new WeakMap<object, object>();
  const fields: Record<string, unknown> = {
    extensions: { has: () => false, get: () => null }, getContext: () => ({}), getRenderTarget: () => null,
    getDrawingBufferSize: (into: THREE.Vector2) => into.set(4, 4), getSize: (into: THREE.Vector2) => into.set(4, 4), getPixelRatio: () => 1,
    toneMapping: THREE.NoToneMapping, toneMappingExposure: 1, outputColorSpace: THREE.LinearSRGBColorSpace,
    coordinateSystem: THREE.WebGLCoordinateSystem, info: { render: { frame: 0 } }, debug: { checkShaderErrors: true, diagnostics: { keywords: false } },
    properties: { get: (o: object) => { const p = props.get(o) ?? {}; props.set(o, p); return p; }, has: (o: object) => props.has(o) },
  };
  for (const [key, value] of Object.entries(fields)) Reflect.set(renderer, key, value);
  const handler = new EngineNodesHandler();
  handler.setRenderer(renderer);
  const compiled = compileGraph(ir);
  const mesh = new THREE.Mesh(geometry, compiled.material);
  handler.renderStart(new THREE.Scene(), new THREE.PerspectiveCamera());
  handler.updateLights([]);
  const parameters: object = {};
  if (Array.isArray(parameters)) throw new Error('parameters');
  const asParameters = (v: object): v is THREE.WebGLProgramParametersWithUniforms => !Array.isArray(v);
  if (!asParameters(parameters)) throw new Error('parameters');
  handler.build(compiled.material, mesh, parameters);
  return { vertex: parameters.vertexShader, fragment: parameters.fragmentShader };
}

describe('graph vocabulary for Nine Dragon\'s GLSL (atan, mod, varying, attribute, fragCoord, discard, code-fed params)', () => {
  it('validates the new ops strictly', () => {
    const errorsOf = (g: unknown): string => { const r = validateGraph(g); return r.ok ? '' : r.errors.join('\n'); };
    const mat = (nodes: GraphIr['nodes'], surface: NonNullable<GraphIr['stages']['surface']>, extra: Partial<GraphIr> = {}): GraphIr => ({ version: 1, kind: 'material', model: 'unlit', nodes, stages: { surface }, ...extra });
    // atan takes (y, x) and broadcasts like any component-wise op
    expect(errorsOf(mat({ a: { op: 'atan', in: [1, 2] }, c: { op: 'combine', in: ['a', 'a', 'a'] } }, { colour: 'c' }))).toBe('');
    expect(errorsOf(mat({ a: { op: 'atan', in: [1] } }, { colour: 'a' }))).toMatch(/atan takes 2 inputs/);
    // an attribute is named a + capital and typed float … vec4; three's own attribute names are refused
    expect(errorsOf(mat({ s: { op: 'attribute', name: 'aSide', type: 'vec2' }, c: { op: 'combine', in: ['s', 0] } }, { colour: 'c' }))).toBe('');
    expect(errorsOf(mat({ s: { op: 'attribute', name: 'position', type: 'vec3' } }, { colour: 's' }))).toMatch(/attribute name position/);
    expect(errorsOf(mat({ s: { op: 'attribute', name: 'aSide', type: 'bool' } }, { colour: 's' }))).toMatch(/attribute type bool/);
    expect(errorsOf({ version: 1, kind: 'post', nodes: { s: { op: 'attribute', name: 'aSide', type: 'vec3' } }, stages: { post: { colour: 's' } } })).toMatch(/attribute cannot run in the post stage/);
    // a varying's input runs in the vertex program: vertex-only inputs pass through it, fragment-only ops are refused
    expect(errorsOf(mat({ g: { op: 'positionGeometry' }, v: { op: 'varying', in: ['g'] } }, { colour: 'v' }))).toBe('');
    expect(errorsOf(mat({ g: { op: 'positionGeometry' } }, { colour: 'g' }))).toMatch(/positionGeometry cannot run in the fragment stage/);
    expect(errorsOf(mat({ u: { op: 'uv' }, d: { op: 'fwidth', in: ['u'] }, v: { op: 'varying', in: ['d'] }, c: { op: 'combine', in: ['v', 0] } }, { colour: 'c' }))).toMatch(/fwidth cannot run in the vertex stage/);
    expect(errorsOf({ ...mat({ g: { op: 'positionLocal' }, v: { op: 'varying', in: ['g'] } }, { colour: [1, 1, 1] }), stages: { surface: { colour: [1, 1, 1] }, 'vertex.offset': { offset: 'v' } } })).toMatch(/varying cannot run in the vertex stage/);
    // the pixel coordinate is a mesh-fragment input; discard is a bool
    expect(errorsOf({ version: 1, kind: 'post', nodes: { f: { op: 'fragCoord' }, c: { op: 'combine', in: ['f', 0] } }, stages: { post: { colour: 'c' } } })).toMatch(/fragCoord cannot run in the post stage/);
    expect(errorsOf(mat({ f: { op: 'fragCoord' }, x: { op: 'swizzle', mask: 'x', in: ['f'] }, d: { op: 'gt', in: ['x', 2] } }, { colour: [1, 1, 1], discard: 'd' }))).toBe('');
    expect(errorsOf(mat({ f: { op: 'fragCoord' }, x: { op: 'swizzle', mask: 'x', in: ['f'] } }, { colour: [1, 1, 1], discard: 'x' }))).toMatch(/discard: is a float, wants a bool/);
  });

  it('the portal disc compiles from TSL node for node to its hand transcription of FS_DISC', () => {
    expect(validateGraph(DISC_IR).ok).toBe(true);
    expect(canonical(portalDisc())).toEqual(canonical(DISC_IR));
  });

  it('the portal disc, the jian halo and the ordered dither evaluate to their GLSL at every sample', () => {
    const disc = portalDisc(), halo = jianHalo(), clip = bayerClip();
    for (const time of [0, 0.37, 12.5, 401.25]) {
      for (const radius of [0.6, 1.4]) for (const vP of [[0.1, 0.2], [-0.5, 0.3], [0.9, -0.85], [0, -0.01]] as const) {
        const got = evaluate(disc, surfaceRef(disc, 'colour'), { positionGeometry: [vP[0], vP[1], 0.25], 'param:uTime': [time], 'param:uR': [radius] });
        discGlsl(vP, time, radius).forEach((want, i) => { expect(got[i]).toBeCloseTo(want, 12); });
      }
      for (const vS of [[0.2, 0.3], [-0.9, 0.04], [1, 0.72], [0, 0.5]] as const) {
        const got = evaluate(halo, surfaceRef(halo, 'colour'), { 'attribute:aSide': vS, 'param:uTime': [time], 'param:uColor': [1, 0.6, 0.3], 'param:uGain': [1.7] });
        haloGlsl(vS, time, [1, 0.6, 0.3], 1.7).forEach((want, i) => { expect(got[i]).toBeCloseTo(want, 9); });
      }
    }
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) for (const c of [0.03, 0.4, 0.97]) {
      const fc = [x + 0.5, y + 0.5] as const;
      const discarded = evaluate(clip, surfaceRef(clip, 'discard'), { fragCoord: fc, 'param:cov': [c] })[0] === 1;
      expect(discarded).toBe(c <= bayerGlsl(fc));
    }
  });

  it('keeps every Nine program inside the content budget, its unbound params code-fed by setParam', () => {
    for (const ir of [portalDisc(), jianHalo(), bayerClip()]) {
      const r = validateGraph(ir);
      if (!r.ok) throw new Error(r.errors.join('\n'));
      for (const p of Object.values(ir.params ?? {})) expect(p.bind).toBeUndefined();
    }
    const compiled = compileGraph(portalDisc());
    expect(() => { compiled.setParam('uR', 2.5); compiled.setParam('uTime', 9.75); }).not.toThrow();
  });

  it('compiles to GLSL with the attribute, a vertex-written varying, atan, the pixel coordinate and the discard', async () => {
    const priorBitmap = Object.getOwnPropertyDescriptor(globalThis, 'ImageBitmap');
    Object.defineProperty(globalThis, 'ImageBitmap', { configurable: true, writable: true, value: class { readonly width = 0; } });
    try {
      const strip = new THREE.PlaneGeometry(1, 1);
      strip.setAttribute('aSide', new THREE.Float32BufferAttribute(new Float32Array(strip.getAttribute('position').count * 2), 2));
      const halo = await glslOf(jianHalo(), strip);
      expect(halo.vertex).toMatch(/\bin vec2 aSide;/);
      expect(halo.vertex).toMatch(/\bout vec2 \w+;/);
      expect(halo.fragment).toMatch(/\bin vec2 \w+;/);
      expect(halo.fragment).not.toMatch(/aSide/);
      const disc = await glslOf(portalDisc(), new THREE.CircleGeometry(1, 8));
      expect(disc.fragment).toMatch(/atan\s*\(/);
      const clip = await glslOf(bayerClip(), new THREE.PlaneGeometry(1, 1));
      expect(clip.fragment).toMatch(/gl_FragCoord/);
      expect(clip.fragment).toMatch(/\bdiscard\b/);
    } finally {
      if (priorBitmap === undefined) Reflect.deleteProperty(globalThis, 'ImageBitmap');
      else Object.defineProperty(globalThis, 'ImageBitmap', priorBitmap);
    }
  });
});
