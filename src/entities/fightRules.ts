/**
 * Fight rules (E297, DRIFTWOOD-TOP10 row 1) — one set of rules for every enemy on a shard that sets
 * `ChunkDef.fightRules` (Driftwood Isle; Nalati and Pine Hollow keep their own fights):
 *
 *   • ATTACK TOKENS: an attack (a charge's wind-up + run, a crab snap, a monkey bite or coconut throw, a cutlass swing)
 *     needs one of `maxAttackers` tokens. The rest hold back on a ring round you and wait their turn, so three crabs or
 *     a boar sounder never land at once. AnimalManager hands them out (`ThinkCtx.claim` / `mayAttack` for the
 *     self-thinking species, the charge for boars and bears) and takes them back when the attack is over.
 *   • RE-ENGAGE: an engaged charger (boar, bear) does not bolt. After a charge it backs off a few metres, circles on
 *     the ring, then winds up and charges again. Only a nearly dead one may break off (`reengage`).
 *   • The off-screen wind-up warning (src/ui/WindupWarn.ts) and the body clearance (a big animal's body never
 *     swallows the camera) are the other two rules; they live with the manager and the HUD.
 *
 * Pure (no THREE, no DOM): the vitests in test/fight-rules.test.ts drive it directly.
 */

/** A fixed pool of attack tokens: at most `max` holders at once. No allocation after construction. */
export class AttackTokens<T> {
  private readonly held: (T | null)[];
  private n = 0;

  constructor(readonly max: number) {
    this.held = Array.from({ length: Math.max(0, max) }, (): T | null => null);
  }

  /** how many tokens are out */
  get count(): number { return this.n; }

  /** `who` holds a token */
  holds(who: T): boolean {
    for (const h of this.held) if (h === who) return true;
    return false;
  }

  /** `who` may attack now: it holds a token, or one is free */
  free(who: T): boolean { return this.n < this.max || this.holds(who); }

  /** take a token for `who` (true if it holds one afterwards; a holder asking again keeps its own) */
  take(who: T): boolean {
    if (this.holds(who)) return true;
    for (let i = 0; i < this.held.length; i++) {
      if (this.held[i] !== null) continue;
      this.held[i] = who; this.n++;
      return true;
    }
    return false;
  }

  /** give `who`'s token back (a no-op if it holds none) */
  release(who: T): void {
    for (let i = 0; i < this.held.length; i++) if (this.held[i] === who) { this.held[i] = null; this.n--; }
  }

  /** take back every token whose holder is no longer attacking (`still(holder)` false) */
  sweep(still: (who: T) => boolean): void {
    for (let i = 0; i < this.held.length; i++) {
      const h = this.held[i];
      if (h === null || h === undefined || still(h)) continue;
      this.held[i] = null; this.n--;
    }
  }

  clear(): void { this.held.fill(null); this.n = 0; }
}

/** below this fraction of its health a non-relentless charger may break off after a hit … */
export const BREAK_OFF_HP = 0.25;
/** … with this chance per hit */
export const BREAK_OFF_CHANCE = 0.5;

export type Reengage = 'charge' | 'circle' | 'flee';

export interface ReengageIn {
  /** hp / maxHp */
  hpFrac: number;
  /** Old Ironhide never breaks off */
  relentless: boolean;
  /** a uniform 0..1 roll (the manager's seeded rng) */
  roll: number;
  /** the charge cooldown is over */
  ready: boolean;
  /** a token is free (or already held) */
  token: boolean;
  /** m to the player */
  dist: number;
  /** m inside which it charges (HuntTuning.panicDist × the variant's chargeDist) */
  chargeDist: number;
  /** asked on a hit (the only time a nearly dead one may break off) */
  hit: boolean;
}

/**
 * What an engaged charger does next — on a hit, when it notices you, or while it circles: `flee` only when it is
 * nearly dead (and not relentless) and the hit's roll says so; `charge` when its cooldown is over, a token is free and
 * you are inside its charge distance; otherwise `circle` — hold on the ring, facing you, and wait.
 */
export function reengage(o: ReengageIn): Reengage {
  if (o.hit && !o.relentless && o.hpFrac < BREAK_OFF_HP && o.roll < BREAK_OFF_CHANCE) return 'flee';
  if (o.ready && o.token && o.dist < o.chargeDist) return 'charge';
  return 'circle';
}

/** the ring (m from the player) a charger circles on while it waits its turn / its cooldown — inside its charge distance */
export const RING: Record<string, number> = { boar: 6.5, bear: 7.5 };
export const RING_DEFAULT = 6.5;
/** how far past the ring a charger backs off after a charge (m), and the most time it spends backing off (s) */
export const BACKOFF_PAST = 1.0, BACKOFF_MAX_T = 2.2;
/** the charge cooldown under the fight rules (s): after a charge that landed, after one that missed or timed out */
export const RULES_CD_HIT = 3.4, RULES_CD_MISS = 2.0;

/**
 * A point `r` m from the player (px, pz), on the line from the player through the animal (ax, az) swung by `swing` rad —
 * a back-off target (swung ~35°, so it arcs round you rather than straight back) or the next step round the ring.
 * Writes into `out` ({x, z}).
 */
export function aroundPoint(px: number, pz: number, ax: number, az: number, r: number, swing: number, out: { x: number; z: number }): { x: number; z: number } {
  let dx = ax - px, dz = az - pz;
  const d = Math.hypot(dx, dz);
  if (d < 1e-3) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
  const c = Math.cos(swing), sn = Math.sin(swing);
  out.x = px + (dx * c - dz * sn) * r; out.z = pz + (dx * sn + dz * c) * r;
  return out;
}

/** where a charger backs off to after a charge: `ring + BACKOFF_PAST` m from you, swung `side` (±1) × 0.6 rad */
export function backoffPoint(px: number, pz: number, ax: number, az: number, ring: number, side: number, out: { x: number; z: number }): { x: number; z: number } {
  return aroundPoint(px, pz, ax, az, ring + BACKOFF_PAST, side * 0.6, out);
}
