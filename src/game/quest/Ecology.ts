/**
 * Ecology — the island's enemies come back (DRIFTWOOD-REMASTER A6): a crab, monkey, boar, deer or bear you kill is
 * replaced a few minutes later by a fresh one of the same kind + variant at its herd's home (the tidepool, the grove,
 * the beach), and the drowned sailor rises in the wreck's hold again after dark. A replacement only appears while you
 * are more than 60 m from where it would stand — nothing pops in in front of you.
 *
 *   RespawnQueue — the pure part (vitest: test/ecology.test.ts): `add(entry, now)` on a kill, `take(now, x, z, night)`
 *                  hands back the entries that are due, out of sight and (for night-only kinds) in the dark.
 *   installEcology(adv, world) — chains `animals.onKill`, checks the queue once a second, spawns with
 *                  `animals.spawn` and puts the newcomer back into its herd.
 *
 * Per frame it does nothing but compare a timer; the queue is a plain array touched on kills and once a second.
 */
import type { AdvAnimal, AdventureWorld } from './Adventure';

export interface RespawnRule { delay: [number, number]; night?: boolean }

/** seconds until a kind comes back (rolled in the range), and whether it only comes back at night */
export const RESPAWN: Record<string, RespawnRule> = {
  crab: { delay: [240, 360] },
  monkey: { delay: [300, 420] },
  boar: { delay: [300, 420] },
  deer: { delay: [300, 420] },
  bear: { delay: [600, 900] },
  sailor: { delay: [180, 180], night: true },
};

export const OUT_OF_SIGHT = 60;

export interface RespawnEntry { kind: string; variant: string | undefined; herd: number; x: number; z: number; due: number; night: boolean }

export class RespawnQueue {
  readonly pending: RespawnEntry[] = [];
  constructor(private rules: Record<string, RespawnRule> = RESPAWN, private rand: () => number = Math.random) {}

  /** a kill at `now` (seconds): queue its replacement at (x, z) if the kind comes back at all */
  add(kind: string, variant: string | undefined, herd: number, x: number, z: number, now: number): RespawnEntry | null {
    const r = this.rules[kind];
    if (!r) return null;
    const e: RespawnEntry = { kind, variant, herd, x, z, due: now + r.delay[0] + (r.delay[1] - r.delay[0]) * this.rand(), night: r.night === true };
    this.pending.push(e);
    return e;
  }

  /** the entries that are due at `now`, at least OUT_OF_SIGHT m from the player, and — night-only kinds — in the dark; removed from the queue */
  take(now: number, px: number, pz: number, night: number): RespawnEntry[] {
    const out: RespawnEntry[] = [];
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const e = this.pending[i];
      if (e === undefined || now < e.due) continue;
      if (e.night && night < 0.5) continue;
      if ((e.x - px) ** 2 + (e.z - pz) ** 2 < OUT_OF_SIGHT * OUT_OF_SIGHT) continue;
      out.push(e);
      this.pending.splice(i, 1);
    }
    return out;
  }
}

export function installEcology<A extends AdvAnimal>(w: AdventureWorld<A>, isLand: (x: number, z: number) => boolean): RespawnQueue {
  const q = new RespawnQueue();
  let now = 0, checkT = 0, chained = false;
  const chain = (): void => {
    chained = true;
    const prev = w.animals.onKill;
    w.animals.onKill = (a) => {
      prev?.(a);
      if (a.kind === 'captain') return;
      const h = a.herd >= 0 ? w.animals.herds?.[a.herd] : undefined;
      q.add(a.kind, a.variant, a.herd, h ? h.cx : a.position.x, h ? h.cz : a.position.z, now);
    };
  };
  w.game.onUpdate((dt) => {
    if (!chained) chain();
    now += dt;
    if (now - checkT < 1) return;
    checkT = now;
    if (q.pending.length === 0 || !w.animals.spawn) return;
    const night = w.sky.dayNight?.night ?? 0;
    for (const e of q.take(now, w.player.position.x, w.player.position.z, night)) {
      // a spot on land a few metres round the herd's home (the home itself for the sailor: his hold)
      let x = e.x, z = e.z;
      if (e.kind !== 'sailor') for (let k = 0; k < 6; k++) { const ang = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4; const tx = e.x + Math.cos(ang) * r, tz = e.z + Math.sin(ang) * r; if (isLand(tx, tz)) { x = tx; z = tz; break; } }
      if (!isLand(x, z) && e.kind !== 'sailor') { e.due = now + 60; q.pending.push(e); continue; }   // try again in a minute
      const a = w.animals.spawn(e.kind, x, z, Math.random() * Math.PI * 2, e.variant);
      a.herd = e.herd;
      if (e.herd >= 0) w.animals.herds?.[e.herd]?.members.push(a);
    }
  });
  return q;
}
