import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- Byte fixtures bind the independent pre-attachment parser.
import { createHash } from 'node:crypto';
import { parseItems, parseMeleeContacts } from '../src/format/items';
import type { MeleeContactRow } from '../src/format/weaponProfiles';
import { bindMeleeContacts } from '../src/game/plugin/weaponFamily';
import type { Actor, DamageRequest } from '../src/engine/combat/pipeline';
import { ITEMS } from '../src/shards/_template/data/items';
import { SKY_ITEMS, FAN_STRIKES } from '../src/shards/far-reach/data/items';
import { coneRows } from '../src/shards/far-reach/runtime/weapons/coneStrikes';

const player: Actor = { id: 'player', tags: ['actor.player'], state: [], alive: true,
  attributes: { health: 100, maxHealth: 100 }, applyDamage: () => false };
const light = { lane: 'primary', heavy: false, cooldown: 0.45, shape: 'lane', reach: 7, size: 0.9,
  height: 0.9, allowance: 0.7, lands: [0.12], show: 0.42, reports: true,
  hits: [{ source: 'owner', damage: 18, tags: ['actor.player', 'weapon.fixture', 'dmg.melee'],
    moveId: 'fixture.crack', copyVectors: false, copyTags: false, reactions: [] }] } as const satisfies MeleeContactRow;
const heavy = { ...light, heavy: true, cooldown: 0.9, reach: 8, lands: [0.12, 0.32], show: 0.62,
  hits: [{ ...light.hits[0], damage: 16, moveId: 'fixture.double.1',
    reactions: [{ when: 'survived', kind: 'impulse', direction: 'aim-backward', speed: 16, lift: 0, maxHealth: 40 }] },
  { ...light.hits[0], damage: 16, moveId: 'fixture.double.2',
    reactions: [{ when: 'survived', kind: 'stagger', strength: 0.8, aboveHealth: 40 }] }] } as const satisfies MeleeContactRow;

describe('admitted melee contacts bind the original controller', () => {
  it('leaves pre-attachment item bytes unchanged and admits literal contact rows', () => {
    // Pinned by the independent item parser at 19bf798bd, before contacts were admitted.
    const fixtures = [
      { items: ITEMS, hash: 'd099a34bb740c96017b569ae94284397d05d49d35b097c7e4e4b58cbb3861cfd' },
      { items: SKY_ITEMS, hash: 'c4096c65c45cd7509aed9967b8ed35550d17188f60d73b4a7dfd1b8254f6e4b4' },
    ];
    for (const fixture of fixtures) expect(createHash('sha256').update(JSON.stringify(parseItems(fixture.items))).digest('hex')).toBe(fixture.hash);
    const items = { ...SKY_ITEMS, rows: [{ ...SKY_ITEMS.rows[0], contacts: [light, heavy] }] };
    expect(parseItems(items).rows[0]).toEqual(items.rows[0]);
  });
  it('refuses hidden authority, unbounded data and ambiguous landing schedules', () => {
    for (const row of [{ ...light, lands: [0.12, 0.32] }, { ...heavy, lands: [0.32, 0.12] },
      { ...heavy, show: 0.3 }, { ...light, reach: 21 }, { ...light, hits: [{ ...light.hits[0], source: player }] },
      { ...light, hits: [{ ...light.hits[0], weaponId: 'weapon.other' }] }, { ...light, cooldown: Infinity }]) {
      expect(() => parseMeleeContacts([row])).toThrow();
    }
    expect(() => parseMeleeContacts([])).toThrow();
    expect(() => parseMeleeContacts(Array.from({ length: 17 }, () => light))).toThrow();
  });
  it('preserves owner injection, reference lifetime and post-hit health predicates across delayed contacts', () => {
    const target = { position: new Vector3(0, 0, -2), actor: { ...player, id: 'target', attributes: { health: 100, maxHealth: 100 } } };
    const requests: DamageRequest[] = [], events: string[] = [];
    const family = bindMeleeContacts('weapon.fixture', [light, heavy], { owner: player, targets: () => [target],
      aim: (from, dir) => { from.set(0, 0.9, 0); dir.set(0, 0, -1); return true; },
      hit: req => { requests.push(req); events.push(req.moveId ?? ''); req.target.attributes.maxHealth = 40; return { req, dealt: req.amount, killed: false }; },
      struck: () => { target.actor.attributes.maxHealth = 60; },
      react: port => ({ actor: port.actor, impulse: () => { events.push('pull'); }, stagger: () => { events.push('stagger'); } }),
    });
    expect([family.cooldown, family.secondaryCooldown, family.t, family.landed]).toEqual([0, 0, -1, 0]);
    expect(family.swing(1)).toBe(true); family.advance(0.119); expect(requests).toHaveLength(0);
    family.advance(0.001); expect(requests).toHaveLength(1);
    family.advance(0.2); expect(events).toEqual(['fixture.double.1', 'fixture.double.2', 'stagger']);
    expect(requests.every(req => req.source === player && req.sourceTags === light.hits[0].tags)).toBe(true);
    expect(family.landed).toBe(2); expect(family.t).toBe(0.32);
    expect(family.advance(0.3)).toBe(0.62); expect(family.advance(0.001)).toBe(-1);
    const point = new Vector3(0, 0.9, -2), dir = new Vector3(0, 0, -1), from = new Vector3(0, 0.9, 0);
    family.strike(target, 0, 0, point, dir, from);
    expect(requests.at(-1)?.point).toBe(point); expect(requests.at(-1)?.dir).toBe(dir); expect(requests.at(-1)?.from).toBe(from);
  });
  it('retains body, nearest chest and world fallback order without touching restored continuation', () => {
    const body = { position: new Vector3(0, 0, -3), actor: { ...player, id: 'body' }, hittable: true };
    const chest = { ...body, position: new Vector3(0, 0, -1), actor: { ...player, id: 'chest' } };
    const events: string[] = []; let bodyOn = true, chestOn = true;
    const family = bindMeleeContacts('weapon.fixture', [light, heavy], { owner: 'env', targets: () => chestOn ? [body, chest] : [],
      body: () => bodyOn ? { port: body, point: body.position } : null,
      world: () => [{ id: 'world', at: new Vector3(0, 0.9, -2), radius: 0.1, crack: (_heavy, second) => { events.push(`world:${second}`); return true; } }],
      hit: req => { events.push(req.target.id); return { req, dealt: req.amount, killed: false }; },
    });
    const from = new Vector3(0, 0.9, 0), dir = new Vector3(0, 0, -1);
    family.land(0, 0, from, dir); bodyOn = false; family.land(0, 0, from, dir);
    chestOn = false; family.move = 1; family.t = 0.2; family.landed = 1; family.cooldown = 0.7;
    family.land(1, 1, from, dir);
    expect(events).toEqual(['body', 'chest', 'world:true']);
    expect([family.cooldown, family.t, family.move, family.landed]).toEqual([0.7, 0.2, 1, 1]);
  });
  it('binds the shipping fan rows exactly with independent primary and gust clocks', () => {
    const native = coneRows(FAN_STRIKES), rows: MeleeContactRow[] = native.map(row => ({ ...row,
      hits: row.hits.map(({ weaponId: _id, source: _source, ...hit }) => ({ ...hit, source: 'env' })) }));
    const family = bindMeleeContacts(FAN_STRIKES.weaponId, rows, { owner: player, targets: () => [], hit: () => null });
    expect(family.moves).toEqual(native); expect(family.claim(1)).toBe(true); expect(family.claim(0)).toBe(false);
    expect(family.claim(2)).toBe(true); family.cool(0.1);
    expect([family.cooldown, family.secondaryCooldown]).toEqual([0.75, 1.5]);
    expect(() => bindMeleeContacts('other', rows, { owner: player, targets: () => [], hit: () => null })).toThrow();
  });
});
