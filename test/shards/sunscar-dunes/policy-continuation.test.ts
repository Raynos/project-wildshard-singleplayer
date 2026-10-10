// oxlint-disable-next-line import/no-nodejs-modules -- Initialize the real native engine for continuation proofs.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Import policies in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost, type SimSpawn } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, decodeSimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import { canReach } from '../../../src/engine/ai/reach';
import { speciesBrains } from '../../../src/sdk/speciesBrains';
import type { HomeObservation, SpeciesPolicy } from '../../../src/game/shardfile/speciesBrains';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES } from '../../../src/shards/sunscar-dunes/data/brains';
import type { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { SIM_LEVEL } from '../../fixtures/sim-level/level';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level = { ...SIM_LEVEL, entities: [], quests: [], ground: { size: 2048, height: 0 } };
type Kind = 'skitterer' | 'matriarch';
function recipe(kind: Kind): SimSpawn {
  const base = SIM_LEVEL.entities[0];
  if (base === undefined) throw new Error('Missing native fixture recipe');
  return { ...base, id: `policy:${kind}`, at: { x: 0, y: 0, z: 1.6 },
    spec: { ...base.spec, kind: kind === 'skitterer' ? 'sandSkitterer' : 'duneMatriarch',
      ...(kind === 'matriarch' ? { flight: { altitude: 18, above: 'ground', climbRate: 7, diveRate: 20, lockRange: 60 } } : {}) } };
}
/** The skitterer's shipping policy is its admitted species script, the Matriarch's her phased-flyer row (SF27). */
function shipping(kind: Kind, actor: AnimalSim): SpeciesPolicy<HomeObservation> {
  const policy = speciesBrains(SIGNAL_SPECIES, SIGNAL_STRIKES, SIGNAL_MODULES).policy(kind === 'matriarch' ? 'duneMatriarch' : 'sandSkitterer', actor);
  if (policy === null) throw new Error(`Missing ${kind} policy`);
  return policy;
}
/** A policy's state name: the script's first slot (0 buried … 3 retreat) or the Matriarch's state. */
function stateOf(policy: SpeciesPolicy<HomeObservation>): string {
  const saved = policy.snapshot(), value: unknown = typeof saved === 'string' ? JSON.parse(saved) : null;
  if (typeof value !== 'object' || value === null) throw new Error('Expected policy object');
  const slots: unknown = Reflect.get(value, 'slots'), state: unknown = Reflect.get(value, 'state');
  return Array.isArray(slots) ? ['buried', 'burst', 'hunt', 'retreat'][Number(slots[0])] ?? 'unknown' : String(state);
}
function install(host: SimHost, kind: Kind): SpeciesPolicy<HomeObservation> {
  const actor = host.spawn(recipe(kind)), policy = shipping(kind, actor);
  const ports: HomeObservation = {
    dt: 1 / 60, t: 0, player: host.player.position, calm: false, phaseOffset: 0,
    reach: a => canReach(a, host.player.position, host.physics), claim: () => true,
    hurt: damage => { host.combat.hit({ source: actor.combatActor(), sourceTags: ['creature.test'], target: host.player.health,
      amount: damage, point: host.player.position, dir: actor.position, from: actor.position, moveId: 'policy.contact' }); },
    steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); },
    flight: { steer: (a, yaw, speed, altitude, turn) => { a.fly(yaw, speed, altitude, turn); } },
  };
  host.onStep('policy', dt => {
    ports.dt = dt; ports.t = host.clock.now;
    actor.mem['fight'] = 1; actor.mem['rise'] = 1;
    actor.mem['phase'] = host.clock.frame >= 480 ? 2 : host.clock.frame >= 240 ? 1 : 0;
    if (host.clock.frame % 3 === 0) policy.think(ports);
    policy.act(ports);
  }, { snapshot: () => policy.snapshot(), restore: value => { policy.restore(value); } });
  return policy;
}
it.each(['skitterer', 'matriarch'] as const)('restores %s clocks, native motion and pending contacts at every saved phase', kind => {
  const states = new Set<string>(); let pending = false;
  for (const checkpoint of [12, 75, 215, 330, 510, 570]) {
    const original = createSimHost(level, { rapier }), policy = install(original, kind);
    let restored: SimHost | undefined;
    try {
      for (let tick = 0; tick < checkpoint; tick++) original.step();
      const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(original)));
      restored = restoreSimHost(level, { rapier }, saved, fresh => { install(fresh, kind); });
      expectSameSimSnapshot(snapshotSimHost(restored), saved);
      for (let tick = 0; tick < 600; tick++) {
        original.step(); restored.step(); states.add(stateOf(policy));
        const state = policy.snapshot();
        if (typeof state === 'string' && (state.includes('"phase":"windup"') || state.includes('"phase":"active"'))) pending = true;
        expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(original));
      }
    } finally { restored?.dispose(); original.dispose(); }
  }
  expect(states.has(kind === 'skitterer' ? 'hunt' : 'grounded')).toBe(true); expect(pending).toBe(true);
});
it.each(['skitterer', 'matriarch'] as const)('refuses malformed %s policy state without mutation', kind => {
  const host = createSimHost(level, { rapier }), policy = install(host, kind);
  try {
    const saved = policy.snapshot();
    if (typeof saved !== 'string') throw new Error('Expected scalar continuation');
    const parsed: unknown = JSON.parse(saved);
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Expected policy object');
    for (const change of [{ extra: true }, { clock: -1 }, { actor: 'other' }, { strikes: {} }]) {
      expect(() => policy.restore(JSON.stringify({ ...parsed, ...change }))).toThrow(); expect(policy.snapshot()).toBe(saved);
    }
  } finally { host.dispose(); }
});
it('imports the three runtime species modules without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "for (const name of ['duneRay','strider','skitterer']) await import('./src/shards/sunscar-dunes/runtime/species/'+name+'.ts'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
