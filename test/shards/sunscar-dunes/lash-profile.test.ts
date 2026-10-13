import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { Actor, CombatTarget, DamageRequest } from '../../../src/engine/combat/pipeline';
import { App } from '../../../src/engine/app/app';
import { TabRegistry } from '../../../src/engine/ui/tabs';
import { lashRuntime, lashSpec } from '../../../src/shards/sunscar-dunes/runtime/items/lash';
import { bindSignalItems } from '../../../src/shards/sunscar-dunes/runtime/items';
import { CRACK } from '../../../src/shards/sunscar-dunes/runtime/items/heldWhip';
import { WHIP_ITEM, WHIP_PROFILE } from '../../../src/shards/sunscar-dunes/data/items';
import manifest from '../../../src/shards/sunscar-dunes/manifest';
import source from '../../../src/shards/sunscar-dunes/shard.config';

it('consumes the admitted lash profile through its real family, retaining the legacy held slot and shipping crack', () => {
  const app = new App();
  try {
    let built = 0;
    const whip = bindSignalItems({ app, scope: app.engineScope, game: { shard: manifest, rows: new Map(), bag: new TabRegistry() } },
      { raycast: () => null }, () => { built++; });
    expect(built).toBe(1);
    expect(whip.row.legacySlot).toBe('sunscar-whip');
    expect(whip.row.id).toBe(WHIP_ITEM.id);
    const row = source.items.rows.find(item => item.id === WHIP_ITEM.id);
    if (row === undefined) throw new Error('Missing declared lash');
    expect(row.kind === 'weapon' ? row.profile : null).toEqual(WHIP_PROFILE);
    expect(row.kind === 'weapon' ? row.contacts : null).toEqual(WHIP_ITEM.contacts);
    expect(lashSpec(row, WHIP_PROFILE)).toEqual(CRACK);
  } finally { app.engineScope.dispose(); }
});

it('projects the actual admitted melee contacts into the cord view and executes their damage and clocks', () => {
  const profile = { ...WHIP_PROFILE, contact: { chestHeight: 1.1, bodyAllowance: 0.2 }, timing: { ...WHIP_PROFILE.timing, unroll: 0.08, second: 0.24 } };
  const [light, heavy] = WHIP_ITEM.contacts;
  const contacts = [
    { ...light, reach: 3, height: 1.1, allowance: 0.2, lands: [0.08], hits: [{ ...light.hits[0], damage: 7 }] },
    { ...heavy, lands: [0.08, 0.24], show: 0.58 },
  ];
  const row = { ...WHIP_ITEM, light: { ...WHIP_ITEM.light, damage: 99, range: 19 }, contacts };
  const spec = lashSpec(row, profile);
  expect([spec.light, spec.reach, spec.unroll, spec.second]).toEqual([7, 3, 0.08, 0.24]);
  expect(spec.contact).toEqual(profile.contact);
  const requests: DamageRequest[] = [];
  const owner: Actor = { id: 'player', tags: ['actor.player'], state: [], attributes: { health: 100, maxHealth: 100 },
    alive: true, applyDamage: () => false };
  const position = new Vector3(0, 0, -2);
  const target: CombatTarget = { actor: { ...owner, id: 'body', tags: ['actor.creature'] }, position, hittable: true,
    target: { kind: 'fixture', position, alive: true, damageFor: () => 1, applyDamage: () => false }, hurt: () => null };
  const runtime = lashRuntime(spec, { source: owner, targets: () => [], body: () => ({ port: target, point: position }),
    aim: (from, dir) => { from.set(0, 0, 0); dir.set(0, 0, -1); return true; },
    hit: req => { requests.push(req); return { req, dealt: req.amount, killed: false }; } });
  expect(runtime.swing(0)).toBe(true);
  runtime.advance(0.079); expect(requests).toEqual([]);
  runtime.advance(0.001); expect(requests).toHaveLength(1);
  expect(requests[0]?.amount).toBe(7); expect(requests[0]?.source).toBe(owner);
  expect(requests[0]?.sourceTags).toBe(runtime.row(0).hits[0]?.tags);
  expect(runtime.cooldown).toBe(light.cooldown);
  const { contact: _contact, ...missing } = profile;
  expect(() => lashSpec(row, missing)).toThrow('native lash profile');
  expect(() => lashSpec(row, { ...profile, timing: { ...profile.timing, second: 0.08 } })).toThrow();
});
