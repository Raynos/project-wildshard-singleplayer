import { beforeAll, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed binary without a Vite wasm closure dependency.
import { readFile } from 'node:fs/promises';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import type { PlatformBrainSpec, PlatformSpawn } from '../src/engine/ai/platform';
import { installDeclaredBrains, type DeclaredBrainPorts } from '../src/game/shardfile/brainRuntime';
import { parseSkirmisher, parseGuardian, parsePerchHunter } from '../src/game/shardfile/brains';
import { CRAB_BRAIN, SAILOR_BRAIN, MONKEY_BRAIN } from '../src/shards/driftwood-isle/data/brains';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { const bytes = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(bytes).buffer); });
const pursue: PlatformBrainSpec = { id: 'brain.pursue', kind: 'pursue', awareRadius: 9, leashRadius: 18, speed: 1, returnSpeed: 1,
  stopDistance: 1, turnRate: 4, thinkDivisor: 6, attackCooldownTicks: 60, wanderRadius: 2, wanderEveryTicks: 120 };
const policies = [pursue, parseSkirmisher(CRAB_BRAIN), parseGuardian(SAILOR_BRAIN), parsePerchHunter(MONKEY_BRAIN)];
const ids = ['pursue', 'crab', 'sailor', 'monkey'];
const rows: PlatformSpawn[] = policies.map((policy, index) => ({ id: ids[index] ?? 'missing', species: 'boar', variant: 'boar', brain: policy.id, strike: null, seed: index, scale: 1, at: [index * 4, 0, 4], yaw: 0 }));
const base = SIM_LEVEL.entities[0];
if (base === undefined) throw new Error('Missing fixture species');
const level = { ...SIM_LEVEL, entities: rows.map(row => ({ ...base, id: row.id, seed: row.seed, at: { x: row.at[0], y: row.at[1], z: row.at[2] } })) };
function recipes(host: SimHost, trace: string[]): DeclaredBrainPorts {
  const common = { calm: false, player: host.player.position, rng: host.rng.stream('ai'), sound: (cue: string) => { trace.push(cue); },
    claim: () => true, mayAttack: () => true, herd: null,
    steer: (actor: Parameters<NonNullable<DeclaredBrainPorts['skirmisher']>>[0], yaw: number, speed: number, turn: number) => { actor.setMotion(yaw, speed, turn); }, confine: () => undefined };
  const body = (id: string) => () => { trace.push(`body.${id}`); };
  return { skirmisher: actor => ({ observe: dt => ({ ...common, dt }), body: body(actor.entityId) }),
    guardian: actor => ({ observe: dt => ({ ...common, dt, world: {}, heightAt: () => 0, reach: () => true }), body: body(actor.entityId) }),
    perchHunter: actor => ({ observe: dt => ({ ...common, dt, attackRandom: host.rng.stream('ai'), pickPerch: () => -1, setPerch: () => undefined }), body: body(actor.entityId) }) };
}
describe('mixed declared native brain dispatch', () => {
  it('keeps pursue and runs each native body once per tick with a six-tick decision cadence', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      const installed = installDeclaredBrains(host, rows, policies, recipes(host, trace));
      expect(installed.size).toBe(4); expect(trace).toEqual([]);
      for (let tick = 0; tick < 12; tick++) host.step();
      for (const id of ids.slice(1)) expect(trace.filter(value => value === `body.${id}`)).toHaveLength(12);
      expect(host.entities.get('crab')?.mem['init']).toBe(1);
      expect(host.entities.get('monkey')?.mem['perch']).toBe(-1);
      expect(host.entities.get('pursue')?.desiredSpeed).toBeGreaterThan(0);
    } finally { host.dispose(); }
  });
  it('refuses missing actor/native ports or invalid declarations before registering any callback', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      const ports = recipes(host, trace);
      const skirmisher = ports.skirmisher;
      if (skirmisher === undefined) throw new Error('Missing fixture port');
      expect(() => installDeclaredBrains(host, rows, policies, { skirmisher })).toThrow('port');
      expect(() => installDeclaredBrains(host, rows.map(row => ({ ...row, id: 'missing' })), policies, ports)).toThrow();
      expect(() => installDeclaredBrains(host, rows, [...policies, { ...parseGuardian(SAILOR_BRAIN), id: 'invalid', speed: 16 }], ports)).toThrow();
      expect(host.adapters.size).toBe(0); host.step(); expect(trace).toEqual([]);
    } finally { host.dispose(); }
  });
  it('rolls back registrations if an existing callback collides after preflight', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      host.onStep('brain.sailor', () => { trace.push('existing'); });
      expect(() => installDeclaredBrains(host, rows, policies, recipes(host, trace))).toThrow('registration');
      expect(host.adapters.size).toBe(0); host.step(); expect(trace).toEqual(['existing']);
    } finally { host.dispose(); }
  });
  it('reinstalls policy fences without body/think execution and restores an exact mixed 10,000-tick suffix', () => {
    const host = createSimHost(level, { rapier }), original: string[] = [], suffix: string[] = [];
    let restored: SimHost | undefined;
    try {
      installDeclaredBrains(host, rows, policies, recipes(host, original));
      for (let tick = 0; tick < 300; tick++) host.step();
      restored = restoreSimHost(level, { rapier }, snapshotSimHost(host), fresh => { installDeclaredBrains(fresh, rows, policies, recipes(fresh, suffix)); });
      expect(suffix).toEqual([]); original.length = 0;
      for (let tick = 0; tick < 10000; tick++) { host.step(); restored.step(); }
      expect(suffix).toEqual(original); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    } finally { host.dispose(); restored?.dispose(); }
  });
});
