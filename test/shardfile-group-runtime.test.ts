import { beforeAll, describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed Rapier binary, including in a clean export.
import { readFile } from 'node:fs/promises';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost, type SimHost } from '../src/engine/sim';
import { restoreSimHost, snapshotSimHost } from '../src/engine/sim/snapshot';
import { installDeclaredBrains } from '../src/game/shardfile/brainRuntime';
import { prepareDeclaredGroupBrains, type DeclaredGroupPorts } from '../src/game/shardfile/groupRuntime';
import { parseGroupBrain } from '../src/game/shardfile/groupBrains';
import { NALATI_PACK_BRAIN, NALATI_HERD_BRAIN } from '../src/shards/nalati-grasslands/data/brains';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { expectSameSimSnapshot } from './fake/simSnapshot';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(Uint8Array.from(await readFile('public/assets/physics/rapier.wasm')).buffer); });
const pursue = { id: 'brain.pursue', kind: 'pursue' as const, awareRadius: 9, leashRadius: 18, speed: 1, returnSpeed: 1,
  stopDistance: 1, turnRate: 4, thinkDivisor: 6, attackCooldownTicks: 60, wanderRadius: 2, wanderEveryTicks: 120 };
const groups = [parseGroupBrain({ ...NALATI_PACK_BRAIN, members: ['pack.0', 'pack.1'], home: [0, 4] }),
  parseGroupBrain({ ...NALATI_HERD_BRAIN, members: ['herd.0', 'herd.1'] })];
const rows = [...groups.flatMap(group => group.members.map(id => ({ id, brain: group.id }))), { id: 'pursue', brain: pursue.id }];
const base = SIM_LEVEL.entities[0];
if (base === undefined) throw new Error('Missing fixture animal');
const level = { ...SIM_LEVEL, entities: rows.map((row, i) => ({ ...base, id: row.id, seed: i, at: { x: i * 3, y: 0, z: 4 } })) };
function recipes(host: SimHost, trace: string[]): DeclaredGroupPorts {
  const shared = () => host.rng.stream('ai');
  const observations = { visibility: () => 1, hearing: () => 30, downwind: () => true,
    inBounds: () => true, normalY: () => 1, sharedRng: shared };
  const common = { t: 0, player: host.player.position, playerSpeed: 3, calm: false, rng: shared(),
    sound: (cue: string) => { trace.push(cue); }, claim: () => true,
    steer: (actor: Parameters<NonNullable<DeclaredGroupPorts['pack']>>[1][number], yaw: number, speed: number, turn: number) => { actor.setMotion(yaw, speed, turn); },
    pathYaw: () => 0 };
  return {
    pack: () => ({ ports: { ...observations, environment: () => ({ playerFwdX: 0, playerFwdZ: 1, playerMounted: false,
      playerHealth01: 1, grassHeightAt: () => 0 }), register: () => undefined,
      bite: actor => { trace.push(`bite.${actor.entityId}`); }, preyIdentity: () => 'prey.none', resolvePrey: () => null },
    observe: (actor, dt) => { trace.push(`${actor.entityId}.${dt === 0.1 ? 'think' : 'body'}`); return { ...common, dt }; }, confine: () => undefined }),
    herd: () => ({ ports: { ...observations, environment: () => ({ playerMounted: false, playerCrouched: false }),
      passThrough: () => undefined, chargeContact: () => { trace.push('charge'); }, scarePack: () => false,
      resolveActor: id => host.entities.get(id) ?? null },
    observe: (actor, dt) => { trace.push(`${actor.entityId}.${dt === 0.1 ? 'think' : 'body'}`); return { ...common, dt, hurt: () => undefined, confine: () => undefined }; } }),
  };
}
function pursuit(host: SimHost): void {
  installDeclaredBrains(host, [{ id: 'pursue', species: 'boar', variant: 'boar', brain: pursue.id, strike: null, seed: 4, scale: 1, at: [12, 0, 4], yaw: 0 }], [pursue]);
}
describe('declared group installation', () => {
  it('prepares without setup and composes ordered pack/herd callbacks with an individual pursuit', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      const ports = recipes(host, trace), before = snapshotSimHost(host);
      const prepared = prepareDeclaredGroupBrains(host, groups, rows, ports, [pursue.id]);
      expect(snapshotSimHost(host)).toEqual(before); expect(trace).toEqual([]); expect(host.hasStep(`group.${NALATI_PACK_BRAIN.id}`)).toBe(false);
      pursuit(host); prepared.install();
      expect(host.hasStep(`group.${NALATI_PACK_BRAIN.id}`)).toBe(true); expect(host.adapters.size).toBe(3);
      expect(() => prepared.install()).toThrow('already installed');
      for (let tick = 0; tick < 12; tick++) host.step();
      for (const row of rows.slice(0, 4)) {
        expect(trace.filter(value => value === `${row.id}.body`)).toHaveLength(12);
        expect(trace.filter(value => value === `${row.id}.think`)).toHaveLength(2);
      }
      host.dispose(); expect(host.hasStep(`group.${NALATI_PACK_BRAIN.id}`)).toBe(false);
    } finally { host.dispose(); }
  });
  it('refuses missing recipes, roster conflicts and existing callbacks before actor/RNG mutation', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      const ports = recipes(host, trace), pack = ports.pack;
      if (pack === undefined) throw new Error('Missing fixture pack');
      const before = snapshotSimHost(host);
      expect(() => prepareDeclaredGroupBrains(host, groups, rows, { pack })).toThrow('port');
      expect(() => prepareDeclaredGroupBrains(host, groups, rows, ports, [NALATI_PACK_BRAIN.id])).toThrow('roster');
      expect(() => prepareDeclaredGroupBrains(host, groups, rows, ports, [], ['herd.0'])).toThrow('roster');
      expect(() => prepareDeclaredGroupBrains(host, groups, [...rows].reverse(), ports)).toThrow('roster');
      expect(snapshotSimHost(host)).toEqual(before);
      host.onStep('brain.pack.0', () => { trace.push('existing'); });
      expect(() => prepareDeclaredGroupBrains(host, groups, rows, ports)).toThrow('installed');
      expect(snapshotSimHost(host)).toEqual(before); host.step(); expect(trace).toEqual(['existing']);
    } finally { host.dispose(); }
  });
  it('rechecks collisions added after preparation before setup draws', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      const prepared = prepareDeclaredGroupBrains(host, groups, rows, recipes(host, trace));
      const before = snapshotSimHost(host);
      host.onStep(`group.${NALATI_HERD_BRAIN.id}`, () => { trace.push('existing'); });
      expect(() => prepared.install()).toThrow('Installed');
      expect(snapshotSimHost(host)).toEqual(before); host.step(); expect(trace).toEqual(['existing']);
    } finally { host.dispose(); }
  });
  it('rolls back setup if a trusted recipe fails during initialization', () => {
    const host = createSimHost(level, { rapier }), trace: string[] = [];
    try {
      const ports = recipes(host, trace), herd = ports.herd;
      if (herd === undefined) throw new Error('Missing fixture herd');
      const prepared = prepareDeclaredGroupBrains(host, groups, rows, { ...ports, herd: (...args) => {
        const recipe = herd(...args); return { ...recipe, ports: { ...recipe.ports, sharedRng: () => { throw new Error('Unavailable native RNG'); } } };
      } });
      const before = snapshotSimHost(host), policy = [...prepared.policies.values()].map(value => value.snapshot());
      expect(() => prepared.install()).toThrow('Unavailable native RNG');
      expect(snapshotSimHost(host)).toEqual(before); expect([...prepared.policies.values()].map(value => value.snapshot())).toEqual(policy);
      expect(host.hasStep(`group.${NALATI_PACK_BRAIN.id}`)).toBe(false); host.step(); expect(trace).toEqual([]);
    } finally { host.dispose(); }
  });
  it('restores mixed controllers with zero setup/decision/body calls and an exact 10,000-tick suffix', () => {
    const host = createSimHost(level, { rapier }), original: string[] = [], suffix: string[] = [];
    let restored: SimHost | undefined;
    try {
      pursuit(host); prepareDeclaredGroupBrains(host, groups, rows, recipes(host, original), [pursue.id]).install();
      for (let tick = 0; tick < 301; tick++) host.step();
      restored = restoreSimHost(level, { rapier }, snapshotSimHost(host), fresh => {
        pursuit(fresh); const ports = recipes(fresh, suffix), before = fresh.rng.snapshot();
        prepareDeclaredGroupBrains(fresh, groups, rows, ports, [pursue.id]).install(true);
        expect(fresh.rng.snapshot()).toEqual(before);
      });
      expect(suffix).toEqual([]); original.length = 0;
      for (let tick = 0; tick < 10000; tick++) { host.step(); restored.step(); }
      expect(suffix).toEqual(original); expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(host));
    } finally { host.dispose(); restored?.dispose(); }
  });
});
