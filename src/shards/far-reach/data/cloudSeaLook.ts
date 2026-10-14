import type { GraphIr } from '@wildshard/format/materialGraph';
import { graphKit } from './graphKit';

/**
 * Sky Reach's cloud sea graphs and discs (SHARD-PLATFORM M3: SF59 material graphs on horizontal discs built by
 * runtime/looks/discLayer.ts; look/render.ts adds them).
 *
 * - `paintedSea` (E392, E399, E410; two discs, `SEA_LAYERS`): a big disc carrying a seamless painted texture of cumulus tops
 *   seen from above (`public/assets/far-reach/tex/cloudsea.webp`, codex image_gen), two scales blended so no repeat shows,
 *   drifting slowly, darkened toward the maelstrom's eye under the crown and melting into the panorama's painted sea with distance; the
 *   upper layer keeps only the bright billow crowns, turned, for parallax on the diagonals.
 * - `paintedMaelstrom` (E392): a disc under the crown carrying a codex-painted top-down cloud vortex
 *   (`public/assets/far-reach/tex/maelstrom.webp`), turning slowly, seen only from the crown's own sky.
 *
 * Both read the painted textures only: when one is missing its discs are not drawn (the procedural stand-ins went, W1 C2).
 */

/**
 * The painted sea as an SF59 material graph (`painted` names the sheet the dressing hands the compiler; `gain` and `crown`
 * are the layer's, `SEA_LAYERS`): two scales of the sheet blended so no repeat shows, drifting on the graph clock; value
 * contrast (peach-lavender hollows, E410, warm crowns), the maelstrom's eye under the crown a dark lavender well (the sea
 * itself is not twisted), melting into the panorama's painted sea 420 -> 900 m out; the upper layer keeps only the bright
 * billow crowns. Alpha-blended, double-sided, unfogged, no depth write.
 */
export function paintedSeaGraph(painted: string, gain: number, crown: readonly [number, number]): GraphIr {
  const k = graphKit(), { op, add, sub, mul, div, swz, smooth } = k;
  const wp = swz(op('positionWorld'), 'xz'), t = op('time');
  const mr = op('length', [sub(wp, [0, -190])]), drift = op('combine', [mul(t, 0.4), mul(t, 0.15)]);
  const a = swz(k.tex('painted', div(add(wp, drift), 120)), 'xyz');
  const b = swz(k.tex('painted', add(div(sub(wp, mul(drift, 0.6)), 348), 0.37)), 'xyz');
  let c = k.mix(a, b, 0.35);
  const lum = op('dot', [c, [0.3, 0.59, 0.11]]);
  c = k.mix(mul(c, [0.84, 0.74, 0.82]), mul(c, [1.12, 1.06, 0.96]), smooth(0.38, 0.8, lum));
  c = k.mix(mul(c, [0.62, 0.6, 0.78]), c, smooth(16, 56, mr));
  const far = op('oneMinus', [smooth(420, 900, op('length', [sub(wp, swz(op('cameraPosition'), 'xz'))]))]);
  const alpha = mul(far, smooth(crown[0], crown[1], op('dot', [c, [0.3, 0.59, 0.11]])));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, params: { painted: { type: 'texture', value: painted } }, nodes: k.nodes,
    stages: { surface: { colour: mul(c, gain), alpha } }, effectState: { blend: 'alpha', depthWrite: false, fog: false } };
}

/**
 * The painted maelstrom under the crown as an SF59 material graph: the codex-painted vortex turning slowly on the graph
 * clock, the violet valleys lifted toward a lavender grey and the lit crests kept warm (loop 20: 'too purple, hard bands'),
 * two taps blurred so the band edges soften; only the crown's own sky sees it (110 -> 175 m from the disc's centre).
 */
export function paintedMaelstromGraph(painted: string): GraphIr {
  const k = graphKit(), { op, add, sub, mul, div, swz, smooth } = k;
  const lp = k.varying(swz(op('positionGeometry'), 'xy'));
  const far = k.varying(op('length', [sub(swz(op('cameraPosition'), 'xz'), swz(op('objectOrigin'), 'xz'))]));
  const rn = div(op('length', [lp]), 125), ang = mul(op('time'), -0.012), co = op('cos', [ang]), si = op('sin', [ang]);
  const lx = swz(lp, 'x'), ly = swz(lp, 'y');
  const q = add(div(op('combine', [sub(mul(co, lx), mul(si, ly)), add(mul(si, lx), mul(co, ly))]), 250), 0.5);
  let c = add(mul(swz(k.tex('painted', q), 'xyz'), 0.6), mul(swz(k.tex('painted', add(q, [0.004, 0.003])), 'xyz'), 0.4));
  const l = op('dot', [c, [0.3, 0.59, 0.11]]);
  c = k.mix(c, mul(l, [1.06, 0.98, 0.95]), 0.45);
  c = mul(k.mix(c, [1, 0.93, 0.84], 0.18), 1.06);
  const alpha = mul(op('oneMinus', [smooth(0.55, 0.95, rn)]), op('oneMinus', [smooth(110, 175, far)]));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, params: { painted: { type: 'texture', value: painted } }, nodes: k.nodes,
    stages: { surface: { colour: c, alpha } }, effectState: { blend: 'alpha', depthWrite: false, fog: false } };
}

/** The painted sea's two layers: the lower one whole (`crown` a band below every value), the upper one only its bright
 *  billow crowns, a shade brighter, for parallax on the diagonals. */
export const SEA_LAYERS = { lower: { gain: 1, crown: [-2, -1] }, upper: { gain: 1.06, crown: [0.62, 0.82] } } as const;

/** The discs (metres): each a horizontal circle at `at`, drawn at `order`, turned by `spin` radians about the vertical. */
export const SEA_DISCS = {
  paintedSea: { name: 'far.painted-sea', program: 'paintedSea', radius: 1400, segments: 96, at: [0, -8, 0], order: -7 },
  paintedSeaUpper: { name: 'far.painted-sea.upper', program: 'paintedSea', radius: 1400, segments: 96, at: [0, 6, 0], order: -6, spin: 1.3 },
  paintedMaelstrom: { name: 'far.painted-maelstrom', program: 'paintedMaelstrom', radius: 125, segments: 96, at: [0, 10, -190], order: -6 },
} as const;

/** One disc: its mesh name, program, radius (m) and segments, centre `[x, y, z]` (m), render order and optional turn. */
export interface DiscLayerRow {
  readonly name: string;
  readonly program: string;
  readonly radius: number;
  readonly segments: number;
  readonly at: readonly [number, number, number];
  readonly order: number;
  readonly spin?: number;
}
