// oxlint-disable-next-line import/no-nodejs-modules -- Read immutable admitted guest fixtures.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { snapshotSimHost, restoreSimHost } from '../src/engine/sim/snapshot';
import { loadRapier } from '../src/engine/physics/rapier';
import { installHeadlessMovers, verifiedMoverModules, type HeadlessMovers } from '../src/sdk/runtime/movers';
import { MOVERS as DRIFT } from '../src/shards/driftwood-isle/data/movers';
import { MOVERS as SKY } from '../src/shards/far-reach/data/movers';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const boat = DRIFT.find(row => row.id === 'driftwood.boat');
const winch = SKY.find(row => row.id === 'far.winch.bridge');
if (boat === undefined || winch === undefined) throw new Error('Missing admitted mover fixture');
const rows = [boat, winch];
const assets = new Map(rows.map(row => [row.module, Uint8Array.from(readFileSync(new URL(`../src/shards/${row === boat ? 'driftwood-isle' : 'far-reach'}/assets/${row.module}`, import.meta.url)))]));
const level = { ...SIM_LEVEL, entities: [] };
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });

it('detaches hash-checked modules and refuses missing or modified guest bytes before installation', async () => {
  const modules = await verifiedMoverModules(assets, rows);
  for (const [hash, bytes] of modules) { expect(bytes).toEqual(assets.get(hash)); expect(bytes).not.toBe(assets.get(hash)); }
  await expect(verifiedMoverModules(new Map(), rows)).rejects.toThrow('not admitted');
  await expect(verifiedMoverModules(new Map([[rows[0]?.module ?? '', Uint8Array.of(0)]]), [boat])).rejects.toThrow('hash mismatch');
});

it('continues the real moored boat and winch mid-motion with identical guest state and native handles', async () => {
  const modules = await verifiedMoverModules(assets, rows);
  const install = (host: SimHost, restoring: boolean) => installHeadlessMovers(host, rows, modules, {
    systemId: 'sdk.movers', restoring, permissions: () => new Map([[winch.id, 1]]),
  });
  const host = createSimHost(level, { rapier }); let fresh: SimHost | undefined;
  try {
    const original = install(host, false);
    expect(host.state.tick).toBe(0);
    original.runtime.command(winch.id, 1);
    for (let i = 0; i < 24; i++) host.step();
    original.runtime.command(winch.id, 3);
    const saved = snapshotSimHost(host), handles = original.runtime.snapshotBodies(), count = host.physics.world.bodies.len();
    let restored: HeadlessMovers | undefined;
    fresh = restoreSimHost(level, { rapier }, saved, sim => { restored = install(sim, true); expect(sim.physics.world.bodies.len()).toBe(0); });
    expect(restored?.runtime.snapshotBodies()).toEqual(handles);
    expect(fresh.physics.world.bodies.len()).toBe(count);
    expect(snapshotSimHost(fresh).adapters).toEqual(saved.adapters);
    for (let i = 0; i < 24; i++) { host.step(); fresh.step(); }
    expect(snapshotSimHost(fresh).adapters).toEqual(snapshotSimHost(host).adapters);
    expect(restored?.runtime.pose(boat.id)).toEqual(original.runtime.pose(boat.id));
    expect(restored?.runtime.pose(winch.id)).toEqual(original.runtime.pose(winch.id));
    expect(original.failures()).toBe(0); expect(restored?.failures()).toBe(0);
    for (const { handle } of handles) {
      expect(fresh.physics.world.getRigidBody(handle).translation()).toEqual(host.physics.world.getRigidBody(handle).translation());
    }
  } finally { fresh?.dispose(); host.dispose(); }
});
