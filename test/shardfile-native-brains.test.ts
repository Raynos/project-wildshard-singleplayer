import { beforeAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the committed native Rapier binary through the complete factory.
import { readFile } from 'node:fs/promises';
import { emptyShardfile } from '@wildshard/sdk/author';
import { loadRapier } from '../src/engine/physics/rapier';
import type { SimHost } from '../src/engine/sim';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { createShardfileSim, bindShardfileSim } from '../src/game/shardfile/simulation';
import { parseShardfile } from '../src/game/shardfile/schema';
import type { DeclaredBrainPorts } from '../src/game/shardfile/brainRuntime';
import { CRAB_BRAIN, SAILOR_BRAIN, MONKEY_BRAIN } from '../src/shards/driftwood-isle/data/brains';
import template from '../src/shards/_template/shard.config';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { const bytes = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(bytes).buffer); });
function source() {
  const s = emptyShardfile({ slug: 'native-brains', name: 'Native brains', author: 'Test', revision: 1, seed: 435 });
  const pursue = template.creatures.brains[0]; if (pursue?.kind !== 'pursue') throw new Error('Missing pursuit fixture');
  s.rows.species = template.rows.species;
  s.creatures.brains = [pursue, { ...CRAB_BRAIN }, { ...SAILOR_BRAIN }, { ...MONKEY_BRAIN }];
  s.creatures.spawns = s.creatures.brains.map((brain, index) => ({ id: `actor.${index}`, species: 'boar', variant: 'greyback', brain: brain.id, strike: null, seed: index, scale: 1, at: [index * 4, 0, 4], yaw: 0 }));
  return parseShardfile(s);
}
function recipes(trace: string[]): DeclaredBrainPorts {
  const common = (host: SimHost) => ({ calm: false, player: host.player.position, rng: host.rng.stream('ai'),
    herd: null, sound: (cue: string) => { trace.push(cue); }, claim: () => true, mayAttack: () => true,
    steer: (actor: AnimalSim, yaw: number, speed: number, turn: number) => { actor.setMotion(yaw, speed, turn); }, confine: () => undefined });
  const body = (actor: AnimalSim) => () => { trace.push(`body.${actor.entityId}`); };
  return {
    skirmisher: (actor, host) => ({ observe: dt => ({ ...common(host), dt }), body: body(actor) }),
    guardian: (actor, host) => ({ observe: dt => ({ ...common(host), dt, world: {}, heightAt: () => 0, reach: () => true }), body: body(actor) }),
    perchHunter: (actor, host) => ({ observe: dt => ({ ...common(host), dt, attackRandom: host.rng.stream('ai'), pickPerch: () => -1, setPerch: () => undefined }), body: body(actor) }),
  };
}
it('admits native policy defaults and refuses unknown families, invalid cadence and undeclared custom modules', () => {
  const s = source(), { thinkDivisor: _cadence, ...crab } = CRAB_BRAIN;
  const parsed = parseShardfile({ ...s, creatures: { brains: [crab], spawns: [] } });
  expect(parsed.creatures.brains[0]?.thinkDivisor).toBe(6);
  for (const invalid of [{ ...crab, thinkDivisor: 7 }, { ...crab, kind: 'invented' }, { ...crab, runtime: 'author.ts' },
    { id: 'script', kind: 'script', module: 'a'.repeat(64), thinkDivisor: 6, maxSpeed: 3, maxStrafe: 1, maxTurnRate: 6, parameters: [], strikes: [] }]) {
    expect(() => parseShardfile({ ...s, creatures: { brains: [invalid], spawns: [] } })).toThrow();
  }
});
it('requires native recipes and installs the mixed policies through the real full factory', () => {
  const s = source(), assets = new Map<string, Uint8Array>(), trace: string[] = [];
  expect(() => createShardfileSim(s, assets, { rapier })).toThrow('Missing native brain port');
  const sim = createShardfileSim(s, assets, { rapier, brains: recipes(trace) });
  try {
    expect(trace).toEqual([]);
    for (let tick = 0; tick < 12; tick++) sim.host.step();
    for (const id of ['actor.1', 'actor.2', 'actor.3']) expect(trace.filter(row => row === `body.${id}`)).toHaveLength(12);
    expect(sim.host.entities.get('actor.0')?.desiredSpeed).toBeGreaterThan(0);
    expect(sim.host.entities.get('actor.1')?.mem['init']).toBe(1);
    expect(sim.host.adapters.has('brain.actor.3')).toBe(true);
  } finally { sim.dispose(); }
});
it('rebinds native policies on restore without replay and keeps the complete factory suffix identical', () => {
  const s = source(), assets = new Map<string, Uint8Array>(), original: string[] = [], suffix: string[] = [];
  const sim = createShardfileSim(s, assets, { rapier, brains: recipes(original) });
  let restored: SimHost | undefined;
  try {
    for (let tick = 0; tick < 300; tick++) sim.host.step();
    restored = restoreSimHost(sim.host.level, { rapier }, snapshotSimHost(sim.host), host => {
      bindShardfileSim(host, s, assets, { rapier, brains: recipes(suffix), restoring: true });
    });
    expect(suffix).toEqual([]); original.length = 0;
    for (let tick = 0; tick < 1000; tick++) { sim.host.step(); restored.step(); }
    expect(suffix).toEqual(original); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(sim.host));
  } finally { sim.dispose(); restored?.dispose(); }
});
