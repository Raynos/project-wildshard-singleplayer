// oxlint-disable-next-line import/no-nodejs-modules -- Use shipped native physics and admitted immutable template assets.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { SaveStore } from '../src/engine/saves/store';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, serializeSimSnapshot, serializeSimSnapshotSteps, finishSimSteps } from '../src/engine/sim/snapshot';
import * as simulation from '../src/game/shardfile/simulation';
import { GridRegionDurability } from '../src/game/grid/durability';
import source from '../src/shards/_template/shard.config';
import { MemoryStorage } from './setup';

// rt3-freeze: a template cell's 5 s autosave was one 1.0–1.6 s task on the phone. The staged form must pause between
// its encode stages, write nothing until its last stage, and store exactly what the one-call checkpoint stores.
it('stages a regional autosave across pauses and writes the one-call checkpoint bytes only at the end', async () => {
  const assets = new Map(source.files.map((file) => [file.hash, readFileSync(`src/shards/_template/assets/${file.hash}`)]));
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const staged = new MemoryStorage();
  const region = new GridRegionDurability(new SaveStore({ local: staged, session: null }), { id: 'template-3', shard: source.identity.slug }, source, []);
  const sim = simulation.createShardfileSim(source, assets, { rapier, quest: region.quest });
  try {
    const basis = sim.host.physics.snapshot();
    region.bind(sim.host, sim.colliders); region.setPhysicsBasis(basis);
    sim.host.step();
    const snapshot = snapshotSimHost(sim.host);
    expect(finishSimSteps(serializeSimSnapshotSteps(snapshot, basis))).toBe(serializeSimSnapshot(snapshot, basis));
    const key = 'wildshard.save.v2.template-3', region0 = (): string | undefined => {
      const doc = v.parse(v.looseObject({ keys: v.looseObject({ 'platform.region': v.optional(v.looseObject({ data: v.nullable(v.looseObject({ snapshot: v.nullable(v.string()) })) })) }) }),
        JSON.parse(staged.getItem(key) ?? '{"keys":{}}'));
      return doc.keys['platform.region']?.data?.snapshot ?? undefined;
    };
    const steps = region.checkpointSteps(snapshot);
    let pauses = 0, step = steps.next();
    while (step.done !== true) {
      expect(region0()).toBeUndefined(); // nothing is durable until the last stage
      pauses++; step = steps.next();
    }
    expect(step.value).toBe(true);
    expect(pauses).toBeGreaterThanOrEqual(3);
    const wire = serializeSimSnapshot(snapshot, basis);
    expect(region0()).toBe(wire);
    expect(region.checkpoint(snapshot)).toBe(true); // the one-call form stores the same continuation
    expect(region0()).toBe(wire);
    // A superseded job (generator closed early) never writes.
    const abandoned = region.checkpointSteps(snapshot); abandoned.next(); abandoned.return(false);
    expect(abandoned.next().done).toBe(true);
  } finally { sim.dispose(); }
});
