import rows from '../data/kingCollisionRows.json' with { type: 'json' };

/**
 * The Antler King's clips, baked (SHARD-PLATFORM C4, sp-o232): his nine clips as rows (E322 F-M1 body plan; the rows
 * runtime/species/kingClips.ts once evaluated every frame), sampled here over each clip's input (and, for the two that also
 * read the clock, over one period of it) into data/kingClips.generated.json. The page and the native host only look the
 * samples up (runtime/species/limbRig.ts `playBakedClip`) and solve the result onto the bones; nothing evaluates a row at
 * runtime.
 *
 * THE CLIPS, all over the same pose record (the limb rig's channels: the spine's scalars, and per limb FL FR BL BR the hoof's
 * dx dy dz toe in slots limb × 4 + 0..3). x is each clip's input:
 *   idle     breathing, the head's slow weight, every hoof planted (x = seconds; every rate is a whole number of cycles in
 *            100 s, so it loops there)
 *   walk     the lateral-sequence walk (BL, FL, BR, FR; stance 0.64), the hump rolling (x = the stride phase)
 *   charge   the bounding rotary gallop, head low and the rack leading (x = the stride phase)
 *   strike   the rearing strike: up on the hind legs (pivot at the hips), forelimbs raised, then slammed down at 1
 *   roar     the strike's rear held without the slam (the bells)
 *   sweep    the antler sweep: wound up to his left with the head driven down, swung hard to his right by 1 (E350 F-X2)
 *   brace    a lane's tell: head down, the rack forward, a forehoof pawing (x = progress, the paw on the clock at 1.6 Hz)
 *   hit      the recoil (x = 1 − the flinch; the head's toss on the clock)
 *   die      the collapse: the hind legs give, then the forequarters sink (x = seconds, still after 0.9)
 * The rest (the hull's joints, its size unit H and strides) is the collision rows' (data/kingCollisionRows.json), measured off
 * the rigged hull.
 */

type Expr = number | string | readonly Expr[];
type Channel = string | number;
type SetRow = readonly [Channel, Expr] | readonly [Channel, Expr, string];
interface Clip {
  readonly lets?: readonly (readonly [string, Expr])[];
  readonly set: readonly SetRow[];
  /** the input grid: from, to, samples, 1 = loops (samples over [from, to)) / 0 = clamps (samples over [from, to]) */
  readonly x: readonly [number, number, number, number];
  /** the clock grid, for a clip that reads t: its period and samples over one period */
  readonly t?: readonly [number, number];
}

const TAU = Math.PI * 2;
const smooth = (x: number): number => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };
const rest = rows.rest;
type Axis = 'x' | 'y' | 'z';
const axisOf = (v: Expr | undefined): Axis => {
  if (v === 'x' || v === 'y' || v === 'z') return v;
  throw new Error(`King clips: bad axis ${String(v)}`);
};
const restAt = (bone: string): { x: number; y: number; z: number } | undefined => (rest.at as Record<string, { x: number; y: number; z: number } | undefined>)[bone];

/** a foot's offset along one gait cycle: planted in stance (moving back at the body's speed), lifted and carried in swing */
function gaitFoot(ph: number, stance: number, stroke: number, lift: number): [number, number, number] {
  const p = ((ph % 1) + 1) % 1;
  if (p < stance) return [stroke * (0.5 - p / stance), 0, 0];
  const u = (p - stance) / (1 - stance);
  return [stroke * (-0.5 + smooth(u)), lift * Math.sin(Math.PI * u) ** 1.2, 0.7 * Math.sin(Math.PI * u) * (1 - u)];
}

interface Scope { x: number; t: number; lets: Map<string, number> }
function name(n: string, s: Scope): number {
  const v = s.lets.get(n);
  if (v !== undefined) return v;
  switch (n) {
    case 'x': return s.x;
    case 't': return s.t;
    case 'H': return rest.H;
    case 'walkStride': return rest.walkStride;
    case 'chargeStride': return rest.chargeStride;
    case 'TAU': return TAU;
    default: throw new Error(`King clips: unknown name ${n}`);
  }
}
function arg(e: readonly Expr[], i: number, s: Scope): number {
  const a = e[i];
  if (a === undefined) throw new Error(`King clips: ${String(e[0])} lacks argument ${i}`);
  return ev(a, s);
}
function ev(e: Expr, s: Scope): number {
  if (typeof e === 'number') return e;
  if (typeof e === 'string') return name(e, s);
  const op = e[0];
  if (typeof op !== 'string') throw new Error('King clips: a call starts with its op');
  switch (op) {
    case '+': { let v = arg(e, 1, s); for (let i = 2; i < e.length; i++) v += arg(e, i, s); return v; }
    case '*': { let v = arg(e, 1, s); for (let i = 2; i < e.length; i++) v *= arg(e, i, s); return v; }
    case '-': return arg(e, 1, s) - arg(e, 2, s);
    case 'neg': return -arg(e, 1, s);
    case 'sin': return Math.sin(arg(e, 1, s));
    case 'cos': return Math.cos(arg(e, 1, s));
    case 'max': return Math.max(arg(e, 1, s), arg(e, 2, s));
    case 'min': return Math.min(arg(e, 1, s), arg(e, 2, s));
    case 'step': { const a = arg(e, 2, s); return smooth((arg(e, 1, s) - a) / (arg(e, 3, s) - a)); }
    case 'at': { const bone = e[1], at = typeof bone === 'string' ? restAt(bone) : undefined; return (at ?? rest.rootPos)[axisOf(e[2])]; }
    case 'root': return rest.rootPos[axisOf(e[1])];
    case 'gait': {
      const c = arg(e, 1, s), g = gaitFoot(arg(e, 2, s), arg(e, 3, s), arg(e, 4, s), arg(e, 5, s));
      return g[c === 0 ? 0 : c === 1 ? 1 : 2];
    }
    default: throw new Error(`King clips: unknown op ${op}`);
  }
}

/** a gait's foot rows for limb `l`: [dy, dz (+ its stroke share), toe] of the stance / swing curve */
const foot = (stance: number) => (l: number, off: number, lift: number, at: number): SetRow[] => {
  const g: Expr[] = [['+', 'x', off], stance, 'stroke', ['*', lift, 'H']];
  return [[l * 4 + 1, ['gait', 1, ...g]], [l * 4 + 2, ['+', ['gait', 0, ...g], ['*', at, 'stroke']]], [l * 4 + 3, ['gait', 2, ...g]]];
};
const walkFoot = foot(0.64), chargeFoot = foot(0.34);

/** the rear about the hips, shared by the strike and the roar (they differ in `a`, `down`, `slamHead` and `reach`) */
const REAR_LETS: readonly (readonly [string, Expr])[] = [
  ['rise', ['step', 'a', 0.0, 0.5]],
  ['up', ['*', 'rise', ['-', 1, 'down']]],
  ['hipZ', ['at', 'hips', 'z']], ['hipY', ['at', 'hips', 'y']],
  ['th', ['*', -0.72, 'up']],
  ['dz', ['-', ['root', 'z'], 'hipZ']], ['dy', ['-', ['root', 'y'], 'hipY']],
  ['c', ['cos', 'th']], ['s', ['sin', 'th']],
  ['fold', ['*', 'up', ['-', 1, 'down']]],
  // the forelimbs: carried round with the body, folded up and forward; at the slam driven down ahead of the rest spot
  ['fzL', ['-', ['at', 'armL_hoof', 'z'], 'hipZ']], ['fyL', ['-', ['at', 'armL_hoof', 'y'], 'hipY']],
  ['rzL', ['+', ['+', 'hipZ', ['*', 'fzL', 'c']], ['*', 'fyL', 's']]], ['ryL', ['+', ['-', 'hipY', ['*', 'fzL', 's']], ['*', 'fyL', 'c']]],
  ['tzL', ['+', ['+', ['-', 'rzL', ['at', 'armL_hoof', 'z']], ['*', 0.14, 'H', 'fold']], ['*', 'reach', ['-', 1, 'up']]]],
  ['tyL', ['+', ['-', 'ryL', ['at', 'armL_hoof', 'y']], ['*', 0.06, 'H', 'fold']]],
  ['fzR', ['-', ['at', 'armR_hoof', 'z'], 'hipZ']], ['fyR', ['-', ['at', 'armR_hoof', 'y'], 'hipY']],
  ['rzR', ['+', ['+', 'hipZ', ['*', 'fzR', 'c']], ['*', 'fyR', 's']]], ['ryR', ['+', ['-', 'hipY', ['*', 'fzR', 's']], ['*', 'fyR', 'c']]],
  ['tzR', ['+', ['+', ['-', 'rzR', ['at', 'armR_hoof', 'z']], ['*', 0.14, 'H', 'fold']], ['*', 'reach', ['-', 1, 'up']]]],
  ['tyR', ['+', ['-', 'ryR', ['at', 'armR_hoof', 'y']], ['*', 0.06, 'H', 'fold']]],
];
const REAR_SET: readonly SetRow[] = [
  ['rootPitch', 'th'],
  ['rootZ', ['-', ['+', ['*', 'dz', ['cos', 'th']], ['*', 'dy', ['sin', 'th']]], 'dz']],
  ['rootY', ['-', ['-', ['+', ['*', ['neg', 'dz'], ['sin', 'th']], ['*', 'dy', ['cos', 'th']]], 'dy'], ['*', 0.06, 'H', 'rise', ['-', 1, ['*', 'down', 0.5]]]]],
  ['hipsPitch', ['*', 0.3, 'up']],   // the pelvis stays under him, the hind legs load
  ['chestPitch', ['*', -0.1, 'up']],
  ['neckPitch', ['*', -0.1, 'up']],
  ['headPitch', ['+', ['*', -0.18, 'up', ['step', 'a', 0.35, 0.6]], 'slamHead']],
  ['headRoll', ['*', 0.04, ['sin', ['*', 'a', 40]], 'up', ['step', 'a', 0.45, 0.7]]],
  ['tailPitch', ['*', 0.3, 'up']],
  [1, ['max', 0, 'tyL'], 'armL_hoof'], [2, 'tzL', 'armL_hoof'], [3, ['*', -0.9, 'fold'], 'armL_hoof'],
  [5, ['max', 0, 'tyR'], 'armR_hoof'], [6, 'tzR', 'armR_hoof'], [7, ['*', -0.9, 'fold'], 'armR_hoof'],
];

const CLIPS: Readonly<Record<string, Clip>> = {
  idle: {
    x: [0, 100, 400, 1],
    lets: [['br', ['sin', ['*', 'x', 'TAU', 0.22]]]],
    set: [
      ['rootY', ['*', 0.006, 'H', 'br']],
      ['chestPitch', ['*', -0.02, 'br']],
      ['neckPitch', ['*', 0.03, ['sin', ['+', ['*', 'x', 'TAU', 0.11], 1]]]],
      ['headPitch', ['*', 0.04, ['sin', ['*', 'x', 'TAU', 0.13]]]],
      ['headYaw', ['*', 0.08, ['sin', ['*', 'x', 'TAU', 0.07]]]],
      ['headRoll', ['*', 0.03, ['sin', ['+', ['*', 'x', 'TAU', 0.09], 2]]]],
      ['tailYaw', ['*', 0.12, ['sin', ['*', 'x', 'TAU', 0.3]]]],
    ],
  },
  walk: {
    x: [0, 1, 64, 1],
    lets: [['stroke', ['*', 'walkStride', 0.64]], ['c2', ['cos', ['*', 'x', 'TAU', 2]]]],
    set: [
      ...walkFoot(0, 0.25, 0.14, -0.25), ...walkFoot(1, 0.75, 0.14, -0.25), ...walkFoot(2, 0.0, 0.09, 0.3), ...walkFoot(3, 0.5, 0.09, 0.3),
      ['rootY', ['+', ['*', -0.025, 'H'], ['*', 0.01, 'H', 'c2']]],
      ['rootRoll', ['*', 0.035, ['sin', ['*', 'x', 'TAU']]]],
      ['chestRoll', ['*', -0.05, ['sin', ['+', ['*', 'x', 'TAU'], 0.8]]]],
      ['chestYaw', ['*', 0.05, ['sin', ['+', ['*', 'x', 'TAU'], 0.4]]]],
      ['chestPitch', ['*', 0.02, 'c2']],
      ['neckPitch', ['-', 0.06, ['*', 0.03, 'c2']]],
      ['headPitch', ['*', 0.03, ['sin', ['+', ['*', 'x', 'TAU', 2], 1]]]],
      ['headYaw', ['*', -0.04, ['sin', ['+', ['*', 'x', 'TAU'], 0.4]]]],
      ['tailYaw', ['*', 0.15, ['sin', ['*', 'x', 'TAU']]]],
    ],
  },
  charge: {
    x: [0, 1, 64, 1],
    lets: [['stroke', ['*', 'chargeStride', 0.34]], ['s', ['sin', ['*', 'x', 'TAU']]], ['c', ['cos', ['*', 'x', 'TAU']]]],
    set: [
      ...chargeFoot(0, 0.55, 0.14, -0.25), ...chargeFoot(1, 0.66, 0.14, -0.25), ...chargeFoot(2, 0.0, 0.1, 0.3), ...chargeFoot(3, 0.1, 0.1, 0.3),
      ['rootY', ['+', ['*', -0.06, 'H'], ['*', 0.03, 'H', ['max', 0, 's']]]],
      ['rootPitch', ['+', ['*', 0.1, 'c'], 0.05]],
      ['chestPitch', 0.12],          // the hump comes down and forward
      ['neckPitch', ['-', 0.2, ['*', 0.05, 'c']]],
      ['headPitch', 0.3],            // the rack lowered, leading
      ['headRoll', ['*', 0.04, 's']],
      ['tailPitch', -0.35],
    ],
  },
  strike: {
    x: [0, 1, 121, 0],
    lets: [['a', 'x'], ['down', ['step', 'a', 0.78, 0.97]], ['slamHead', ['*', 0.22, 'down']], ['reach', ['*', 0.16, 'H', 'down']], ...REAR_LETS],
    set: REAR_SET,
  },
  roar: {
    x: [0, 1, 121, 0],
    lets: [['a', ['min', 'x', 1]], ['down', ['step', 'a', 0.8, 1.0]], ['slamHead', 0], ['reach', 0], ...REAR_LETS],
    set: REAR_SET,
  },
  sweep: {
    x: [0, 1, 81, 0],
    lets: [['wind', ['step', 'x', 0, 0.55]], ['swing', ['step', 'x', 0.62, 0.95]], ['yaw', ['-', ['*', 0.42, 'wind'], ['*', 0.95, 'swing']]]],
    set: [
      ['chestYaw', ['*', 'yaw', 0.45]], ['neckYaw', ['*', 'yaw', 0.4]], ['headYaw', ['*', 'yaw', 0.2]],
      ['rootPitch', ['*', 0.35, 'wind']], ['chestPitch', ['*', 0.3, 'wind']],
      ['neckPitch', ['*', 0.4, 'wind']], ['headPitch', ['*', 0.8, 'wind']],
      ['headRoll', ['*', ['neg', 'yaw'], 0.05]],
      ['chestRoll', ['+', ['*', -0.06, 'wind'], ['*', 0.1, 'swing']]],
      ['rootY', ['*', -0.3, 'H', 'wind']],
      ['rootYaw', ['*', 'yaw', 0.12]],
    ],
  },
  brace: {
    x: [0, 1, 21, 0], t: [1 / 1.6, 16],
    lets: [
      ['k', ['step', 'x', 0, 0.3]],
      ['paw', ['*', ['max', 0, ['sin', ['*', 't', 'TAU', 1.6]]], 'k', ['-', 1, ['step', 'x', 0.85, 1]]]],
    ],
    set: [
      ['rootY', ['*', -0.05, 'H', 'k']], ['rootPitch', ['*', 0.06, 'k']],
      ['chestPitch', ['*', 0.1, 'k']], ['neckPitch', ['*', 0.2, 'k']], ['headPitch', ['*', 0.45, 'k']],
      [1, ['*', 0.14, 'H', 'paw']], [2, ['*', 0.1, 'H', ['cos', ['*', 't', 'TAU', 1.6]], 'k']], [3, ['*', 0.5, 'paw']],
    ],
  },
  hit: {
    x: [0, 1, 2, 0], t: [TAU / 17, 16],
    lets: [['f', ['-', 1, 'x']]],
    set: [
      ['rootPitch', ['*', -0.1, 'f']], ['rootY', ['*', 0.02, 'H', 'f']],
      ['chestPitch', ['*', -0.16, 'f']],
      ['neckPitch', ['*', -0.14, 'f']], ['headPitch', ['*', -0.3, 'f']],
      ['headRoll', ['*', 0.12, 'f', ['sin', ['*', 't', 17]]]],
      ['tailPitch', ['*', 0.2, 'f']],
    ],
  },
  die: {
    x: [0, 1, 41, 0],
    lets: [['hind', ['step', 'x', 0, 0.6]], ['fore', ['step', 'x', 0.25, 0.9]]],
    set: [
      ['rootY', ['*', -0.22, 'H', ['+', ['*', 0.55, 'hind'], ['*', 0.45, 'fore']]]],
      ['rootPitch', ['+', ['*', -0.08, 'hind'], ['*', 0.14, 'fore']]],
      ['chestPitch', ['*', 0.08, 'fore']], ['neckPitch', ['*', 0.2, 'fore']], ['headPitch', ['*', 0.3, 'fore']],
      ['tailPitch', ['*', 0.25, 'hind']],
      [2, ['*', -0.08, 'H', 'fore']], [3, ['*', 0.35, 'fore']],
      [6, ['*', -0.08, 'H', 'fore']], [7, ['*', 0.35, 'fore']],
      [10, ['*', 0.1, 'H', 'hind']], [11, ['*', 0.35, 'hind']],
      [14, ['*', 0.1, 'H', 'hind']], [15, ['*', 0.35, 'hind']],
    ],
  },
};

/** four decimals: a tenth of a millimetre or a milliradian, and the same bytes on every platform's sin / cos */
const round = (v: number): number => { const r = Math.round(v * 1e4) / 1e4; return Object.is(r, -0) ? 0 : r; };

/** The baked table: per clip its channels, its grids and the samples (row-major: t, then x, then channel). */
export function pineKingClips(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, clip] of Object.entries(CLIPS)) {
    const live = clip.set.filter(row => row[2] === undefined || restAt(row[2]) !== undefined);
    const [from, to, n, wrap] = clip.x, tn = clip.t?.[1] ?? 1, period = clip.t?.[0] ?? 0;
    const values: number[] = [];
    for (let j = 0; j < tn; j++) {
      for (let i = 0; i < n; i++) {
        const s: Scope = { x: from + (to - from) * (wrap === 1 ? i / n : i / (n - 1)), t: period * j / tn, lets: new Map() };
        for (const [k, e] of clip.lets ?? []) s.lets.set(k, ev(e, s));
        for (const row of live) values.push(round(ev(row[1], s)));
      }
    }
    out[id] = { channels: live.map(row => row[0]), x: clip.x, ...(clip.t === undefined ? {} : { t: [period, tn] }), values };
  }
  return { version: 1, clips: out };
}
