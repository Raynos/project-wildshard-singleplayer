// oxlint-disable-next-line import/no-nodejs-modules -- The renderer-denying native witness asserts the actual captured world.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the admitted in-repository native terrain and navmesh.
import { readFileSync } from 'node:fs';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { NALATI_NAVMESH_ASSET, NALATI_TERRAIN_ASSET, prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { canonicalSimDigest } from '../../fake/simState';

/** Gaps are gameplay requirements, not exemptions; a boot/replay proof cannot certify the whole shard. */
export const NALATI_WITNESS_GAPS = ['qyran', 'qara-and-night-roster', 'golden-king', 'storm-titan', 'taming', 'sabre-and-held-heavy', 'quests-and-gameplay-ledger', 'entryways'] as const;

/** Execute the shipping native installer and restore its complete codec continuation without a browser shim. */
export async function nalatiNativeWitness(replay: boolean): Promise<object> {
  assert.equal(typeof window, 'undefined'); assert.equal(typeof document, 'undefined');
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const assets = new Map([NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
  const plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
  const ports = { ...plan.ports, rapier };
  const effects = { commands: () => [], emit: (): never => { throw new Error('Partial native witness must not fabricate ledger ingress'); } };
  const first = createSimHost(plan.level, ports); let restored: SimHost | undefined;
  const step = (host: SimHost): void => { host.step({ moveX: 0.3 * Math.sin(host.state.tick / 90), moveZ: -1, yaw: 0 }); };
  try {
    plan.install(first, { restoring: false, ...effects });
    assert.deepEqual([...first.entities.keys()], nalatiBake().actors.map(actor => actor.id));
    const colliders = first.physics.world.colliders.len(), basis = first.physics.snapshot(), startZ = first.player.position.z;
    assert.ok(colliders >= nalatiBake().solids.length);
    for (let tick = 0; tick < 120; tick++) step(first);
    assert.ok(first.player.position.z < startZ);
    assert.ok([...first.entities.values()].every(actor => [actor.position.x, actor.position.y, actor.position.z].every(Number.isFinite)));
    const checkpoint = snapshotSimHost(first), checkpointHash = canonicalSimDigest(checkpoint);
    let suffixHash: string | undefined;
    if (replay) {
      const saved: SimSnapshot = decodeSimSnapshot(serializeSimSnapshot(checkpoint, basis), basis);
      assert.deepEqual(saved, checkpoint, 'Codec must preserve every native byte and adapter');
      restored = restoreSimHost(plan.level, ports, saved, fresh => {
        if (ports.heightAt !== undefined) fresh.setHeightQuery(ports.heightAt);
        plan.install(fresh, { restoring: true, snapshot: saved, ...effects });
      });
      assert.equal(canonicalSimDigest(snapshotSimHost(restored)), checkpointHash);
      for (let tick = 0; tick < 60; tick++) { step(first); step(restored); }
      suffixHash = canonicalSimDigest(snapshotSimHost(first));
      assert.equal(canonicalSimDigest(snapshotSimHost(restored)), suffixHash, 'Complete native suffix must match exactly');
    }
    return { entry: 'runtime/headless.ts', compatible: false, missing: NALATI_WITNESS_GAPS,
      headless: { status: 'partial', stage: 'gameplay-coverage', nativeBoot: true, actors: 35, colliders, ticksExecuted: first.state.tick, checkpointHash },
      ...(replay ? { replay: { status: 'partial', checkpointCaptured: true, codecByteExact: true, suffixTicksExecuted: 60, suffixHash, wholeShard: false } } : {}) };
  } finally {
    restored?.dispose(); first.dispose();
    assert.ok(Object.values(first.scope.census).every(count => count === 0));
    if (restored !== undefined) assert.ok(Object.values(restored.scope.census).every(count => count === 0));
  }
}
