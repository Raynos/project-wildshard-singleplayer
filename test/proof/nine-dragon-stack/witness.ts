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
import { compatibilityProbe } from '../compatibility/fixture';

/**
 * Nine Dragon Stack's whole-shard witness (E435 §C / SF72) on its trusted renderer-free entry, `runtime/headless.ts`,
 * through the platform's own trusted adapter (`createTrustedHeadlessAdapter`: the plan's level and ports, one install, the
 * tick's commands lent to the runtime, a committed snapshot per tick). The tape is tick commands only: the player strolls
 * Lantern Square tapping the Jian. Headless: 300 ticks (five seconds, four combo rounds), then the adapter's `finish` runs the portal-link entry proof
 * (every deck lane, every bound transfer). Replay: a mid-swing checkpoint restored into a fresh adapter replays the suffix
 * to the identical snapshot. Ledger: the fragment declares no rule, so the stage reports exactly that.
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
  ],
  open: [
    'Fei Zhua (targeting, rope pull, swing, climb): browser only; the headless world has no grapple',
    'portal rides during play (ring trigger, hold, checked transfer): browser only; only the entry proof transfers',
    'gates / fragments: the Well safety cap never opens (NdRuntime.guardOpen is the Fei Zhua\'s), crossings stand as baked',
    'Jian contacts on real targets: Nine has no creature, so each active window fires the row\'s zero-damage contact at nothing; the charged heavy needs a hold the tick protocol does not carry',
  ],
  ledger: 'Nine declares no quest, fact or ledger rule (shard.config.ts), so there is nothing to emit: the stage loads the real source and reports the empty declaration',
} as const;

const ROOT = new URL('../../../', import.meta.url);
const MODULE = new URL(`src/shards/nine-dragon-stack/${ENTRY}`, ROOT).href;
const TICKS = 300, CHECKPOINT = 195;

export function nineRapier(): Promise<Rapier> { return loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', ROOT))); }
const adapter = (rapier: Rapier, snapshot?: string): Promise<TickWorkerAdapter> =>
  createTrustedHeadlessAdapter({ shard: source, assets: new Map(), rapier }, { module: MODULE }, snapshot);
/** The tape: a stroll round the square, three Jian taps 12 ticks apart every 1.5 s (a chained combo, then the gap lapses). */
function tape(tick: number): HeadlessCommand[] {
  const attack = tick % 90 === 10 || tick % 90 === 22 || tick % 90 === 34;
  return [{ kind: 'player', moveX: Math.sin(tick / 50) * 0.5, moveZ: Math.cos(tick / 70) * 0.5, yaw: tick / 200, ...(attack ? { attack: { targetId: 'none' } } : {}) }];
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
    const snapshot = run(sim, 0, TICKS), entries = sim.finish(), blade = jian(snapshot);
    return { status: 'passed', ticksExecuted: entries.ticks, swings: blade.swings, contacts: blade.hits, effects: 0,
      entries: { lanes: entries.lanes, steps: entries.steps, portalTransfers: entries.portalTransfers ?? 0 } };
  } catch (error) { return { status: 'failed', dependency: reason(error), ticksExecuted: 0 }; } finally { sim?.dispose(); }
}

export async function replayProof(rapier: Rapier): Promise<object> {
  let sim: TickWorkerAdapter | undefined, replay: TickWorkerAdapter | undefined;
  try {
    sim = await adapter(rapier);
    const checkpoint = run(sim, 0, CHECKPOINT), hash = digest(run(sim, CHECKPOINT, TICKS)), at = jian(checkpoint);
    if (at.move === null) throw new Error('The checkpoint must fall mid-swing');
    replay = await adapter(rapier, checkpoint);
    const replayHash = digest(run(replay, CHECKPOINT, TICKS));
    return { status: replayHash === hash ? 'passed' : 'failed', checkpointCaptured: true, checkpoint: { tick: CHECKPOINT, swing: at.move, swings: at.swings },
      suffixTicksExecuted: TICKS - CHECKPOINT, hash, replayHash };
  } catch (error) { return { status: 'failed', dependency: reason(error), checkpointCaptured: false, suffixTicksExecuted: 0 }; } finally { sim?.dispose(); replay?.dispose(); }
}

/** The real shard source in strict Node: no declared ledger rule, so `not-declared` and no emission claimed. */
export async function ledgerProof(): Promise<object> {
  const result: unknown = await compatibilityProbe('nine-dragon-stack', ENTRY, 'ledger');
  if (typeof result !== 'object' || result === null || !('ledger' in result) || !('declarations' in result)) throw new Error('Missing ledger stage');
  return { declarations: result.declarations, ledger: result.ledger };
}
