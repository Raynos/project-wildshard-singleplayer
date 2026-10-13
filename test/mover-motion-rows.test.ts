// oxlint-disable-next-line import/no-nodejs-modules -- Read the actual admitted lift driver used by both hosts.
import { readFileSync } from 'node:fs';
import { AnimationClip, Group, InterpolateDiscrete, VectorKeyframeTrack } from 'three';
import { beforeAll, expect, it } from 'vitest';
import { Mover } from '../src/sdk/movers';
import { parseMovers } from '../src/format/movers';
import { MOVER_DRIVER_MODULES } from '../src/format/moverMotion';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { installMoverFixture as installHeadlessMovers } from './fixtures/mover-installation';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const body = new Group(); body.name = 'fixture.lift';
const channel = new VectorKeyframeTrack('fixture.lift.position', [0, 2], [0, 0, 0, 4, 25, 6]);
const clip = new AnimationClip('rise', 2, [channel]);
const author = new Mover(body, { clip, trigger: { kind: 'interact', permission: 0 }, driver: { kind: 'winch', mode: 'ride', dwell: 6, gate: false } });
const authored = author.toMoverData({ id: 'fixture.lift', entity: 8020, kind: 'platform', at: { x: 0, y: 0, z: 0 }, euler: { x: 0, y: 0, z: 0 }, enabled: true,
  boxes: [{ x: 0, y: -1, z: 0, hx: 5, hy: 1, hz: 4, rot: { x: 0, y: 0, z: 0, w: 1 } }] });
const legacy = { id: authored.id, entity: authored.entity, kind: authored.kind, at: authored.at, euler: authored.euler, enabled: authored.enabled, boxes: authored.boxes,
  module: MOVER_DRIVER_MODULES.ride, input: [0, 0, 0, 4, 25, 6, 2, 0, 6] };
const modules = new Map([[MOVER_DRIVER_MODULES.ride, Uint8Array.from(readFileSync(new URL('../src/shards/far-reach/assets/f8f90ba2e03401910448a2af1e8b02420bc7b2e1003076bc6241d9cb0c688a22', import.meta.url)))]]);
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

it('reads the actual clip keys and refuses ambiguous, unrelated or independently edited executable data', () => {
  expect(authored.track?.position).toEqual([[0, 0, 0], [4, 25, 6]]);
  expect(parseMovers([authored])).toEqual([legacy]);
  expect(() => parseMovers([{ ...authored, input: [0, 0, 0, 4, 26, 6, 2, 0, 6] }])).toThrow('ABI disagree');
  expect(() => parseMovers([{ ...authored, module: MOVER_DRIVER_MODULES.hinge }])).toThrow('ABI disagree');
  const stepped = new AnimationClip('step', 2, [new VectorKeyframeTrack('fixture.lift.position', [0, 2], [0, 0, 0, 4, 25, 6], InterpolateDiscrete)]);
  expect(() => new Mover(body, { ...author.options, clip: stepped }).toMotionData()).toThrow('linearly');
  const unrelated = new AnimationClip('wrong', 2, [new VectorKeyframeTrack('another.position', [0, 2], [0, 0, 0, 4, 25, 6])]);
  expect(() => new Mover(body, { ...author.options, clip: unrelated }).toMotionData()).toThrow('own body');
  expect(() => parseMovers([{ ...authored, driver: undefined }])).toThrow();
});

it('replays and restores a real clip-authored lift with the exact shipping guest, fuel, pose, collider and continuation', () => {
  const level = { ...SIM_LEVEL, entities: [] }, oldHost = createSimHost(level, { rapier }), rowHost = createSimHost(level, { rapier });
  let restored: ReturnType<typeof createSimHost> | undefined;
  try {
    const old = installHeadlessMovers(oldHost, [legacy], modules, { systemId: 'fixture.movers', restoring: false });
    const current = installHeadlessMovers(rowHost, [authored], modules, { systemId: 'fixture.movers', restoring: false });
    for (let tick = 1; tick <= 500; tick++) {
      if ([1, 25, 50, 80, 175, 200, 245].includes(tick)) { old.runtime.command(legacy.id, 1); current.runtime.command(authored.id, 1); }
      oldHost.step(); rowHost.step();
      expect(current.runtime.pose(authored.id)).toEqual(old.runtime.pose(legacy.id));
      expect(snapshotSimHost(rowHost)).toEqual(snapshotSimHost(oldHost));
      if (tick === 100) {
        const saved = snapshotSimHost(rowHost);
        restored = restoreSimHost(level, { rapier }, saved, host => { installHeadlessMovers(host, [authored], modules, { systemId: 'fixture.movers', restoring: true }); });
        expect(snapshotSimHost(restored)).toEqual(saved);
      }
      if (tick > 100 && tick < 175 && restored !== undefined) { restored.step(); expect(snapshotSimHost(restored)).toEqual(snapshotSimHost(rowHost)); }
    }
    expect(old.failures()).toBe(0); expect(current.failures()).toBe(0);
  } finally { restored?.dispose(); rowHost.dispose(); oldHost.dispose(); }
});
