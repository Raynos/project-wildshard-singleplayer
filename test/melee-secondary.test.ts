import { beforeAll, describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { compileScript } from '../src/sdk/compileScript';
import { scriptSource } from './script/fixture';
import { scriptItemHook } from '../src/engine/combat/items';
import { ScriptHost } from '../src/engine/script/host';
import { DeclaredScriptWorld } from '../src/engine/script/state';
import { bindMeleeContacts, startMeleeSecondary } from '../src/game/plugin/simulation';
import { parseItems } from '../src/format/items';
import { SKY_ITEMS } from '../src/shards/far-reach/data/items';
import type { MeleeContactRow } from '../src/format/weaponProfiles';

const moduleId = '0'.repeat(64), entity = 7, event = 301;
const row = { lane: 'secondary', heavy: false, cooldown: 1.6, shape: 'cone', reach: 9, size: 0.6,
  height: 0, allowance: 0, lands: [], show: 0, reports: false,
  hits: [{ source: 'env', damage: 4, tags: ['dmg.wind'], moveId: 'fixture.gust', copyVectors: true, copyTags: true,
    reactions: [{ when: 'before', kind: 'impulse', direction: 'radial-away', speed: 15, lift: 4 }] }] } as const satisfies MeleeContactRow;
const emit = (action: string, target = 'load<f64>(16384+24)', count = '1'): string => scriptSource(
  `store<f64>(24576,3);store<f64>(24584,301);store<f64>(24592,${target});store<f64>(24600,${action});`, '', count);
let bytes: Uint8Array;
beforeAll(async () => { bytes = await compileScript(emit('load<f64>(16384+16)')); });
function fixture(code = bytes) {
  const world = new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [event], maxEntities: 1 },
    [{ id: entity, name: 'held item', position: [0, 0, 0], fields: {}, frozen: false, interactive: true }],
    { shared: [], player: [] }, new Map([[entity, 'player']]));
  const host = new ScriptHost({ world, query: () => [] }); host.install(moduleId, code); host.beginTick(1);
  const hook = scriptItemHook(host, moduleId, entity, event, 'player'), effects: string[] = [];
  const actor = { id: 'target', tags: ['actor.creature'] as const, state: [], alive: true,
    attributes: { health: 100, maxHealth: 100 }, applyDamage: () => false };
  const family = bindMeleeContacts('weapon.fixture', [row], { owner: 'env',
    targets: () => [{ actor, position: new Vector3(0, 0, -2), impulse: () => { effects.push('impulse'); } }],
    hit: req => { effects.push(`damage:${req.amount}`); return { req, dealt: req.amount, killed: false }; } });
  return { host, hook, family, effects };
}
const command = { tick: 1, dt: 1 / 60, action: 3, move: 0 } as const;

describe('shared melee AS secondaries', () => {
  it('admits an actor-bound action and leaves contacts in the original owner phase', () => {
    const f = fixture(); expect(startMeleeSecondary(f.family, f.hook, command)).toBe(0);
    expect(f.effects).toEqual([]); expect(f.family.secondaryCooldown).toBe(1.6);
    expect(startMeleeSecondary(f.family, f.hook, command)).toBeNull();
    f.family.land(0, 0, new Vector3(), new Vector3(0, 0, -1));
    expect(f.effects).toEqual(['impulse', 'damage:4']);
    f.family.cool(1.6); f.host.beginTick(2);
    expect(startMeleeSecondary(f.family, f.hook, { ...command, tick: 2 })).toBe(0);
    expect(f.host.checkpoint().modules.map(m => [m.failures, m.disabled])).toEqual([[0, false]]);
    expect(() => scriptItemHook(f.host, moduleId, entity, event, 'other')).toThrow('host-bound owner');
  });
  it('refuses missing hooks, invalid commands and primary-lane moves without changing continuation', () => {
    const f = fixture(); f.family.cooldown = 0.8; f.family.t = 0.2; f.family.landed = 1;
    for (const input of [{ ...command, tick: -1 }, { ...command, dt: Infinity }, { ...command, move: 1 }, { ...command, move: 0.5 }])
      expect(startMeleeSecondary(f.family, f.hook, input)).toBeNull();
    expect(startMeleeSecondary(f.family, null, command)).toBeNull();
    const primary = bindMeleeContacts('weapon.fixture', [{ ...row, lane: 'primary' }], { owner: 'env', targets: () => [], hit: () => null });
    expect(startMeleeSecondary(primary, f.hook, command)).toBeNull();
    expect([f.family.cooldown, f.family.secondaryCooldown, f.family.t, f.family.landed]).toEqual([0.8, 0, 0.2, 1]);
  });
  it('declines a forged action or trapped module before claiming a cooldown or landing a contact', async () => {
    for (const code of [await compileScript(emit('4')), await compileScript(scriptSource('unreachable();', '', '0'))]) {
      const f = fixture(code); expect(startMeleeSecondary(f.family, f.hook, command)).toBeNull();
      expect(f.family.secondaryCooldown).toBe(0); expect(f.effects).toEqual([]);
    }
  });
  it('starts a timed secondary without advancing its landing clock', () => {
    const f = fixture(), family = bindMeleeContacts('weapon.fixture', [{ ...row, lands: [0.12], show: 0.42 }], {
      owner: 'env', targets: () => [], hit: () => null });
    expect(startMeleeSecondary(family, f.hook, command)).toBe(0);
    expect([family.t, family.landed, family.secondaryCooldown]).toEqual([0, 0, 1.6]);
    family.advance(0.1); expect(family.landed).toBe(0);
  });
  it('requires secondary declarations to resolve an admitted hook and contact lane', () => {
    const item = { ...SKY_ITEMS.rows[0], contacts: [row], hook: { module: moduleId, entity, event },
      secondary: { action: 'fixture.gust', code: 3, move: 0 } };
    const items = { ...SKY_ITEMS, rows: [item] };
    expect(parseItems(items).rows[0]).toEqual(item);
    for (const bad of [{ ...item, hook: null }, { ...item, contacts: [] },
      { ...item, contacts: [{ ...row, lane: 'primary' }] }, { ...item, secondary: { ...item.secondary, move: 1 } },
      { ...item, secondary: { ...item.secondary, code: 1 } }]) expect(() => parseItems({ ...items, rows: [bad] })).toThrow();
  });
});
