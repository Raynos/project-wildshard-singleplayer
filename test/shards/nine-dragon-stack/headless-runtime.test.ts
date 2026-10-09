// oxlint-disable-next-line import/no-nodejs-modules -- The headless runtime reads the native physics module.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Import the trusted runtime in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import type { HeadlessCommand } from '../../../src/sdk/tickProtocol';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import { prepareHeadlessRuntime } from '../../../src/shards/nine-dragon-stack/runtime/headless';
import { JIAN_STEP } from '../../../src/shards/nine-dragon-stack/runtime/jian';
import { GRAPPLE_AIM, GRAPPLE_LOCK, GRAPPLE_STEP } from '../../../src/shards/nine-dragon-stack/runtime/grapple';

let rapier: Rapier, plan: HeadlessRuntimePlan;
beforeAll(async () => {
  rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  plan = await prepareHeadlessRuntime({ shard: source, assets: new Map(), rapier });
});
interface Tape { commands: readonly HeadlessCommand[] }
const boot = (tape: Tape): SimHost => {
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  plan.install(host, { restoring: false, commands: () => tape.commands, emit: () => { throw new Error('Nine Dragon emits no gameplay effect'); } });
  return host;
};
const restore = (saved: string, tape: Tape): SimHost => {
  const decoded = decodeSimSnapshot(saved);
  return restoreSimHost(plan.level, { ...plan.ports, rapier }, decoded, fresh => {
    plan.install(fresh, { restoring: true, snapshot: decoded, commands: () => tape.commands, emit: () => { throw new Error('Nine Dragon emits no gameplay effect'); } });
  });
};
/** The tape: stroll Lantern Square, tapping the Jian on a rhythm that chains its combo and lets it lapse. */
function command(tick: number): HeadlessCommand {
  const attack = tick % 90 === 10 || tick % 90 === 22 || tick % 90 === 34;
  return { kind: 'player', moveX: Math.sin(tick / 50) * 0.5, moveZ: Math.cos(tick / 70) * 0.5, yaw: tick / 200, ...(attack ? { attack: { targetId: 'none' } } : {}) };
}
function run(host: SimHost, tape: { commands: readonly HeadlessCommand[] }, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    const c = command(host.state.tick); tape.commands = [c];
    host.step(c.kind === 'player' ? { moveX: c.moveX, moveZ: c.moveZ, yaw: c.yaw, ...(c.attack === undefined ? {} : { attack: c.attack }) } : undefined);
  }
}
interface JianSaved { swings: number; hits: number; clock: { move: number | null } }
const jianState = (host: SimHost): JianSaved => {
  const adapter = snapshotSimHost(host).adapters.find(row => row.id === JIAN_STEP);
  if (typeof adapter?.state !== 'string') throw new Error('missing Jian continuation');
  return JSON.parse(adapter.state) as JianSaved;
};

it('imports in plain Node under the renderer-denying loader, with no DOM', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "const m = await import('./src/shards/nine-dragon-stack/runtime/headless.ts'); if (typeof m.prepareHeadlessRuntime !== 'function') throw new Error('no factory'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});

it('stands the player on Lantern Square\'s baked slab at the declared spawn, +125 m up, and keeps it there', () => {
  const tape: Tape = { commands: [] }, host = boot(tape);
  try {
    run(host, tape, 600);
    const p = host.player.position;
    expect(p.y).toBeGreaterThan(source.spawn.y - 0.5); expect(p.y).toBeLessThan(source.spawn.y + 0.5);
    expect(Math.hypot(p.x - source.spawn.x, p.z - source.spawn.z)).toBeLessThan(40);
  } finally { host.dispose(); }
});

it('swings the Jian\'s shipping combo from tick commands on the swept melee clock, and restores mid-swing byte-exactly', () => {
  const tape: Tape = { commands: [] }, host = boot(tape);
  let restored: SimHost | undefined;
  try {
    run(host, tape, 100);
    // three taps 12 ticks apart chain slash → backhand → finisher (the one-deep queue), then the combo gap lapses
    expect(jianState(host)).toMatchObject({ swings: 3, hits: 3 });
    run(host, tape, 17); // tick 117: mid-swing of the next round's first slash
    const saved = serializeSimSnapshot(snapshotSimHost(host)), copy: Tape = { commands: [] };
    expect(jianState(host).clock.move).not.toBeNull();
    // one string round trip of the checkpoint; the continuations compared without re-serialising (DEPLOY.md, ci-green)
    restored = restore(saved, copy);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    run(host, tape, 400); run(restored, copy, 400);
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    // five full rounds of three: the combo restarts at slash each round (each active window fires the row's contact once)
    expect(jianState(host)).toMatchObject({ swings: 18, hits: 18 });
  } finally { host.dispose(); restored?.dispose(); }
});

it('charges and releases the Jian\'s heavy from the HEAVY hold the tick commands carry, on the same clock', () => {
  const tape: Tape = { commands: [] }, host = boot(tape);
  try {
    // two seconds held (past the heavy's charge), then let go: the release swings the heavy, one swing, its contact once
    for (let i = 0; i < 150; i++) {
      const c: HeadlessCommand = { kind: 'player', moveX: 0, moveZ: 0, yaw: 0, ...(i < 120 ? { heavy: {} } : {}) };
      tape.commands = [c]; host.step({ moveX: 0, moveZ: 0, yaw: 0 });
    }
    expect(jianState(host)).toMatchObject({ swings: 1, hits: 1 });
  } finally { host.dispose(); }
});

it('proves the four portal-link entries on the baked world: 92 deck lanes and eight bound transfers through the square', () => {
  const tape: Tape = { commands: [] }, host = boot(tape);
  try {
    run(host, tape, 1); // the world's first step builds the query pipeline the capsules ask
    const proof = plan.proveEntries?.(host);
    expect(proof).toMatchObject({ lanes: 92, portalTransfers: 8 });
    expect(proof?.steps).toBeGreaterThan(0);
  } finally { host.dispose(); }
});

interface GrappleSaved { sim: { phase: string }; last: { x: number; y: number; z: number }; guard: readonly number[] }
const grappleState = (host: SimHost): GrappleSaved => {
  const adapter = snapshotSimHost(host).adapters.find(row => row.id === GRAPPLE_STEP);
  if (typeof adapter?.state !== 'string') throw new Error('missing Fei Zhua continuation');
  return JSON.parse(adapter.state) as GrappleSaved;
};
/** Whether the Well's safety cap stands: its baked colliders, enabled, on this host. */
const capStands = (host: SimHost): boolean => {
  const { guard } = grappleState(host);
  expect(guard.length).toBeGreaterThan(0);
  return guard.every(handle => host.physics.world.getCollider(handle).isEnabled());
};
/** One leg of tick commands: `ticks` at world move (x, z) facing `yaw`; the first tick may JUMP, or aim (pitch) and LOCK. */
interface Leg { ticks: number; x?: number; z?: number; yaw: number; press?: 'jump' | { pitch: number } }
function drive(host: SimHost, tape: Tape, legs: readonly Leg[]): void {
  for (const { ticks, x = 0, z = 0, yaw, press } of legs) for (let i = 0; i < ticks; i++) {
    const jump = i === 0 && press === 'jump' ? { jump: true as const } : {}, player: HeadlessCommand = { kind: 'player', moveX: x, moveZ: z, yaw, ...jump };
    tape.commands = i === 0 && typeof press === 'object' ? [player, { kind: 'script', actorId: GRAPPLE_AIM, value: press.pitch }, { kind: 'script', actorId: GRAPPLE_LOCK, value: 1 }] : [player];
    host.step({ moveX: x, moveZ: z, yaw, ...jump });
  }
}
/** Step until the grapple reaches `phase`, then `more` ticks into it. */
function into(host: SimHost, tape: Tape, yaw: number, phase: string, more: number): void {
  for (let i = 0; i < 90 && grappleState(host).sim.phase !== phase; i++) drive(host, tape, [{ ticks: 1, yaw }]);
  drive(host, tape, [{ ticks: more, yaw }]);
  expect(grappleState(host).sim.phase).toBe(phase);
}
/** One checkpoint mid-flight: a string round trip into a fresh host, then both run on to the end, compared. */
function restoresMidFlight(host: SimHost, tape: Tape, yaw: number, ticks: number, check: (restored: SimHost) => void = () => undefined): SimHost {
  const copy: Tape = { commands: [] }, restored = restore(serializeSimSnapshot(snapshotSimHost(host)), copy);
  expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
  check(restored);
  drive(host, tape, [{ ticks, yaw }]); drive(restored, copy, [{ ticks, yaw }]);
  expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
  return restored;
}

it('fires the Fei Zhua from tick commands (aim, LOCK, JUMP) onto the east tower\'s ledge from the spawn, restoring mid-zip byte-exactly', () => {
  // the spawn is the square's arrival; the hook on the east tower front, 27.4 m off at heading -1.474, 0.26 up
  const yaw = -1.474, tape: Tape = { commands: [] }, host = boot(tape);
  let restored: SimHost | undefined;
  try {
    drive(host, tape, [{ ticks: 30, yaw }, { ticks: 1, yaw, press: { pitch: 0.26 } }, { ticks: 1, yaw, press: 'jump' }]);
    expect(grappleState(host).sim.phase).toBe('fire');
    into(host, tape, yaw, 'zip', 6);
    // no lift: the ledge is no Well crossing, so the cap stands throughout
    expect(capStands(host)).toBe(true);
    restored = restoresMidFlight(host, tape, yaw, 150);
    const end = grappleState(host);
    expect(end.sim.phase).toBe('idle');
    expect(end.last.y).toBeGreaterThan(source.spawn.y + 2);
    expect(host.player.position.x).toBeGreaterThan(20);
  } finally { host.dispose(); restored?.dispose(); }
});

it('crosses the Well from its south rim: the lifting zip opens the safety cap\'s colliders in flight, restores mid-crossing with the cap open, and closes it on the settle', () => {
  // over the square's west balustrade onto the rim (the witness's route), then the crossing's hook at heading 0.1495, 0.1632 down
  const yaw = 0.1495, tape: Tape = { commands: [] }, host = boot(tape);
  let restored: SimHost | undefined;
  try {
    drive(host, tape, [{ ticks: 10, yaw }, { ticks: 72, z: 1, yaw }, { ticks: 20, x: -1, yaw }, { ticks: 60, x: -1, yaw, press: 'jump' }, { ticks: 30, yaw }]);
    expect(host.player.position.z).toBeGreaterThan(11.2); expect(host.player.position.x).toBeLessThan(0);
    expect(capStands(host)).toBe(true);
    drive(host, tape, [{ ticks: 1, yaw, press: { pitch: -0.1632 } }, { ticks: 1, yaw, press: 'jump' }]);
    into(host, tape, yaw, 'zip', 20);
    expect(capStands(host)).toBe(false);
    restored = restoresMidFlight(host, tape, yaw, 180, fresh => { expect(capStands(fresh)).toBe(false); });
    expect(capStands(host)).toBe(true); expect(capStands(restored)).toBe(true);
    expect(grappleState(host).sim.phase).toBe('idle');
    // on a crossing's deck north over the Well, below the square's datum
    const p = host.player.position;
    expect(p.z).toBeLessThan(-15); expect(p.y).toBeLessThan(source.spawn.y - 3);
  } finally { host.dispose(); restored?.dispose(); }
});
