import * as v from 'valibot';
import type { ScaledPostRow } from './scaledPost';

/**
 * A post-graph look (G599 N1): a level's whole colour chain as scaled post graph passes (format/scaledPost rows), declared
 * as rows. Side passes draw into their own targets on the tiers they name; the composite pass reads their outputs and
 * draws the frame the chain displays. Every uniform a pass links comes from one bag: the row's own `uniforms`, the
 * level's lent live uniforms (`live`, a lent uniform set id), the learned LUT, the side textures and the `aliases`.
 * Pixel terms, event overrides and the AO / fog / sky dressing are rows too: the host names no uniform of its own.
 */
const name = v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/u));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const index = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3));
/** fixed-length vectors, read-only once admitted (as generated rows are) */
const tuple2 = v.pipe(v.tuple([finite, finite]), v.transform((t): readonly [number, number] => t));
const tuple3 = v.pipe(v.tuple([finite, finite, finite]), v.transform((t): readonly [number, number, number] => t));
const tuple4 = v.pipe(v.tuple([finite, finite, finite, finite]), v.transform((t): readonly [number, number, number, number] => t));
/** a uniform as data (game/plugin/shaderFamily UniformRow) */
const uniform = v.union([finite, v.strictObject({ rgb: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0xffffff)) }),
  v.strictObject({ v2: tuple2 }), v.strictObject({ v3: tuple3 }), v.strictObject({ v4: tuple4 }),
  v.strictObject({ v4s: v.pipe(v.array(tuple4), v.maxLength(64), v.transform((rows): readonly (readonly [number, number, number, number])[] => rows)) })]);
const uniforms = v.pipe(v.record(name, uniform), v.check(rows => Object.keys(rows).length <= 256, 'At most 256 uniforms'));
/** a scaled post row; the pass host admits its programs, targets and draws when it builds one */
const pass = v.custom<ScaledPostRow>(row => typeof row === 'object' && row !== null && 'programs' in row && 'draws' in row && 'targets' in row && 'outputs' in row, 'A scaled post row');
/** one write into a bag uniform: a number, a vector component, or the same component of every vector in an array */
const write = v.strictObject({ param: name, index: v.exactOptional(index), each: v.exactOptional(v.boolean()), value: finite });
const effect = v.strictObject({
  /** writes on the edge */
  set: v.exactOptional(v.pipe(v.array(write), v.maxLength(16))),
  /** writes whose values before the `on` edge come back on `off` and when the look goes */
  hold: v.exactOptional(v.pipe(v.array(write), v.maxLength(16))),
  /** the displayed frame's opacity */
  display: v.exactOptional(v.pipe(finite, v.minValue(0), v.maxValue(1))),
});
/** the drawing buffer each frame: its pixel ratio (scaled, times `times` below `at`), a step on it, or its size */
const pixel = v.variant('of', [
  v.strictObject({ of: v.literal('ratio'), param: name, index: v.exactOptional(index), scale: v.exactOptional(finite), below: v.exactOptional(v.strictObject({ at: finite, times: finite })) }),
  v.strictObject({ of: v.literal('step'), param: name, at: finite, below: finite, above: finite }),
  v.strictObject({ of: v.literal('buffer'), param: name }),
]);
const link = v.union([name, finite]);

export const PostGraphLookSchema = v.strictObject({
  passes: v.pipe(v.record(name, pass), v.check(rows => Object.keys(rows).length <= 16, 'At most 16 post passes')),
  /** the side passes in draw order, each on its tiers: `constants` its own links, `params` its pack params (a bag name or a number) */
  sides: v.pipe(v.array(v.strictObject({ pass: name, tiers: v.pipe(v.array(v.picklist(['phone', 'desktop'])), v.minLength(1)),
    constants: v.exactOptional(uniforms), params: v.exactOptional(v.record(name, link)) })), v.maxLength(8)),
  /** the composite pass and the output the chain displays */
  composite: v.strictObject({ pass: name, output: name }),
  /** the side textures the composite reads (black where its side did not draw) and the presence flags they raise */
  inputs: v.pipe(v.record(name, v.strictObject({ side: name, output: name })), v.check(rows => Object.keys(rows).length <= 8, 'At most 8 side inputs')),
  flags: v.exactOptional(v.record(name, v.strictObject({ inputs: v.pipe(v.array(name), v.minLength(1)), on: finite }))),
  uniforms,
  /** the level's lent live uniform set (game/shardfile/lentLooks `lendUniforms`) */
  live: v.exactOptional(id),
  aliases: v.exactOptional(v.record(name, name)),
  pixel: v.exactOptional(v.pipe(v.array(pixel), v.maxLength(16))),
  /** the learned 33³ LUT (its public URL) the composite reads as `texture`, mixed in by `amount` once it loads */
  lut: v.exactOptional(v.strictObject({ url: v.pipe(v.string(), v.regex(/^\/[A-Za-z0-9/_.-]+$/u)), texture: name, amount: name })),
  /** a lent graph look's param that tells whether a side drew */
  lent: v.exactOptional(v.pipe(v.array(v.strictObject({ look: id, param: name, side: name, drawn: finite, absent: finite })), v.maxLength(8))),
  events: v.exactOptional(v.pipe(v.array(v.strictObject({ event: v.picklist(['practice.active', 'explore.studio']), on: effect, off: effect })), v.maxLength(8))),
  /** the engine's AO at the level's scale per tier, its colour, and the scene fog's near / far */
  ao: v.exactOptional(v.strictObject({ phone: v.record(name, v.union([finite, v.boolean()])), desktop: v.record(name, v.union([finite, v.boolean()])), color: tuple3, fog: tuple2 })),
  sky: v.strictObject({ clouds: v.boolean(), planet: v.boolean(), ownSky: v.exactOptional(v.boolean()) }),
});
export type PostGraphLookRow = v.InferOutput<typeof PostGraphLookSchema>;
export type PostGraphEffect = v.InferOutput<typeof effect>;
export type PostGraphWrite = v.InferOutput<typeof write>;
export type PostGraphPixel = v.InferOutput<typeof pixel>;
