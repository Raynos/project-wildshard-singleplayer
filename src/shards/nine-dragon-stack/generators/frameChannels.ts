import { Color } from 'three';
import { numericChannelPrograms, type NumericChannelOutput } from '@wildshard/sdk/clientChannels';
import { validateGraph, type GraphIr } from '@wildshard/format/materialGraph';
import { architectureGraphs } from './architectureGraphs';
import { streakGraph } from './streakGraph';
import { haloGraph } from './haloGraph';
import sharedUniforms from '../data/sharedUniforms.json' with { type: 'json' };
import paint from '../data/paint.json' with { type: 'json' };
import light from '../data/light.json' with { type: 'json' };
import layout from '../data/layoutPlan.json' with { type: 'json' };
import bindings from '../data/lookBindings.json' with { type: 'json' };
import lookGraphs from '../data/lookGraphs.json' with { type: 'json' };
import scrollGraph from '../data/scrollGraph.json' with { type: 'json' };

// G599 N2: the city's per-frame look numbers as a numeric client-channel group the post-graph look evaluates each frame
// (format/postGraphLook `channels`) over its owners: 'view' (the drawn camera seen from the world's root: the eye, the
// near plane, the projection's x / y scale, the root's place in the page; the clock is the evaluation's), 'uniforms' (the
// look's live uniforms, read), 'bag' (the same, written) and the lent graph looks it names. It writes the clock, the near
// plane, the eye and the root's place into the shared uniforms, the halo cards' and the streaks' projection, the silk
// fog's band depth and its band window for the eye's height as a breakpoint table: the bands' heights and widths are fixed
// rows, so the first band a ray going down reaches is the count of lower edges above the eye, and the last one going up is
// one less than the count of upper edges at or above it (exact for bands that run top to bottom, which it flags).
// G599 N3: and every lent graph look's param that reads the shared uniform of its own name (`uWash`) or of `u` + its name
// (`fogBase` ← `uFogBase`), each frame, so an event's held write reaches the looks: the shared rows the looks declare,
// the facade's two constant washes, the square's datum, and the frame's own numbers from the same expressions (no frame
// late). The silk weave and the light volume's two textures are lent texture rows.
type Expr = NumericChannelOutput['expr'];
const AXES = ['x', 'y', 'z', 'w'] as const, RGB = ['r', 'g', 'b'] as const;
const bands = sharedUniforms.uBands.v4s.map(([x = 0, y = 0]) => ({ lower: x - 3 * y, upper: x + 3 * y }));
const ordered = bands.every((band, k) => k === 0 || (band.upper <= (bands[k - 1]?.upper ?? Infinity) && band.lower <= (bands[k - 1]?.lower ?? Infinity)));
const baseBandDepth = sharedUniforms.uBands.v4s[0]?.[2] ?? 1;
const eye = (axis: string): Expr => (_b, read) => read('view', [`eye${axis.toUpperCase()}`]);
const root = (axis: string): Expr => (_b, read) => read('view', [`root${axis.toUpperCase()}`]);
/** the frame's numbers: each uniform's components (one, or x / y / z) */
const FRAME: Readonly<Record<string, readonly Expr[]>> = {
  uTime: [b => b.clock('time')],
  uNear: [(_b, read) => read('view', ['near'])],
  uCam: ['x', 'y', 'z'].map(eye),
  uRootAt: ['x', 'y', 'z'].map(root),
  uBandWin: [
    (b, read) => { const y = read('view', ['eyeY']); return bands.reduce((sum, band) => b.binary('add', sum, b.binary('gt', b.constant(band.lower), y)), b.constant(0)); },
    (b, read) => { const y = read('view', ['eyeY']); return bands.reduce((sum, band) => b.binary('sub', sum, b.binary('gt', y, b.constant(band.upper))), b.constant(bands.length - 1)); },
    b => b.constant(ordered ? 1 : 0)],
  uHaloProjection: [(_b, read) => read('view', ['p11'])],
  // the silk fog's band depth against its authored depth (the studio's held bands clear it)
  bandDepth: [(b, read) => b.binary('mul', read('uniforms', ['uBands', 'value', 0, 'z']), b.constant(1 / baseBandDepth))],
};
const port = (name: string, at: number, count: number): NumericChannelOutput['path'] => count === 1 ? [name] : [name, AXES[at] ?? 'x'];

/** the shared rows the looks may read: a number, a vector of its size, or a colour */
type Row = number | { readonly rgb: number } | { readonly v2: readonly number[] } | { readonly v3: readonly number[] } | { readonly v4: readonly number[] } | object;
function shape(row: Row): { kind: 'number' | 'vector' | 'colour'; size: number } | null {
  if (typeof row === 'number') return { kind: 'number', size: 1 };
  if ('rgb' in row) return { kind: 'colour', size: 3 };
  for (const key of ['v2', 'v3', 'v4'] as const) if (key in row) return { kind: 'vector', size: Number(key.slice(1)) };
  return null;
}
const SHARED = new Map(Object.entries({ ...sharedUniforms, ...paint.uniforms, ...light.volume, ...light.haloUniforms } satisfies Record<string, Row>)
  .flatMap(([name, row]) => { const at = shape(row); return at === null ? [] : [[name, at] as const]; }));
/** the facade's constant washes, as the linear colours the shared rows make */
const CONSTANT: Readonly<Record<string, readonly number[]>> = {
  ...Object.fromEntries(Object.entries(bindings.facade).map(([name, hex]) => [name, new Color(hex).toArray()])),
  datum: [layout.Y0],
};
/** the textures lent to the looks that declare them, from the shared uniform of the same name */
const LENT_TEXTURES = new Set(['uSilk', 'uLpVolA', 'uLpVolB']);

function admitted(rows: Readonly<Record<string, unknown>>): Record<string, GraphIr> {
  return Object.fromEntries(Object.entries(rows).map(([id, row]) => {
    const graph = validateGraph(row, { trustedBudget: true });
    if (!graph.ok) throw new Error(`Nine look ${id}: ${graph.errors.join('; ')}`);
    return [id, graph.graph];
  }));
}
const GRAPHS: Readonly<Record<string, GraphIr>> = { ...admitted(lookGraphs), ...admitted(scrollGraph), ...architectureGraphs(), 'nine-streaks': streakGraph(), 'nine-halo': haloGraph() };
const SIZE = { float: 1, vec2: 2, vec3: 3, vec4: 4, colour: 3 } as const;

function lookBindings(): { outputs: NumericChannelOutput[]; textures: { look: string; param: string; uniform: string }[] } {
  const outputs: NumericChannelOutput[] = [], textures: { look: string; param: string; uniform: string }[] = [];
  for (const id of bindings.graphs) {
    const graph = GRAPHS[id];
    if (graph === undefined) throw new Error(`Nine look binding: no graph ${id}`);
    for (const [param, row] of Object.entries(graph.params ?? {})) {
      const source = /^u[A-Z]/.test(param) ? param : `u${param.charAt(0).toUpperCase()}${param.slice(1)}`;
      if (row.type === 'texture') { if (LENT_TEXTURES.has(source)) textures.push({ look: id, param, uniform: source }); continue; }
      const size = SIZE[row.type];
      const frame = FRAME[param] ?? FRAME[source], fixed = CONSTANT[param] ?? CONSTANT[source], shared = SHARED.get(source);
      const from: ((at: number) => Expr) | null = frame !== undefined ? at => frame[at] ?? (b => b.constant(0))
        : fixed !== undefined ? at => b => b.constant(fixed[at] ?? 0)
        : shared === undefined ? null
        : shared.kind === 'number' ? () => (_b, read) => read('uniforms', [source, 'value'])
        : shared.kind === 'colour' ? at => (_b, read) => read('uniforms', [source, 'value', RGB[at] ?? 'r'])
        : at => (_b, read) => read('uniforms', [source, 'value', AXES[at] ?? 'x']);
      if (from === null) continue;
      const width = frame?.length ?? fixed?.length ?? shared?.size ?? 0;
      if (width !== size) throw new Error(`Nine look binding ${id}.${param}: ${String(size)} components from ${String(width)}`);
      for (let at = 0; at < size; at++) outputs.push({ target: id, path: port(param, at, size), expr: from(at) });
    }
  }
  return { outputs, textures };
}

const looks = lookBindings();
export const NINE_FRAME_GROUP = 'nine.frame';
export const NINE_FRAME_CHANNELS = numericChannelPrograms(NINE_FRAME_GROUP, NINE_FRAME_GROUP, [
  ...Object.entries(FRAME).flatMap(([name, parts]) => parts.map((expr, at) => ({ target: 'bag', path: port(name, at, parts.length), expr }))),
  { target: 'nine-streaks', path: ['projection', 'x'], expr: (_b, read) => read('view', ['p00']) },
  { target: 'nine-streaks', path: ['projection', 'y'], expr: (_b, read) => read('view', ['p11']) },
  ...looks.outputs,
]);
/** the lent texture rows (format/postGraphLook `textures`) */
export const NINE_LOOK_TEXTURES = looks.textures;
