// oxlint-disable-next-line import/no-nodejs-modules -- Native admission compiles its committed AssemblyScript fixture.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures use real immutable SHA-256 identities.
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { liftShard } from './fixtures/socket-lift/shard';
import { loadRapier } from '../src/engine/physics/rapier';
import { createShardfileSim, numericScriptEntityId } from '../src/game/shardfile/simulation';
import { proveShardfileEntries } from '../src/game/shardfile/socketLiftProof';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { parseShardfile } from '../src/game/shardfile/schema';
import { HeadlessSimulation } from '../src/sdk/headless';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
let compiled = new Uint8Array();
beforeAll(async () => { compiled = Uint8Array.from(await compileScript(readFileSync(new URL('fixtures/socket-lift/ride.as', import.meta.url), 'utf8'), { maximumPages: 2 })); });
describe('compiled socket lift admission through the authoritative factory', () => {
  it('proves three ordinary entries and the real lift through one shared script host', async () => {
    const hash = digest(compiled), assets = new Map([[hash, compiled]]), shard = validateShardfileAssets(liftShard(compiled, hash), assets, digest);
    const rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()), sim = createShardfileSim(shard, assets, { rapier });
    try {
      const before = sim.host.physics.world.bodies.len();
      expect(proveShardfileEntries(shard, sim, assets, { rapier })).toMatchObject({ lanes: 92, liftRides: 2, liftCalls: 2 });
      expect(sim.host.physics.world.bodies.len()).toBe(before);
      expect(sim.lane?.host.checkpoint().modules).toHaveLength(1);
    } finally { sim.dispose(); }
  });
  it('runs that same ride in the SDK isolate instead of the obsolete flat edge proxy', async () => {
    const hash = digest(compiled), shard = liftShard(compiled, hash), sim = await HeadlessSimulation.create(shard, new Map([[hash, compiled]]), undefined, { deadline: 'advisory' });
    try { await sim.step(); expect(await sim.finish()).toMatchObject({ lanes: 92, ticks: 1, liftRides: 2, liftCalls: 2 }); }
    finally { await sim.dispose(); }
  });
  it('refuses mover aliases and aggregate entity underbudget before registering its lane', async () => {
    const hash = digest(compiled), assets = new Map([[hash, compiled]]), shard = liftShard(compiled, hash);
    const rapier = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
    expect(() => createShardfileSim({ ...shard, serverBudget: { ...shard.serverBudget, entities: 2 } }, assets, { rapier })).toThrow('Aggregate script entity allowance');
    const colliding = structuredClone(shard), deck = colliding.movers[0]; if (deck === undefined) throw new Error('Missing lift fixture');
    deck.entity = numericScriptEntityId('actor.player');
    expect(() => createShardfileSim(colliding, assets, { rapier })).toThrow('Mover script alias collision');
  });
  it('requires the whole water exclusion even for a below-road sea', () => {
    const hash = digest(compiled), assets = new Map([[hash, compiled]]), shard = liftShard(compiled, hash);
    const wet = { ...shard, water: [{ id: 'sea', kind: 'sea', level: -1, waves: false }] };
    expect(() => validateShardfileAssets(wet, assets, digest)).toThrow('entryway footprint must be dry');
    expect(validateShardfileAssets({ ...wet, water: [{ ...wet.water[0], dryEntries: ['north'] }] }, assets, digest).entryways[0]?.kind).toBe('socketLift');
  });
  it('refuses missing links and reusing transient lift memory as numeric gameplay state', () => {
    const shard = liftShard(compiled, digest(compiled));
    expect(() => parseShardfile({ ...shard, movers: shard.movers.slice(0, 1) })).toThrow('shardfile semantic rules');
    expect(() => parseShardfile({ ...shard, sim: { ...shard.sim, bindings: [{ module: digest(compiled), entity: 7, actorId: null, kind: 'server' }] } })).toThrow('shardfile semantic rules');
  });
});
