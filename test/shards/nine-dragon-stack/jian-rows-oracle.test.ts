// oxlint-disable-next-line import/no-nodejs-modules -- The real host uses the shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { ItemsSchema, type ShardItems } from '../../../src/format/items';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHost } from '../../../src/engine/sim/snapshot';
import { installNineJian, JIAN_STEP } from '../../../src/shards/nine-dragon-stack/runtime/jian';
import { installNineJian as legacyJian } from '../../../src/shards/nine-dragon-stack-legacy/runtime/jian';
import { JIAN_ROW as legacyProfile } from '../../../src/shards/nine-dragon-stack-legacy/vm/jianRow';
import source from '../../../src/shards/nine-dragon-stack/shard.config';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const level: SimLevel = { version: SIM_API_VERSION, id: 'jian.rows', seed: 9, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0.1, z: 0 }, yaw: 0, speed: 5 }, entities: [], quests: [],
  weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2,
    cooldown: 0.3, range: 1, damage: 0, tags: [] } };
const row = (): Extract<ShardItems['rows'][number], { kind: 'weapon' }> => {
  const found = source.items.rows.find(item => item.id === 'weapon.jian');
  if (found?.kind !== 'weapon') throw new Error('Missing declared Jian');
  return found;
};
const continuation = (host: SimHost): string => {
  const saved = snapshotSimHost(host).adapters.find(adapter => adapter.id === JIAN_STEP)?.state;
  if (typeof saved !== 'string') throw new Error('Missing Jian continuation');
  return saved;
};

it('matches every frozen light/queued/heavy clock field and resumes a mid-charge native checkpoint exactly', () => {
  const before = createSimHost(level, { rapier }), after = createSimHost(level, { rapier });
  let copy: SimHost | undefined;
  // The shipping clock runs after player commands; taps chain and lapse, holds include both early and full releases.
  let tap = false, hold = false;
  const attack = (): boolean => tap, held = (): boolean => hold;
  try {
    legacyJian(before, row(), legacyProfile, attack, held);
    installNineJian(after, row(), attack, held);
    for (let tick = 0; tick < 2000; tick++) {
      const next = tick + 1;
      tap = next % 101 === 3 || next % 101 === 13 || next % 101 === 23;
      hold = next % 173 >= 65 && next % 173 < 97;
      after.step(); copy?.step(); before.step();
      expect(continuation(after), `tick ${String(tick)}`).toBe(continuation(before));
      if (copy !== undefined) expect(continuation(copy)).toBe(continuation(before));
      if (tick === 70) {
        const saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(after)));
        copy = restoreSimHost(level, { rapier }, saved, fresh => { installNineJian(fresh, row(), attack, held); });
        expect(continuation(copy)).toBe(continuation(after));
      }
    }
  } finally { before.dispose(); after.dispose(); copy?.dispose(); }
});

it('uses admitted profile changes rather than reading a hidden viewmodel recipe', () => {
  const original = row();
  if (original.profile?.family !== 'melee') throw new Error('Missing Jian melee profile');
  const changedRow = { ...original, profile: { ...original.profile, cooldown: 1 } };
  const data = v.parse(ItemsSchema, { ...source.items, rows: source.items.rows.map(item => item.id !== original.id ? item : changedRow) });
  const changed = data.rows.find(item => item.id === original.id);
  if (changed?.kind !== 'weapon') throw new Error('Missing changed Jian');
  const normalHost = createSimHost(level, { rapier }), slowHost = createSimHost(level, { rapier });
  try {
    const normal = installNineJian(normalHost, original, () => true), slow = installNineJian(slowHost, changed, () => true);
    for (let tick = 0; tick < 300; tick++) { normalHost.step(); slowHost.step(); }
    expect(normal.swings()).toBeGreaterThan(slow.swings());
  } finally { normalHost.dispose(); slowHost.dispose(); }
});

it('refuses an absent numeric profile before registering a native step', () => {
  const host = createSimHost(level, { rapier }), install = vi.spyOn(host, 'onStep');
  try {
    const { profile: _profile, ...missing } = row();
    expect(() => installNineJian(host, missing, () => false)).toThrow('admitted melee profile');
    // Omission is valid in the format for historical families; it is refused by this profile-owned native Jian.
    expect(install).not.toHaveBeenCalled();
  } finally { host.dispose(); }
});
