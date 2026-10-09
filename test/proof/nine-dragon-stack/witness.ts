// oxlint-disable-next-line import/no-nodejs-modules -- The witness reads the native physics module.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Committed native checkpoints are compressed proof data.
import { gzipSync, gunzipSync } from 'node:zlib';
import * as v from 'valibot';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { canonicalSimDigest } from '../../fake/simState';
import { decodeSimSnapshot } from '../../../src/engine/sim/snapshot';
import { createTrustedHeadlessAdapter } from '../../../src/sdk/headlessRuntime';
import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';
import type { TickWorkerAdapter } from '../../../src/sdk/tickWorkerLoop';
import { JIAN_STEP } from '../../../src/shards/nine-dragon-stack/runtime/jian';
import { PORTAL_STEP } from '../../../src/shards/nine-dragon-stack/runtime/portals';
import { GRAPPLE_AIM, GRAPPLE_LOCK, GRAPPLE_STEP } from '../../../src/shards/nine-dragon-stack/runtime/grapple';
import { DECK_PORTALS, SQUARE_ROUTE } from '../../../src/shards/nine-dragon-stack/world/portalPlan';
import { compatibilityProbe } from '../compatibility/fixture';

/**
 * Nine Dragon Stack's whole-shard witness (E435 §C / SF72) on its trusted renderer-free entry, `runtime/headless.ts`,
 * through the platform's own trusted adapter (`createTrustedHeadlessAdapter`: the plan's level and ports, one install, the
 * tick's commands lent to the runtime, a committed snapshot per tick). The tape is tick commands only, tapping the Jian
 * all the way: the player walks the square's declared route (portalPlan.ts `SQUARE_ROUTE`) from the spawn into the ring
 * out, rides to the north deck, steps out of the deck's ring and back in, and rides home to the square (two play-time
 * rides through the page's own ride, runtime/portals.ts); back at the arrival it charges and releases the Jian's heavy on
 * the HEAVY hold, then jumps the square's west balustrade onto the Well's south rim and aims, LOCKs and JUMPs the Fei Zhua
 * across the Well (runtime/grapple.ts over the page's own law, grapple/sim.ts): the lifting crossing, the safety cap open
 * while it flies. Headless: the whole tape, then the adapter's `finish` runs the
 * portal-link entry proof (every deck lane, every bound transfer). Replay: committed checkpoints mid-swing AND mid-ride
 * and mid-crossing restore exactly, then each short suffix is replayed twice to identical canonical state.
 * Ledger: the fragment declares no rule, so the stage reports exactly that.
 */
export const ENTRY = 'runtime/headless.ts';
/** Outcomes are renderer-free. Nine declares no ledger rule or creature; neither is an unproven gameplay system. */
export const SCOPE = {
  transitional: false,
  covers: [
    'the browser-baked native colliders of the grid cell (fragment at +125 m, four landing decks open to the road, square slab, Well crossings and safety cap, placed models)',
    'the player capsule walking those colliders from the declared spawn, by tick commands',
    'the Jian as its declared row on the shipping swept melee clock (combo, one-deep queue, combo gap, cooldown, active windows), exact continuation',
    'the portal-link entry proof: 23 lanes per deck and the format\'s checked transfer to the square and back (provePortalLinks)',
    'portal rides during play on the page\'s own ride (world/portalRide.ts): walked into the square\'s ring and a deck\'s, held through the fade, the format\'s checked transfer under the dark, re-armed on stepping out, exact continuation mid-ride',
    'the Jian\'s charged heavy on the tick protocol\'s HEAVY hold: a 40-tick charge from the square\'s arrival, released into one heavy swing on the same clock',
    'the Fei Zhua on the page\'s own law (grapple/sim.ts over the 31 baked dragon hooks): aim as the phone\'s portrait camera, LOCK, JUMP; fire, bite, lift, zip, vault and settle on the player\'s capsule; the east tower\'s ledge from the arrival and exact continuation mid-zip in headless-runtime.test.ts',
    'the Well crossing (gates / fragments): over the square\'s west balustrade onto the south rim, seen past the rim\'s rail and the safety cap, the lifting zip over the parapet onto a crossing\'s deck; the safety cap\'s baked colliders off exactly while it flies (NdRuntime.guardOpen), closed again on the settle, exact continuation mid-crossing with the cap open (headless-runtime.test.ts)',
  ],
  open: [],
  notApplicable: ['Jian contacts on real targets: Nine has no creatures; its row fires a zero-damage contact at nothing'],
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
/** Back at the arrival: hold HEAVY for 40 ticks (the charge), let go and a second for the heavy swing; then to the Well's
 *  south rim (the square's west balustrade bars the way, x 0.2, 1.1 m high): 6 m south along it, against it, and a running
 *  JUMP west over it onto the rim's ledge (z 11.2…16, the square's datum). */
const HEAVY = WALK.length + 20, HEAVY_TICKS = 40, RIM_AT = HEAVY + HEAVY_TICKS + 60;
const RIM_LEGS: readonly (readonly [number, number, number])[] = [[72, 0, 1], [20, -1, 0], [60, -1, 0], [30, 0, 0]];
const TO_RIM = RIM_LEGS.flatMap(([n, x, z]) => Array.from({ length: n }, () => [x, z] as const)), JUMP_AT = RIM_AT + 92;
/** On the rim: aim north across the Well (the crossing's hook at (-8.2, 121.37, -18.49), 32.8 m off at heading 0.1495,
 *  0.1632 down, seen past the rim's rail and the safety cap), LOCK, JUMP; the zip lifts over the parapet with the cap
 *  open, flies to the crossing's deck and settles, the cap closing behind it, then drops onto the deck (210 ticks). */
const AIM = RIM_AT + TO_RIM.length, HOOK_YAW = 0.1495, HOOK_PITCH = -0.1632;
/** Tick 400: held in the square's ring (touched ~tick 386, the transfer at ~tick 403), mid-way through a Jian swing. */
const TICKS = AIM + 2 + 210;
/** Each replay test owns one checkpoint and compares two short continuations in the same process (no recorded float oracle). */
export type CheckpointName = 'ride' | 'crossing';
const SLICES = { ride: { from: 400, to: 460 }, crossing: { from: 940, to: TICKS } } as const;
const CHECKPOINTS = new URL('test/proof/nine-dragon-stack/checkpoints/', ROOT);
const CheckpointSchema = v.strictObject({ tick: v.pipe(v.number(), v.integer()), snapshot: v.string() });
const ManifestSchema = v.strictObject({ inputs: v.string(), ticks: v.strictObject({ ride: v.literal(400), crossing: v.literal(940) }) });
const MANIFEST = new URL('manifest.json', CHECKPOINTS);
const checkpointFile = (name: CheckpointName): URL => new URL(`${name}.snap.gz`, CHECKPOINTS);
const readCheckpoint = (name: CheckpointName) => v.parse(CheckpointSchema, JSON.parse(gunzipSync(readFileSync(checkpointFile(name))).toString('utf8')));
/** The loaded modules, physics bake and WASM must match before any committed checkpoint is admitted. */
export function checkpointsFresh(inputs: string): { status: 'fresh' | 'stale'; inputs: string; recorded: string } {
  const manifest = v.parse(ManifestSchema, JSON.parse(readFileSync(MANIFEST, 'utf8')));
  return { status: manifest.inputs === inputs ? 'fresh' : 'stale', inputs, recorded: manifest.inputs };
}
/** Write checkpoints from the real uninterrupted command tape; regeneration is explicit, never part of a passing test. */
export async function writeCheckpoints(rapier: Rapier, inputs: string): Promise<object> {
  const sim = await adapter(rapier);
  try {
    mkdirSync(CHECKPOINTS, { recursive: true });
    let from = 0;
    for (const name of ['ride', 'crossing'] as const) {
      const tick = SLICES[name].from, snapshot = run(sim, from, tick);
      checkCheckpoint(name, snapshot);
      writeFileSync(checkpointFile(name), gzipSync(JSON.stringify({ tick, snapshot }), { level: 9 }));
      from = tick;
    }
    const manifest = v.parse(ManifestSchema, { inputs, ticks: { ride: SLICES.ride.from, crossing: SLICES.crossing.from } });
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    return { status: 'written', ...manifest };
  } finally { sim.dispose(); }
}

export function nineRapier(): Promise<Rapier> { return loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', ROOT))); }
function adapter(rapier: Rapier, snapshot?: string): Promise<TickWorkerAdapter> {
  return createTrustedHeadlessAdapter({ shard: source, assets: new Map(), rapier }, { module: MODULE }, snapshot);
}
/** The tape: the walk, three Jian taps 12 ticks apart every 1.5 s (a chained combo, then the gap lapses). */
function tape(tick: number): HeadlessCommand[] {
  const [moveX, moveZ] = WALK[tick] ?? [0, 0];
  if (tick >= AIM) {
    const commands: HeadlessCommand[] = [{ kind: 'player', moveX: 0, moveZ: 0, yaw: HOOK_YAW, ...(tick === AIM + 1 ? { jump: true as const } : {}) }];
    if (tick === AIM) commands.push({ kind: 'script', actorId: GRAPPLE_AIM, value: HOOK_PITCH }, { kind: 'script', actorId: GRAPPLE_LOCK, value: 1 });
    return commands;
  }
  if (tick >= RIM_AT) {
    const [x, z] = TO_RIM[tick - RIM_AT] ?? [0, 0];
    return [{ kind: 'player', moveX: x, moveZ: z, yaw: HOOK_YAW, ...(tick === JUMP_AT ? { jump: true as const } : {}) }];
  }
  if (tick >= HEAVY) return [{ kind: 'player', moveX, moveZ, yaw: tick / 200, ...(tick < HEAVY + HEAVY_TICKS ? { heavy: {} } : {}) }];
  const attack = tick % 90 === 10 || tick % 90 === 22 || tick % 90 === 34;
  return [{ kind: 'player', moveX, moveZ, yaw: tick / 200, ...(attack ? { attack: { targetId: 'none' } } : {}) }];
}
interface GrappleSaved { sim: { phase: string; target: { lifts: boolean } | null }; last: { x: number; y: number; z: number } }
function grapple(snapshot: string): GrappleSaved {
  const state = decodeSimSnapshot(snapshot).adapters.find(row => row.id === GRAPPLE_STEP)?.state;
  if (typeof state !== 'string') throw new Error('Missing Fei Zhua continuation');
  return JSON.parse(state) as GrappleSaved;
}
/** The grapple's phases seen along the run, in order (each once, as it changes), and the ticks the safety cap stood open
 *  (the law's `guardOpen`: a lifting crossing in flight; the cap's colliders follow it, headless-runtime.test.ts). */
const phases: string[] = [];
let capOpen = 0;
interface RideSaved { held: object | null; ride: { t: number; rides: readonly { from: string; to: string }[]; refused: readonly string[] } }
function portals(snapshot: string): RideSaved {
  const state = decodeSimSnapshot(snapshot).adapters.find(row => row.id === PORTAL_STEP)?.state;
  if (typeof state !== 'string') throw new Error('Missing portal ride continuation');
  return JSON.parse(state) as RideSaved;
}
/** A continuation's hash: the snapshot in canonical form (test/fake/simState.ts: Rapier's snapshot bytes are not canonical, so the
 *  native world counts as the state it restores to, exactly) */
const digest = (snapshot: string): string => canonicalSimDigest(snapshot);
function jian(snapshot: string): { swings: number; hits: number; move: number | null } {
  const state = decodeSimSnapshot(snapshot).adapters.find(row => row.id === JIAN_STEP)?.state;
  if (typeof state !== 'string') throw new Error('Missing Jian continuation');
  const value = JSON.parse(state) as { swings: number; hits: number; clock: { move: number | null } };
  return { swings: value.swings, hits: value.hits, move: value.clock.move };
}
const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replaceAll(ROOT.href, 'repo:/');
/** Run ticks [from, to) through one adapter; every tick commits, and must emit nothing (Nine declares no gameplay fact).
 *  `watch` reads the grapple's phases off each committed snapshot (the headless stage; the replay compares hashes only). */
function run(sim: TickWorkerAdapter, from: number, to: number, watch = false): string {
  let snapshot = '';
  for (let tick = from; tick < to; tick++) {
    sim.step(tape(tick)); const commit = sim.commit();
    if (commit.effects.length > 0) throw new Error('Nine Dragon emitted a gameplay effect it does not declare');
    snapshot = commit.snapshot;
    if (!watch) continue;
    const law = tick >= AIM ? grapple(snapshot).sim : { phase: 'idle', target: null }, phase = law.phase;
    if (phase !== phases.at(-1)) phases.push(phase);
    if (phase !== 'idle' && law.target?.lifts === true) capOpen++;
  }
  return snapshot;
}

export async function headlessProof(rapier: Rapier): Promise<object> {
  let sim: TickWorkerAdapter | undefined;
  try {
    sim = await adapter(rapier); phases.length = 0; capOpen = 0;
    const snapshot = run(sim, 0, TICKS, true), entries = sim.finish(), blade = jian(snapshot), ride = portals(snapshot);
    if (ride.ride.refused.length > 0) throw new Error(`A play-time portal ride was refused: ${ride.ride.refused.join('; ')}`);
    return { status: 'passed', ticksExecuted: entries.ticks, swings: blade.swings, contacts: blade.hits, effects: 0,
      rides: ride.ride.rides.map(r => `${r.from}>${r.to}`), grapple: { phases: [...phases], capOpenTicks: capOpen, landed: grapple(snapshot).last },
      entries: { lanes: entries.lanes, steps: entries.steps, portalTransfers: entries.portalTransfers ?? 0 } };
  } catch (error) { return { status: 'failed', dependency: reason(error), ticksExecuted: 0 }; } finally { sim?.dispose(); }
}

/** Fail if the bake ever moves away from its gameplay boundary. */
function checkCheckpoint(name: CheckpointName, snapshot: string): object {
  if (decodeSimSnapshot(snapshot).state.tick !== SLICES[name].from) throw new Error('Checkpoint tick mismatch');
  if (name === 'ride') {
    const at = jian(snapshot), ride = portals(snapshot);
    if (at.move === null) throw new Error('The checkpoint must fall mid-swing');
    if (ride.held === null || ride.ride.t < 0 || ride.ride.rides.length > 0) throw new Error('The checkpoint must fall mid-ride, held before the transfer');
    return { swing: at.move, swings: at.swings, rideClock: Number(ride.ride.t.toFixed(4)) };
  }
  const law = grapple(snapshot).sim;
  if (law.phase !== 'zip' || law.target?.lifts !== true) throw new Error('The checkpoint must fall mid-crossing, with the safety cap open');
  return { phase: law.phase, lifts: law.target.lifts };
}

export async function replayProof(rapier: Rapier, inputs: string, name: CheckpointName): Promise<object> {
  let sim: TickWorkerAdapter | undefined, replay: TickWorkerAdapter | undefined;
  try {
    if (checkpointsFresh(inputs).status !== 'fresh') throw new Error('Stale Nine Dragon checkpoints; regenerate from current headless inputs');
    const saved = readCheckpoint(name), { from, to } = SLICES[name];
    if (saved.tick !== from) throw new Error('Checkpoint envelope tick mismatch');
    const at = checkCheckpoint(name, saved.snapshot);
    sim = await adapter(rapier, saved.snapshot);
    if (digest(sim.commit().snapshot) !== digest(saved.snapshot)) throw new Error('Checkpoint does not restore exactly');
    const end = run(sim, from, to), hash = digest(end);
    sim.dispose(); sim = undefined;
    replay = await adapter(rapier, saved.snapshot);
    const replayEnd = run(replay, from, to), replayHash = digest(replayEnd);
    if (name === 'ride' && portals(end).ride.rides.length !== 1) throw new Error('The replay must finish the first portal transfer');
    if (name === 'crossing' && grapple(end).sim.phase !== 'idle') throw new Error('The replay must settle the Well crossing');
    return { status: replayHash === hash ? 'passed' : 'failed', checkpointCaptured: true, checkpoint: { tick: from, ...at },
      suffixTicksExecuted: to - from, ticksExecuted: 2 * (to - from), hash, replayHash };
  } catch (error) { return { status: 'failed', dependency: reason(error), checkpointCaptured: false, suffixTicksExecuted: 0 }; } finally { sim?.dispose(); replay?.dispose(); }
}

/** The real shard source in strict Node: no declared ledger rule, so `not-declared` and no emission claimed. */
export async function ledgerProof(): Promise<object> {
  const result: unknown = await compatibilityProbe('nine-dragon-stack', ENTRY, 'ledger');
  if (typeof result !== 'object' || result === null || !('ledger' in result) || !('declarations' in result)) throw new Error('Missing ledger stage');
  return { declarations: result.declarations, ledger: result.ledger };
}
