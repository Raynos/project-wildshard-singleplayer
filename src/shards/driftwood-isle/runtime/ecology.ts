/** Renderer-free copy of the shipping Ecology queue; exact page-oracle tests fence its rule/order. */
export interface RespawnRule { delay: [number, number]; night?: boolean }

/** seconds until a kind comes back (rolled in the range), and whether it only comes back at night */
export const RESPAWN: Record<string, RespawnRule> = {
  crab: { delay: [240, 360] },
  monkey: { delay: [300, 420] },
  boar: { delay: [300, 420] },
  bear: { delay: [600, 900] },
  sailor: { delay: [180, 180], night: true },
};

export const OUT_OF_SIGHT = 60;

export interface RespawnEntry { kind: string; variant: string | undefined; herd: number; x: number; z: number; due: number; night: boolean }

export class RespawnQueue {
  readonly pending: RespawnEntry[] = [];
  private readonly due: RespawnEntry[] = [];
  constructor(private rules: Record<string, RespawnRule>, private rand: () => number) {}

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
    const out = this.due; out.length = 0;
    const length = this.pending.length;
    if (length > 256) throw new Error('Driftwood ecology queue exceeds its native bound');
    for (let n = 0; n < 256; n++) {
      const i = length - 1 - n; if (i < 0) break;
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

