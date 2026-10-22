import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { WakeBossEncounter } from '@wildshard/game/boss/wake';
import { parseRoamingEncounter, NativeBossBindingSchema, WakeEncounterSchema } from '@wildshard/format/bossEncounter';
import * as v from 'valibot';
import { formatJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import roaming from '../src/shards/pine-hollow/data/bossEncounter.json' with { type: 'json' };
import profile from '../src/shards/pine-hollow/data/kingFight.generated.json' with { type: 'json' };
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture lends the shipped physics runtime, not generated shard products.
import { readFileSync } from 'node:fs';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { createSimHost, type SimHost } from '@wildshard/engine/sim';
import { snapshotSimHost, restoreSimHost } from '@wildshard/engine/sim/snapshot';
import { installWakeBoss } from '@wildshard/game/boss/nativeWake';
import { NativeInventory, grantNativeInventory } from '@wildshard/game/inventoryLaw';
import { SIM_LEVEL } from './fixtures/sim-level/level';

const marshRows = {
  id: 'reed-titan', level: 'salt-marsh', name: 'The Reed Titan', step: 'marsh.titan', kind: 'boar',
  arena: { radius: 9 }, wakeFlag: 'opened:shell', deadFlag: 'fallen:titan',
  phases: [{ at: 1 }, { at: .5 }],
  fields: { awake: 'summoned', rise: 'emerged', phase: 'stage', poolX: 'home-x', poolZ: 'home-z', arena: 'boundary' },
  presentation: { riseAbove: .2, cuts: [.5] }, events: { restore: 'titan.restore', wake: 'titan.wake' },
};
function marsh() {
  const actor = { position: new Vector3(30, 0, 40), mem: { emerged: 1, stage: 1 }, alive: true, hp: 180, maxHp: 180 };
  const player = new Vector3(31, 0, 40), flags = new Set<string>();
  const boss = new WakeBossEncounter(marshRows, { x: 30, z: 40 });
  const observation = () => ({ player, animal: actor, wake: flags.has('opened:shell'), dead: flags.has('fallen:titan') });
  return { boss, actor, player, flags, observation };
}

test('invented marsh rows own wake, arena, phase bar and exactly one victory effect', () => {
  const f = marsh();
  f.boss.update(f.observation()); expect(f.boss.state).toBe('dormant'); f.boss.takeEffects();
  f.flags.add('opened:shell'); f.boss.update(f.observation());
  expect(f.boss.state).toBe('fight'); expect(f.actor.mem).toHaveProperty('summoned', 1);
  expect(f.boss.takeEffects()).toEqual([{ kind: 'bar', visible: true, hp: 1 }]);
  f.actor.mem.stage = 2; f.actor.hp = 81; f.boss.update(f.observation());
  expect(f.boss.phase).toBe(1); expect(f.boss.takeEffects()).toEqual([{ kind: 'bar', visible: true, hp: .45 }]);
  f.actor.alive = false; f.boss.update(f.observation()); f.boss.update(f.observation());
  expect(f.boss.takeEffects()).toEqual([{ kind: 'outcome', outcome: 'won' }, { kind: 'hide' }, { kind: 'hide' }]);
  expect(f.boss.state).toBe('victory'); expect(f.boss.takeEffects()).toEqual([]);
});

test('invented marsh fight restores silently and waits for arena return after death', () => {
  const f = marsh(), resumed = marsh();
  f.flags.add('opened:shell'); resumed.flags.add('opened:shell'); f.boss.update(f.observation()); f.boss.takeEffects();
  resumed.boss.encounterRestore(f.boss.encounterSnapshot()); expect(resumed.boss.takeEffects()).toEqual([]);
  for (const owner of [f, resumed]) {
    expect(owner.boss.onPlayerDeath(owner.player)).toBe(false); owner.boss.update(owner.observation());
    expect(owner.boss.state).toBe('dormant');
    owner.player.x = 40; owner.boss.update(owner.observation());
    owner.player.x = 31; owner.boss.update(owner.observation());
    expect(owner.boss.state).toBe('fight'); owner.actor.alive = false; owner.boss.update(owner.observation());
  }
  expect(resumed.boss.encounterSnapshot()).toEqual(f.boss.encounterSnapshot());
  const effects = f.boss.takeEffects(); expect(effects.filter(effect => effect.kind === 'outcome')).toEqual([{ kind: 'outcome', outcome: 'lost' }, { kind: 'outcome', outcome: 'won' }]);
  expect(resumed.boss.takeEffects()).toEqual(effects);
});

test('data-only APIs reject callback bags, bad phase cuts and duplicate save aliases', () => {
  expect(JSON.stringify(formatJsonSchema(WakeEncounterSchema))).toContain('@wildshard/format/bossEncounter#WakeEncounterSchema.pipe.1');
  expect(() => new WakeBossEncounter({ ...marshRows, presentation: { riseAbove: .2, cuts: [.3] } }, { x: 30, z: 40 })).toThrow('Invalid wake phases');
  expect(() => parseRoamingEncounter({ ...roaming, wire: [...roaming.wire, roaming.wire[0]] }, profile)).toThrow();
  expect(() => v.parse(NativeBossBindingSchema, { population: 'marsh.population', weakPoint: { radius: .5 }, reward: { inventory: 'marsh.pack', grants: [] }, body: () => null })).toThrow();
  const row = parseRoamingEncounter({ ...roaming, definition: { ...roaming.definition, id: 'marsh.roamer', name: 'Reed Roamer' }, kind: 'reed-titan', presence: { enter: 7, leave: 13 } }, { ...profile, fight: { ...profile.fight, origin: { x: 30, z: 40 } } });
  expect(row.profile.fight.origin).toEqual({ x: 30, z: 40 }); expect(row.presence).toEqual({ enter: 7, leave: 13 });
});

test('invented native encounter adopts its real body and resumes without spawn or duplicate outcomes', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
  const host = createSimHost(SIM_LEVEL, { rapier });
  const bind = (owner: SimHost) => installWakeBoss(owner, marshRows, { pool: { x: 0, z: 0 }, arena: 9 });
  const shell = bind(host);
  let fork: SimHost | undefined;
  try {
    const actor = host.entities.get('boar:1'); if (actor === undefined) throw new Error('Missing fixture actor');
    actor.mem['emerged'] = 1; actor.mem['stage'] = 2; actor.hp = actor.maxHp * .45;
    host.flags.set('opened:shell'); shell.publish('titan.restore'); host.step();
    expect(shell.encounter.state).toBe('fight'); expect(shell.encounter.phase).toBe(1);
    const size = host.entities.size;
    let restored: ReturnType<typeof installWakeBoss> | undefined;
    fork = restoreSimHost(SIM_LEVEL, { rapier }, snapshotSimHost(host), native => { restored = bind(native); });
    if (restored === undefined) throw new Error('Missing restored shell');
    expect(fork.entities.size).toBe(size); expect(restored.encounter.encounterSnapshot()).toEqual(shell.encounter.encounterSnapshot());
    for (let i = 0; i < 40; i++) { host.step(); fork.step(); }
    expect(restored.encounter.encounterSnapshot()).toEqual(shell.encounter.encounterSnapshot()); expect(fork.entities.get('boar:1')?.hp).toBe(actor.hp);
    const outcomes: string[] = [];
    fork.events.on('boss.attempt', event => { outcomes.push(event.outcome); }, fork.scope);
    fork.flags.set('fallen:titan'); fork.step(); fork.step();
    expect(outcomes).toEqual(['won']); expect(fork.entities.size).toBe(size);
    expect(() => restored?.publish('captain.wake')).toThrow('Unknown boss event');
  } finally { fork?.dispose(); host.dispose(); }
});

test('reward rows resolve only registered native inventories and use their own admission law', async () => {
  const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm'))), host = createSimHost(SIM_LEVEL, { rapier });
  try {
    const pack = new NativeInventory({ kinds: ['reed-token', 'shell-token'], slots: 1, counts: { min: 0, max: 99, integer: true, complete: false }, quantity: 'positive-safe-integer', snapshot: 'order', restoreError: 'Bad marsh pack' }, host, 'marsh.pack');
    grantNativeInventory(host, 'marsh.pack', [{ item: 'reed-token', count: 3 }]); expect(pack.count('reed-token')).toBe(3);
    expect(() => grantNativeInventory(host, 'absent.pack', [{ item: 'reed-token', count: 3 }])).toThrow('Missing native inventory');
    expect(() => grantNativeInventory(host, 'marsh.pack', [{ item: 'other-token', count: 1 }])).toThrow(); expect(pack.count('reed-token')).toBe(3);
    expect(() => grantNativeInventory(host, 'absent.pack', [])).toThrow('Missing native inventory');
    grantNativeInventory(host, 'marsh.pack', []); expect(pack.count('reed-token')).toBe(3);
    expect(() => grantNativeInventory(host, 'marsh.pack', [{ item: 'shell-token', count: 1 }])).toThrow('Boss reward rejected');
    expect(pack.snapshot().order).toEqual(['reed-token']);
    expect(() => grantNativeInventory(host, 'marsh.pack', [{ item: 'reed-token', count: 2 }, { item: 'other-token', count: 1 }])).toThrow();
    expect(pack.count('reed-token')).toBe(5);
  } finally { host.dispose(); }
});
