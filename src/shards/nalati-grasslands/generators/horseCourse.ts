/**
 * The horse playground's field (E307), as numbers, in the field's own frame (x east, z south, the floor at y 0): an oval
 * track round an infield jump lane, a start / finish line on the front (south) straight and a half-way line on the back.
 * Pure data: HorsePlayground.ts builds it, test/playgrounds.test.ts checks the track against the horse's turn.
 *
 *     ┌────────────────────────── the field, walled ──────────────────────────┐
 *     │        ╭──────────────── back straight · HALF ─────────────────╮      │
 *     │       (      |  0.9 m   |  1.0 m   |  1.1 m   |  1.2 m  (jumps)  )    │
 *     │        ╰──────── front straight · START / FINISH ▶ ──────────────╯      │
 *     └──────────────────────────────────────────────────────────────────────┘
 *
 * The lap runs clockwise seen from above as the map draws it: east along the front straight from the start, round the
 * east bend, west along the back straight, round the west bend. The track's centre line is also a road for Mount's
 * keep-to-the-road (B1): let go of the stick at a trot or faster and the horse holds its gait round the oval.
 */

/** the field inside its walls */
export const FIELD = { x0: -120, x1: 120, z0: -75, z1: 75, wall: 4 } as const;
/** the oval: straights from −HALF_LEN to +HALF_LEN along x at z = ±RADIUS, bends of RADIUS round (±HALF_LEN, 0) */
export const OVAL = { halfLen: 60, radius: 38, width: 12 } as const;
/** the posts either side of the band, this far off the centre line, every POST_GAP metres */
export const POST_OFF = 8, POST_GAP = 12;
/** the start / finish line crosses the front straight here (x); the half-way line the back straight */
export const LINE_X = 0;
/** where the horse waits (on the front straight, short of the line, facing east) and where you stand by its left side */
export const HORSE_START = { x: -12, z: OVAL.radius, yaw: Math.PI / 2 } as const;
export const RIDER_START = { x: -13.2, z: OVAL.radius - 1.9 } as const;
/** the infield jump lane: rails across z = 0 (x, top height) — the horse jumps a rail by itself at a canter or faster */
export const JUMPS: readonly { x: number; h: number }[] = [{ x: -30, h: 0.9 }, { x: -10, h: 1.0 }, { x: 10, h: 1.1 }, { x: 30, h: 1.2 }];
export const JUMP_WIDTH = 7;

/** the track's centre line, one lap from the start line in the running direction, a point every ~`step` metres */
export function ovalLine(step = 4): [number, number][] {
  const { halfLen: L, radius: R } = OVAL;
  const out: [number, number][] = [];
  // front straight (z = +R) east from the line, the east bend, the back straight west, the west bend, back to the line
  for (let x = LINE_X; x < L; x += step) out.push([x, R]);
  const arc = Math.ceil((Math.PI * R) / step);
  for (let i = 0; i < arc; i++) { const a = (i / arc) * Math.PI; out.push([L + Math.sin(a) * R, Math.cos(a) * R]); }
  for (let x = L; x > -L; x -= step) out.push([x, -R]);
  for (let i = 0; i < arc; i++) { const a = (i / arc) * Math.PI; out.push([-L - Math.sin(a) * R, -Math.cos(a) * R]); }
  for (let x = -L; x < LINE_X; x += step) out.push([x, R]);
  out.push([LINE_X, R]);
  return out;
}

/** the lap's length on the centre line (m) */
export const LAP_M = 4 * OVAL.halfLen + 2 * Math.PI * OVAL.radius;
