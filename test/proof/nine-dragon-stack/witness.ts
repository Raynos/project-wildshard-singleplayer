// oxlint-disable-next-line import/no-nodejs-modules -- The witness reads the native physics module.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete serialized continuations.
import { createHash } from 'node:crypto';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { decodeSimSnapshot } from '../../../src/engine/sim/snapshot';
import { createTrustedHeadlessAdapter } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';
import type { TickWorkerAdapter } from '../../../src/sdk/tickWorkerLoop';
import { JIAN_STEP } from '../../../src/shards/nine-dragon-stack/runtime/jian';
import { PORTAL_STEP } from '../../../src/shards/nine-dragon-stack/runtime/portals';
import { DECK_PORTALS, SQUARE_ROUTE } from '../../../src/shards/nine-dragon-stack/world/portalPlan';
import { compatibilityProbe } from '../compatibility/fixture';

/**
 * Nine Dragon Stack's whole-shard witness (E435 §C / SF72) on its trusted renderer-free entry, `runtime/headless.ts`,
 * through the platform's own trusted adapter (`createTrustedHeadlessAdapter`: the plan's level and ports, one install, the
 * tick's commands lent to the runtime, a committed snapshot per tick). The tape is tick commands only, tapping the Jian
 * all the way: the player walks the square's declared route (portalPlan.ts `SQUARE_ROUTE`) from the spawn into the ring
 * out, rides to the north deck, steps out of the deck's ring and back in, and rides home to the square (two play-time
 * rides through the page's own ride, runtime/portals.ts). Headless: the whole tape, then the adapter's `finish` runs the
 * portal-link entry proof (every deck lane, every bound transfer). Replay: a checkpoint mid-swing AND mid-ride (held in
 * the square's ring, before the transfer) restored into a fresh adapter replays the suffix to the identical snapshot.
 * Ledger: the fragment declares no rule, so the stage reports exactly that.
 */
export const ENTRY = 'runtime/headless.ts';
/**
 * What this witness covers, and what it does not (honestly transitional): it passes for the systems the headless world
 * runs; the open ones are absent from it, not proven. Nine declares no quest, fact or ledger rule, so `not-declared` is
 * the ledger stage's truth, not a skipped stage.
 */
export const SCOPE = {
  transitional: true,
  covers: [
    'the browser-baked native colliders of the grid cell (fragment at +125 m, four landing decks open to the road, square slab, Well crossings and safety cap, placed models)',
    'the player capsule walking those colliders from the declared spawn, by tick commands',
    'the Jian as its declared row on the shipping swept melee clock (combo, one-deep queue, combo gap, cooldown, active windows), exact continuation',
    'the portal-link entry proof: 23 lanes per deck and the format\'s checked transfer to the square and back (provePortalLinks)',
    'portal rides during play on the page\'s own ride (world/portalRide.ts): walked into the square\'s ring and a deck\'s, held through the fade, the format\'s checked transfer under the dark, re-armed on stepping out, exact continuation mid-ride',
  ],
  open: [
    'Fei Zhua (targeting, rope pull, swing, climb): browser only; the headless world has no grapple',
    'gates / fragments: the Well safety cap never opens (NdRuntime.guardOpen is the Fei Zhua\'s), crossings stand as baked',
    'Jian contacts on real targets: Nine has no creature, so each active window fires the row\'s zero-damage contact at nothing (the charged heavy runs on the HEAVY hold, not yet in this tape)',
  ],
  ledger: 'Nine declares no quest, fact or ledger rule (shard.config.ts), so there is nothing to emit: the stage loads the real source and reports the empty declaration',
} as const;

const ROOT = new URL('../../../', import.meta.url);
const MODULE = new URL(`src/shards/nine-dragon-stack/${ENTRY}`, ROOT).href;
/** The walk's speed per tick (the host's 5 m/s at 60 Hz) and the north deck the square's ring sends a fresh spawn to. */
const STEP = 5 / 60, NORTH = DECK_PORTALS[0];
if (NORTH === undefined) throw new Error('Nine Dragon declares its north deck portal');
/** The walk as [ticks, world move x, world move z] legs: each route leg at full speed, a still second for the ride, then
 *  2.5 m out of the deck's ring (re-arming it), back in (the ride home) and a still second. */
const LEGS: readonly (readonly [number, number, number])[] = [
  ...SQUARE_ROUTE.slice(1).map((to, i): [number, number, number] => {
    const from = SQUARE_ROUTE[i]; if (from === undefined) throw new Error('route leg');
    const dx = to[0] - from[0], dz = to[2] - from[2], d = Math.hypot(dx, dz);
    return [Math.round(d / STEP), dx / d, dz / d];
  }),
  [60, 0, 0], [30, -NORTH.nx, -NORTH.nz], [26, NORTH.nx, NORTH.nz], [60, 0, 0],
];
const WALK = LEGS.flatMap(([n, x, z]) => Array.from({ length: n }, () => [x, z] as const));
/** Tick 400: held in the square's ring (touched ~tick 386, the transfer at ~tick 403), mid-way through a Jian swing. */
const TICKS = WALK.length, CHECKPOINT = 400;

export function nineRapier(): Promise<Rapier> { return loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', ROOT))); }
const adapter = (rapier: Rapier, snapshot?: string): Promise<TickWorkerAdapter> =>
  createTrustedHeadlessAdapter({ shard: source, assets: new Map(), rapier }, { module: MODULE }, snapshot);
/** The tape: the walk, three Jian taps 12 ticks apart every 1.5 s (a chained combo, then the gap lapses). */
function tape(tick: number): HeadlessCommand[] {
  const attack = tick % 90 === 10 || tick % 90 === 22 || tick % 90 === 34, [moveX, moveZ] = WALK[tick] ?? [0, 0];
  return [{ kind: 'player', moveX, moveZ, yaw: tick / 200, ...(attack ? { attack: { targetId: 'none' } } : {}) }];
}
interface RideSaved { held: object | null; ride: { t: number; rides: readonly { from: string; to: string }[]; refused: readonly string[] } }
function portals(snapshot: string): RideSaved {
  const state = decodeSimSnapshot(snapshot).adapters.find(row => row.id === PORTAL_STEP)?.state;
  if (typeof state !== 'string') throw new Error('Missing portal ride continuation');
  return JSON.parse(state) as RideSaved;
}
const digest = (snapshot: string): string => createHash('sha256').update(snapshot).digest('hex');
function jian(snapshot: string): { swings: number; hits: number; move: number | null } {
  const state = decodeSimSnapshot(snapshot).adapters.find(row => row.id === JIAN_STEP)?.state;
  if (typeof state !== 'string') throw new Error('Missing Jian continuation');
  const value = JSON.parse(state) as { swings: number; hits: number; clock: { move: number | null } };
  return { swings: value.swings, hits: value.hits, move: value.clock.move };
}
const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replaceAll(ROOT.href, 'repo:/');
/** Run ticks [from, to) through one adapter; every tick commits, and must emit nothing (Nine declares no gameplay fact). */
function run(sim: TickWorkerAdapter, from: number, to: number): string {
  let snapshot = '';
  for (let tick = from; tick < to; tick++) {
    sim.step(tape(tick)); const commit = sim.commit();
    if (commit.effects.length > 0) throw new Error('Nine Dragon emitted a gameplay effect it does not declare');
    snapshot = commit.snapshot;
  }
  return snapshot;
}

export async function headlessProof(rapier: Rapier): Promise<object> {
  let sim: TickWorkerAdapter | undefined;
  try {
    sim = await adapter(rapier);
    const snapshot = run(sim, 0, TICKS), entries = sim.finish(), blade = jian(snapshot), ride = portals(snapshot);
    if (ride.ride.refused.length > 0) throw new Error(`A play-time portal ride was refused: ${ride.ride.refused.join('; ')}`);
    return { status: 'passed', ticksExecuted: entries.ticks, swings: blade.swings, contacts: blade.hits, effects: 0,
      rides: ride.ride.rides.map(r => `${r.from}>${r.to}`),
      entries: { lanes: entries.lanes, steps: entries.steps, portalTransfers: entries.portalTransfers ?? 0 } };
  } catch (error) { return { status: 'failed', dependency: reason(error), ticksExecuted: 0 }; } finally { sim?.dispose(); }
}

export async function replayProof(rapier: Rapier): Promise<object> {
  let sim: TickWorkerAdapter | undefined, replay: TickWorkerAdapter | undefined;
  try {
    sim = await adapter(rapier);
    const checkpoint = run(sim, 0, CHECKPOINT), hash = digest(run(sim, CHECKPOINT, TICKS)), at = jian(checkpoint), ride = portals(checkpoint);
    if (at.move === null) throw new Error('The checkpoint must fall mid-swing');
    if (ride.held === null || ride.ride.t < 0 || ride.ride.rides.length > 0) throw new Error('The checkpoint must fall mid-ride, held before the transfer');
    replay = await adapter(rapier, checkpoint);
    const replayHash = digest(run(replay, CHECKPOINT, TICKS));
    return { status: replayHash === hash ? 'passed' : 'failed', checkpointCaptured: true, checkpoint: { tick: CHECKPOINT, swing: at.move, swings: at.swings, rideClock: Number(ride.ride.t.toFixed(4)) },
      suffixTicksExecuted: TICKS - CHECKPOINT, hash, replayHash };
  } catch (error) { return { status: 'failed', dependency: reason(error), checkpointCaptured: false, suffixTicksExecuted: 0 }; } finally { sim?.dispose(); replay?.dispose(); }
}

/** The real shard source in strict Node: no declared ledger rule, so `not-declared` and no emission claimed. */
export async function ledgerProof(): Promise<object> {
  const result: unknown = await compatibilityProbe('nine-dragon-stack', ENTRY, 'ledger');
  if (typeof result !== 'object' || result === null || !('ledger' in result) || !('declarations' in result)) throw new Error('Missing ledger stage');
  return { declarations: result.declarations, ledger: result.ledger };
}
