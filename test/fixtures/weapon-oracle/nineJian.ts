import * as v from 'valibot';
import type { SimHost } from '@wildshard/engine/sim';
import type { ShardItems } from '@wildshard/format/items';
import { SweptMeleeCore } from '@wildshard/engine/combat/sweptMeleeCore';

/** The declared Jian row's id (data/items.ts) and its fixed-step adapter id. */
export const JIAN_ID = 'weapon.jian';
export const JIAN_STEP = `item.${JIAN_ID}`;
/** The fixed step's seconds (the host's 60 Hz tick), the world clock the combo gap is measured on. */
const DT = 1 / 60;

/** The Jian in the host: the swings started and the active windows whose declared contact fired (both continuation). */
export interface NineJian {
  readonly swings: () => number;
  readonly contacts: () => number;
}

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ queued: v.boolean(), struck: v.boolean(), swings: v.pipe(finite, v.integer(), v.minValue(0)), hits: v.pipe(finite, v.integer(), v.minValue(0)),
  clock: v.strictObject({ move: v.nullable(v.pipe(finite, v.integer(), v.minValue(0))), swingT: finite, comboIdx: v.pipe(finite, v.integer(), v.minValue(0)), lastSwingEnd: finite,
    cooldown: finite, charging: v.boolean(), chargeT: finite, releaseQueued: v.boolean(), chargePending: v.boolean(), heldPrev: v.boolean(), time: finite }) });

/**
 * Nine Dragon's Jian as a real item in the renderer-free host (SF72): the swept melee family's own clock
 * (`SweptMeleeCore`, the one the browser's `Sword` drives) over the admitted item's numeric profile
 * (data/items.ts: the shipping combo, heavy, cooldown, combo gap and chain lag). A player command's attack is a
 * light tap; its `heavy` is the HEAVY hold, held while the commands carry it, charging and releasing the heavy as the
 * browser's Sword does on the same clock. Each swing's active
 * window fires the declared row's contact once (data/items.ts: zero damage within 0.01 m), never an invented one; Nine
 * has no creature, so there is nothing for it to strike and no targeting is installed. The clock, its one-deep queued
 * tap, the swing's fired flag and the counts are exact continuation.
 */
export function installNineJian(host: SimHost, row: Extract<ShardItems['rows'][number], { kind: 'weapon' }>, attacks: () => boolean, heavy: () => boolean = () => false): NineJian {
  if (row.id !== JIAN_ID) throw new Error('Nine Dragon declares its Jian as a weapon row');
  const profile = row.profile;
  if (profile?.family !== 'melee') throw new Error('The Jian row requires its admitted melee profile');
  const moves = profile.moves;
  const state = { queued: false, struck: false, swings: 0, hits: 0 };
  const clock = new SweptMeleeCore(moves, profile, { queue: () => { state.queued = true; }, consume: () => { const was = state.queued; state.queued = false; return was; } },
    { start: () => { state.struck = false; state.swings++; }, charge: () => { /* the heavy's charge is presentation */ } });
  host.onStep(JIAN_STEP, () => {
    if (attacks()) clock.tryFire();
    const { move, active } = clock.step(DT, host.state.tick * DT, profile.swingScale, heavy());
    // the swing's active window opens: the row's declared contact fires once (Nine has no creature, so it strikes nothing)
    if (move !== null && active && !state.struck) { state.struck = true; state.hits++; }
  }, { snapshot: () => JSON.stringify({ ...state, clock: clock.snapshot() }), restore: value => {
    if (typeof value !== 'string') throw new Error('Invalid Nine Jian continuation');
    const saved = v.parse(Saved, JSON.parse(value));
    state.queued = saved.queued; state.struck = saved.struck; state.swings = saved.swings; state.hits = saved.hits; clock.restore(saved.clock);
  } });
  return { swings: () => state.swings, contacts: () => state.hits };
}
