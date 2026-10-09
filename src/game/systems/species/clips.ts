import type { RigAnimCtx } from '@wildshard/engine/entities/species/registry';

/**
 * Declarative species clips (SHARD-PLATFORM M3): a custom rig's procedural animation as rows instead of a hand-written
 * `animate` function. Each row drives one channel of one bone; each frame its first case whose condition holds sets the
 * channel to the sum of its terms, and each term is the product of its factors, evaluated left to right. That order is
 * the contract: a row written in the same order as the arithmetic it replaces reproduces it bit for bit (signed zeroes
 * included: a term whose condition fails adds +0, it never drops out of the sum).
 *
 * A row with `bind` starts its sum from the bone's bind value (read on the first frame and kept in the animal's `mem`
 * under that key), so a body can sink, rear or collapse from wherever its rig put it.
 */

/** The clocks a factor can read: the animal's time (s) or its gait phase (0..1, advanced from the ground speed). */
export type ClipClock = 't' | 'phase';

/** When a case or a term applies. Every key present must hold. */
export interface ClipWhen {
  /** true: only while alive; false: only once dead. */
  readonly alive?: boolean;
  /** Only while an attack plays (`attack ≥ 0`). */
  readonly attacking?: boolean;
  /** Only while `deathT` is above this (the collapse has begun). */
  readonly deathAbove?: number;
  /** A `mem` number (absent reads 0) compared with `above` (>) and / or `atLeast` (≥). */
  readonly mem?: { readonly key: string; readonly above?: number; readonly atLeast?: number };
}

/** One factor of a term. A bare number is a constant. */
export type ClipFactor =
  | number
  /** `sin(clock × rate + offset)`, or its magnitude with `abs`. */
  | { readonly wave: ClipClock; readonly rate: number; readonly offset?: number; readonly abs?: boolean }
  /** The clock itself (a spin: `t` × a rate factor). */
  | { readonly clock: ClipClock }
  /** A number the species' brain keeps in `mem` (absent reads 0). */
  | { readonly mem: string }
  /** The attack's progress 0..1, × `rate` and capped at `max` when given (pair it with a term `when: { attacking: true }`). */
  | { readonly attack: true; readonly rate?: number; readonly max?: number }
  /** A gait weight: `min(1, |speed| / full)`, × (`speed > run` ? `fast` : `slow`) when `run` is given. One value. */
  | { readonly gait: number; readonly run?: number; readonly fast?: number; readonly slow?: number }
  /** The death collapse, `deathT` clamped to 0..1. */
  | { readonly death: true }
  /** 1 while alive, 0 once dead. */
  | { readonly living: true };

/** One term of a sum: a constant, or the product of its factors (only when `when` holds; else +0). */
export type ClipTerm = number | { readonly when?: ClipWhen; readonly of: readonly ClipFactor[] };

/** One case of a row: the first whose `when` holds sets the channel to the sum of `sum` (an empty sum is 0). */
export interface ClipCase { readonly when?: ClipWhen; readonly sum: readonly ClipTerm[] }

/** The bone channels a row can drive. `scale` sets all three axes. */
export type ClipChannel = 'rotation.x' | 'rotation.y' | 'rotation.z' | 'position.x' | 'position.y' | 'position.z' | 'scale';

/** One row: a bone's channel and its cases, in priority order. When no case holds the channel keeps its value. */
export interface ClipRow {
  readonly bone: string;
  readonly channel: ClipChannel;
  /** The `mem` key that keeps the bone's bind value; the sum then starts from it. */
  readonly bind?: string;
  readonly cases: readonly ClipCase[];
}

/** A species' clips: its rows, played in order every frame. */
export type SpeciesClips = readonly ClipRow[];

/** What a clip reads from the frame: a subset of the engine's rig animation context. */
export type ClipCtx = Pick<RigAnimCtx, 'bones' | 't' | 'phase' | 'speed' | 'alive' | 'deathT' | 'attack' | 'mem'>;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function holds(when: ClipWhen | undefined, c: ClipCtx): boolean {
  if (when === undefined) return true;
  if (when.alive !== undefined && when.alive !== c.alive) return false;
  if (when.attacking === true && !(c.attack >= 0)) return false;
  if (when.deathAbove !== undefined && !(c.deathT > when.deathAbove)) return false;
  const m = when.mem;
  if (m !== undefined) {
    const v = c.mem[m.key] ?? 0;
    if (m.above !== undefined && !(v > m.above)) return false;
    if (m.atLeast !== undefined && !(v >= m.atLeast)) return false;
  }
  return true;
}

function factor(f: ClipFactor, c: ClipCtx): number {
  if (typeof f === 'number') return f;
  if ('wave' in f) {
    const x = (f.wave === 't' ? c.t : c.phase) * f.rate, s = Math.sin(f.offset === undefined ? x : x + f.offset);
    return f.abs === true ? Math.abs(s) : s;
  }
  if ('clock' in f) return f.clock === 't' ? c.t : c.phase;
  if ('mem' in f) return c.mem[f.mem] ?? 0;
  if ('attack' in f) { const a = f.rate === undefined ? c.attack : c.attack * f.rate; return f.max === undefined ? a : Math.min(f.max, a); }
  if ('gait' in f) {
    const w = Math.min(1, Math.abs(c.speed) / f.gait);
    return f.run === undefined ? w : w * (c.speed > f.run ? f.fast ?? 1 : f.slow ?? 1);
  }
  if ('death' in f) return clamp01(c.deathT);
  return c.alive ? 1 : 0;
}

function term(t: ClipTerm, c: ClipCtx): number {
  if (typeof t === 'number') return t;
  if (!holds(t.when, c)) return 0;
  const of = t.of, first = of[0];
  let v = first === undefined ? 0 : factor(first, c);
  for (let i = 1; i < of.length; i++) { const f = of[i]; if (f !== undefined) v *= factor(f, c); }
  return v;
}

/** The value a row's case sets: `base` (when bound) plus each term, left to right. */
function total(sum: readonly ClipTerm[], base: number | undefined, c: ClipCtx): number {
  let v = base, i = 0;
  if (v === undefined) { const first = sum[0]; v = first === undefined ? 0 : term(first, c); i = 1; }
  for (; i < sum.length; i++) { const t = sum[i]; if (t !== undefined) v += term(t, c); }
  return v;
}

type Axis = 'x' | 'y' | 'z';
/** Where each channel writes: the transform it sets and its axis (`null`: all three). */
const TARGET: Readonly<Record<ClipChannel, readonly ['rotation' | 'position' | 'scale', Axis | null]>> = {
  'rotation.x': ['rotation', 'x'], 'rotation.y': ['rotation', 'y'], 'rotation.z': ['rotation', 'z'],
  'position.x': ['position', 'x'], 'position.y': ['position', 'y'], 'position.z': ['position', 'z'], scale: ['scale', null],
};

/** Plays one frame of `clips` on the frame's bones (a bone the rig lacks is skipped). Allocates nothing. */
export function playClips(clips: SpeciesClips, c: ClipCtx): void {
  for (const row of clips) {
    const bone = c.bones[row.bone];
    if (bone === undefined) continue;
    let chosen: ClipCase | undefined;
    for (const k of row.cases) if (holds(k.when, c)) { chosen = k; break; }
    if (chosen === undefined) continue;
    const [group, axis] = TARGET[row.channel];
    let base: number | undefined;
    if (row.bind !== undefined) {
      const bound = c.mem[row.bind] ?? (axis === null ? bone.scale.x : bone[group === 'rotation' ? 'rotation' : 'position'][axis]);
      c.mem[row.bind] = bound; base = bound;
    }
    const v = total(chosen.sum, base, c);
    if (axis === null) bone.scale.setScalar(v);
    else if (group === 'rotation') bone.rotation[axis] = v;
    else bone.position[axis] = v;
  }
}

/** A species' `animate` from its clip rows. */
export const clipAnimate = (clips: SpeciesClips): ((ctx: ClipCtx) => void) => (ctx) => { playClips(clips, ctx); };
