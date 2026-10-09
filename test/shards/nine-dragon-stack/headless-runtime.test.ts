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
