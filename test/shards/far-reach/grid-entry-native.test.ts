// oxlint-disable-next-line import/no-nodejs-modules -- Native proof consumes the committed immutable islet module.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { createShardfileSim } from '../../../src/game/shardfile/simulation';
import { withoutRuntimeRows } from '../../../src/game/shardfile/hybridRows';
import { proveShardfileEntries } from '../../../src/game/shardfile/socketLiftProof';
import { validateShardfileAssets } from '../../../src/game/shardfile/validate';
import { contentHash } from '../../../src/sdk/project';
import source from '../../../src/shards/far-reach/shard.config';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

it('walks and rides all four authored Rising Islets, calls both stops and closes every road gate lane', async () => {
  const assets = new Map(source.files.map((file) => [file.hash, Uint8Array.from(readFileSync(`src/shards/far-reach/assets/${file.hash}`))])), shard = validateShardfileAssets(withoutRuntimeRows(source), assets, contentHash);
  const rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
  const sim = createShardfileSim(shard, assets, { rapier, ground: false });
  try {
    const before = [sim.host.physics.world.bodies.len(), sim.host.physics.world.colliders.len()];
    const proof = proveShardfileEntries(shard, sim, assets, { rapier, ground: false });
    expect(proof).toMatchObject({ lanes: 92, liftRides: 8, liftCalls: 8 });
    expect(proof.steps).toBeGreaterThan(0);
    expect([sim.host.physics.world.bodies.len(), sim.host.physics.world.colliders.len()]).toEqual(before);
    expect(sim.lane?.host.checkpoint().modules).toHaveLength(1);
  } finally { sim.dispose(); }
  expect(sim.host.scope.disposed).toBe(true);
  expect(sim.host.physics.world.bodies).toBeUndefined();
  expect(sim.host.physics.world.colliders).toBeUndefined();
}, 60_000); // Four complete native round trips and independent 23-lane road-gate probes, never a pose-only proof.
