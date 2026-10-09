import * as v from 'valibot';
import type { SimHost } from '@wildshard/engine/sim';
import { KING_RECORD } from '../king';

/** The loadout's fixed-step id; its continuation is the held weapon and a swap in progress. */
export const LOADOUT_STEP = 'pine.loadout';
/** The `script` command that picks a weapon: its value is the PINE_ITEMS slot (data/items.ts). */
export const WEAPON_COMMAND = 'pine.weapon';
/** The PINE_ITEMS slots, in order. */
export const PINE_WEAPON = { crossbow: 0, lever: 1, longbow: 2 } as const;
/** The lever-action is owned once the cabin's pickup is taken (the page's Owned 'lever-rifle'); the pickup is not headless
 *  yet, so a tape's start state (or a test) sets the flag. */
export const LEVER_FLAG = 'owned:lever-rifle';
/** EquipmentService: s to lower the held weapon (it changes then), s to raise the next. */
const SWAP_TIME = 0.25;
const SLOTS = 3;

const slot = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(SLOTS - 1));
const Saved = v.strictObject({ held: slot, swap: v.nullable(v.strictObject({ to: slot, t: v.pipe(v.number(), v.finite(), v.minValue(0)), switched: v.boolean() })) });

/** What the loadout is lent: this tick's pick (a slot, or null) and whether a boss intro locks the weapons. */
export interface PineLoadoutPorts {
  readonly pick: () => number | null;
  readonly locked: () => boolean;
}

/** The loadout's view: the held slot, a swap in progress, what is owned, and whether a slot's weapon is live. */
export interface PineLoadout {
  readonly held: () => number;
  readonly swapping: () => boolean;
  readonly owned: (slot: number) => boolean;
  /** held, not mid-swap, not locked by a boss intro: the trigger and the held-only clocks run */
  readonly live: (slot: number) => boolean;
}

/**
 * PINE HOLLOW'S LOADOUT in a renderer-free host (SF72), as the page's EquipmentService swaps: a `script` command
 * `pine.weapon` picks a slot (0 the crossbow, 1 the lever-action, 2 the longbow) when it is owned (the crossbow always, the
 * lever-action on `owned:lever-rifle`, the longbow once the King's bow is paid, `paid:king`); the held weapon lowers for
 * 0.25 s (it changes then) and the next rises for 0.25 s, no weapon live meanwhile; a pick mid-swap finishes the swap at
 * once first. Every weapon steps whether it is held or not (its bolts and arrows fly on, a stowed crossbow reloads itself);
 * only the held one's trigger and held-only clocks run (`live`). A boss intro's lock (BossPorts.lockInput) stills them all.
 */
export function installPineLoadout(host: SimHost, ports: PineLoadoutPorts): PineLoadout {
  // one swap record, reused (`on` while a swap runs)
  const state: { held: number } = { held: PINE_WEAPON.crossbow }, swap = { on: false, to: 0, t: 0, switched: false };
  const owned = (i: number): boolean => i === PINE_WEAPON.crossbow || (i === PINE_WEAPON.lever && host.flags.has(LEVER_FLAG))
    || (i === PINE_WEAPON.longbow && host.flags.has(KING_RECORD.paid));
  const finish = (): void => { if (swap.on) { state.held = swap.to; swap.on = false; } };
  const select = (to: number): void => {
    if (!Number.isInteger(to) || to < 0 || to >= SLOTS || !owned(to)) return;
    if (swap.on) { if (swap.to === to) return; finish(); }
    if (to === state.held) return;
    swap.on = true; swap.to = to; swap.t = 0; swap.switched = false;
  };
  host.onStep(LOADOUT_STEP, dt => {
    const pick = ports.pick();
    if (pick !== null) select(pick);
    if (!swap.on) return;
    swap.t += dt;
    if (swap.t >= SWAP_TIME && !swap.switched) { swap.switched = true; state.held = swap.to; }
    if (swap.t >= SWAP_TIME * 2) finish();
  }, {
    snapshot: () => ({ held: state.held, swap: swap.on ? { to: swap.to, t: swap.t, switched: swap.switched } : null }),
    restore: value => {
      const saved = v.parse(Saved, value);
      state.held = saved.held; swap.on = saved.swap !== null;
      if (saved.swap !== null) { swap.to = saved.swap.to; swap.t = saved.swap.t; swap.switched = saved.swap.switched; }
    },
  });
  return { held: () => state.held, swapping: () => swap.on, owned,
    live: i => state.held === i && !swap.on && !ports.locked() };
}
