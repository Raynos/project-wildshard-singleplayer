// oxlint-disable-next-line import/no-nodejs-modules -- The native oracle uses shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { GrappleModeSchema } from '../../../src/format/modes';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { installNineGrapple, GRAPPLE_STEP, type GrappleInput } from '../../../src/shards/nine-dragon-stack/runtime/grapple';
import { installNineGrapple as legacyGrapple } from '../../../src/shards/nine-dragon-stack-legacy/runtime/grapple';
import { prepareHeadlessRuntime } from '../../../src/shards/nine-dragon-stack/runtime/headless';
import source from '../../../src/shards/nine-dragon-stack/shard.config';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level: SimLevel = { version: SIM_API_VERSION, id: 'grapple.rows', seed: 9, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0.1, z: 0 }, yaw: 0, speed: 5 }, entities: [], quests: [],
  weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2,
    cooldown: 0.3, range: 1, damage: 0, tags: [] } };
const mode = () => {
  const found = source.modes?.grapple?.find(row => row.id === 'grapple');
  if (found === undefined) throw new Error('Missing declared grapple');
  return found;
};
const hooks = [new Vector3(0, 1.68, -10)];
const continuation = (host: SimHost): string => {
  const state = snapshotSimHost(host).adapters.find(row => row.id === GRAPPLE_STEP)?.state;
  if (typeof state !== 'string') throw new Error('Missing native grapple continuation');
  return state;
};

it('preserves the frozen native grapple clock and exact restored flight suffix with the admitted mode', () => {
  const before = createSimHost(level, { rapier }), after = createSimHost(level, { rapier });
  let copy: SimHost | undefined, tick = 0;
  const input = (into: GrappleInput): void => { into.lock = tick % 120 === 1; into.jump = tick % 120 === 2; into.pitch = 0; };
  try {
    const old = legacyGrapple(before, hooks, [], input), current = installNineGrapple(after, mode(), hooks, [], input);
    const phases = new Set<string>();
    for (tick = 1; tick <= 800; tick++) {
      before.step(); after.step(); copy?.step();
      phases.add(current.sim.phase);
      expect(continuation(after), `tick ${String(tick)}`).toBe(continuation(before));
      expect(current.sim.snapshot()).toEqual(old.sim.snapshot());
      if (copy !== undefined) expect(continuation(copy)).toBe(continuation(before));
      if (tick === 5) {
        expect(current.sim.target).not.toBeNull();
        expect(current.sim.phase).toBe('fire');
        const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(after)));
        copy = restoreSimHost(level, { rapier }, saved, fresh => { installNineGrapple(fresh, mode(), hooks, [], input); });
        expect(continuation(copy)).toBe(continuation(after));
      }
    }
    expect([...phases]).toEqual(expect.arrayContaining(['fire', 'bite', 'zip', 'vault', 'settle']));
  } finally { before.dispose(); after.dispose(); copy?.dispose(); }
});

it('uses the admitted range in the actual hook selection rather than a hidden module-global profile', () => {
  const near = v.parse(GrappleModeSchema, { ...mode(), maxRange: 5 });
  const normalHost = createSimHost(level, { rapier }), nearHost = createSimHost(level, { rapier });
  const lock = (into: GrappleInput): void => { into.lock = true; into.jump = false; into.pitch = 0; };
  try {
    const normal = installNineGrapple(normalHost, mode(), hooks, [], lock), short = installNineGrapple(nearHost, near, hooks, [], lock);
    normalHost.step(); nearHost.step();
    expect(normal.sim.target?.hook.toArray()).toEqual(hooks[0]?.toArray());
    expect(normal.sim.snapshot().armedMiss).toBe(false);
    expect(short.sim.target).toBeNull();
    expect(short.sim.snapshot().armedMiss).toBe(true);
  } finally { normalHost.dispose(); nearHost.dispose(); }
});

it('refuses an omitted declared grapple before constructing a native plan', () => {
  const { modes: _modes, ...withoutMode } = source;
  expect(() => prepareHeadlessRuntime({ shard: withoutMode, assets: new Map(), rapier }))
    .toThrow('declares its grapple mode');
});
