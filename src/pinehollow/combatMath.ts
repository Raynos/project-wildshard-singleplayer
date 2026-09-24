/**
 * The pure geometry and timing rules of Pine Hollow's fights (PINE-HOLLOW-REMASTER PH-C2 / PH-C3 / PH-F1): no three.js,
 * no DOM, so test/pine-combat.test.ts runs them in node. The elites (elites.ts), the Antler King (antlerKing.ts) and the
 * combat feel (feel.ts) all decide "did that land" here.
 *
 * Conventions: an animal's heading `yaw` faces (sin yaw, cos yaw) (AnimalManager's atan2(dx, dz)); the player's yaw
 * faces (−sin yaw, −cos yaw) (the camera looks down −Z at yaw 0; the spawn's yaw π faces +Z).
 */

/** the King's phase starts (hp fraction): I the Warden 1 → II Lanterns Fall 0.6 → III the Last Light 0.3 */
export const KING_PHASE_AT = [1, 0.6, 0.3] as const;

/** the phase (0-based) a health fraction sits in */
export function kingPhaseAt(frac: number): number {
  let p = 0;
  for (let i = 1; i < KING_PHASE_AT.length; i++) if (frac <= (KING_PHASE_AT[i] ?? 0)) p = i;
  return p;
}

/**
 * The root-ring stomp: a ring of radius `ringR` travels out from the King; it catches the player standing within
 * `halfWidth` of it — unless they are in the air (the jump is the dodge).
 */
export function ringCatches(dist: number, ringR: number, halfWidth: number, airborne: boolean): boolean {
  return !airborne && Math.abs(dist - ringR) <= halfWidth;
}

/** (px, pz) inside the lane from (x0, z0) to (x1, z1), `halfWidth` either side (the segment's ends are square) */
export function inLane(px: number, pz: number, x0: number, z0: number, x1: number, z1: number, halfWidth: number): boolean {
  const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
  if (L2 < 1e-9) return Math.hypot(px - x0, pz - z0) <= halfWidth;
  const t = ((px - x0) * dx + (pz - z0) * dz) / L2;
  if (t < 0 || t > 1) return false;
  const cx = x0 + dx * t, cz = z0 + dz * t;
  return Math.hypot(px - cx, pz - cz) <= halfWidth;
}

/** the player inside ±`arc` rad of an animal's heading and within `reach` m (a sweep, a swipe, a charge's contact) */
export function inArc(ax: number, az: number, yaw: number, px: number, pz: number, arc: number, reach: number): boolean {
  const dx = px - ax, dz = pz - az, d = Math.hypot(dx, dz);
  if (d > reach) return false;
  if (d < 1e-4) return true;
  return Math.abs(wrapAngle(Math.atan2(dx, dz) - yaw)) <= arc;
}

/** an angle in (−π, π] */
export function wrapAngle(a: number): number { return Math.atan2(Math.sin(a), Math.cos(a)); }

/** the point `dist` m behind the player (the Ghost Stag's reappearance), turned `side` rad off straight behind */
export function behindPlayer(px: number, pz: number, playerYaw: number, dist: number, side = 0): { x: number; z: number } {
  // the player faces (−sin yaw, −cos yaw): behind is (+sin, +cos), turned by `side`
  const a = playerYaw + side;
  return { x: px + Math.sin(a) * dist, z: pz + Math.cos(a) * dist };
}

/** the heading (animal convention) from (ax, az) toward (bx, bz) */
export function headingTo(ax: number, az: number, bx: number, bz: number): number { return Math.atan2(bx - ax, bz - az); }

/**
 * The Ghost Stag's flight: away from the player, bent round its lair so it never runs off its leash — the further it
 * is from the lair (0 at the lair, 1 at `leashR`), the more the heading turns back along the circle round it.
 */
export function fleeHeading(sx: number, sz: number, px: number, pz: number, lairX: number, lairZ: number, leashR: number): number {
  let ax = sx - px, az = sz - pz;
  const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  const lx = sx - lairX, lz = sz - lairZ, ld = Math.hypot(lx, lz);
  if (ld > 1e-3) {
    const out = Math.min(1, ld / leashR);
    // the tangent on the side the away-vector already leans to
    let tx = -lz / ld, tz = lx / ld;
    if (tx * ax + tz * az < 0) { tx = -tx; tz = -tz; }
    const k = out * out;
    ax = ax * (1 - k) + tx * k - (lx / ld) * k * 0.6;
    az = az * (1 - k) + tz * k - (lz / ld) * k * 0.6;
  }
  return Math.atan2(ax, az);
}

/** seconds between the Ghost Stag's fades: a hit makes it fade, never twice inside this */
export function fadeCooldown(phase2: boolean): number { return phase2 ? 2.4 : 4.5; }

/** the Imperial Bull's bugle calls rivals in only at dusk / by night (PineDayNight's 0..1 getters) */
export function bugleHour(dusk: number, night: number): boolean { return dusk > 0.45 || night > 0.45; }

/** a burning lantern's damage over `dt` s while standing in it: `dps` per second, ticked in `every`-second bites */
export function burnTick(acc: number, dt: number, inside: boolean, every: number): { acc: number; bites: number } {
  if (!inside) return { acc: 0, bites: 0 };
  let a = acc + dt, bites = 0;
  while (a >= every) { a -= every; bites++; }
  return { acc: a, bites };
}

/** hit-stop (s) for a bolt that landed: body 35 ms, head 55, a kill 75 (Driftwood's sword runs 60 / 90 / 140) */
export function boltHitStop(headshot: boolean, killed: boolean): number { return killed ? 0.075 : headshot ? 0.055 : 0.035; }

/** the soft arena wall: the shove (m/s) toward the centre for a player `dist` m out, `r` the wall's inner face */
export function wallPush(dist: number, r: number): number { return dist <= r ? 0 : 4 + 8 * Math.min(1, (dist - r) / 2); }
