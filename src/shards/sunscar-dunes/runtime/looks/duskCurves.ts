/**
 * Dusk curves (SHARD-PLATFORM M3; ex a dune shard's dusk light): how a look's numbers move with one 0 … 1 progress value
 * (a dusk, a storm, a season), as data. A curve is `scale × (base + Σ gain × shape(d)) × times(d)`, or a two-point `mix`;
 * a shape is a power of d, a smoothstep between two edges, a smoothstep or a clamped linear ramp from a start over a width.
 * `duskRow` evaluates every curve leaf of a nested row, so a family's parameter block can be written with curves where
 * its numbers move and plain values where they hold. Nothing here knows a shard.
 */

/**
 * One term of a curve: `gain` × a shape of d. A `fold` ramp multiplies its gain in from the left (gain·t·t·(3 − 2t)
 * rather than gain·(t·t·(3 − 2t))): the same curve, rounded the way a hand-written one was.
 */
export type DuskTerm =
  | { readonly gain: number; readonly pow: number }
  | { readonly gain: number; readonly edges: readonly [number, number] }
  | { readonly gain: number; readonly ramp: readonly [number, number]; readonly fold?: boolean }
  | { readonly gain: number; readonly linear: readonly [number, number] };

/** A curve of d: `scale × (base + Σ terms) × times`, or `mix` (from a to b along d). */
export interface DuskCurve {
  readonly base?: number;
  readonly terms?: readonly DuskTerm[];
  /** a second curve the first is multiplied by */
  readonly times?: DuskCurve;
  /** a constant factor in front */
  readonly scale?: number;
  /** a + (b − a) × d (with no base or terms) */
  readonly mix?: readonly [number, number];
}

/** A row whose leaves are numbers, curves (`{ curve: … }`), strings, booleans or nested rows and arrays of them. */
export type DuskRow = number | string | boolean | { readonly curve: DuskCurve } | readonly DuskRow[] | { readonly [key: string]: DuskRow };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (t: number): number => t * t * (3 - 2 * t);

function shape(term: DuskTerm, d: number): number {
  if ('pow' in term) return d ** term.pow;
  if ('edges' in term) return smooth(clamp01((d - term.edges[0]) / (term.edges[1] - term.edges[0])));
  if ('ramp' in term) return smooth(clamp01((d - term.ramp[0]) / term.ramp[1]));
  return clamp01((d - term.linear[0]) / term.linear[1]);
}

/** A curve's value at d. */
export function curveAt(curve: DuskCurve, d: number): number {
  let v: number;
  if (curve.mix !== undefined) v = curve.mix[0] + (curve.mix[1] - curve.mix[0]) * d;
  else {
    v = curve.base ?? 0;
    for (const term of curve.terms ?? []) {
      if ('ramp' in term && term.fold === true) { const t = clamp01((d - term.ramp[0]) / term.ramp[1]); v += term.gain * t * t * (3 - 2 * t); }
      else v += term.gain * shape(term, d);
    }
  }
  if (curve.times !== undefined) v *= curveAt(curve.times, d);
  return curve.scale === undefined ? v : curve.scale * v;
}

const isCurve = (row: DuskRow): row is { readonly curve: DuskCurve } => typeof row === 'object' && !Array.isArray(row) && 'curve' in row;

/** Every curve leaf of `row` evaluated at d (the rest copied as it is): a parameter block for that progress value. */
export function duskRow(row: DuskRow, d: number): unknown {
  if (typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map((item: DuskRow) => duskRow(item, d));
  if (isCurve(row)) return curveAt(row.curve, d);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = duskRow(value, d);
  return out;
}
