// oxlint-disable-next-line import/no-nodejs-modules -- Compile the real portable author source as the permanent byte oracle.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { compileScript } from '../src/sdk/compileScript';
import { bindMeleeContacts, createMeleeScriptDriver, startMeleeSecondary } from '../src/game/plugin/simulation';
import { MoverScriptDriver } from '../src/game/plugin/mover';
import { FAN_CONTACTS } from '../src/shards/far-reach/data/fanContacts';
import { FAN_GUST_MODULE } from '../src/shards/far-reach/data/fanGustModule';
import { FAN_ID, SKY_ITEMS } from '../src/shards/far-reach/data/items';
import fanRows from './fixtures/fan-contact-rows.json' with { type: 'json' };

let bytes: Uint8Array;
beforeAll(async () => { bytes = await compileScript(readFileSync(new URL('../src/shards/far-reach/behaviour/fanGust.as', import.meta.url), 'utf8'), { maximumPages: 1 }); });

it('retains the original fan contact rows exactly', () => {
  const family = bindMeleeContacts(FAN_ID, FAN_CONTACTS, { owner: 'env', targets: () => [], hit: () => null });
  expect([0, 1, 2].map(index => family.row(index))).toEqual(fanRows);
});

it('pins portable compiler bytes and admits gust on the mover host without another clock', async () => {
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))].map(value => value.toString(16).padStart(2, '0')).join('');
  expect({ hash, bytes: bytes.length }).toEqual(FAN_GUST_MODULE);
  const item = { ...SKY_ITEMS.rows[0], contacts: FAN_CONTACTS, hook: { module: hash, entity: 6001, event: 301 },
    secondary: { action: 'far.gust', code: 3, move: 2 } } as const;
  const driver = await createMeleeScriptDriver({ ...SKY_ITEMS, rows: [item] }, 'actor.player', new Map([[hash, bytes]]), 6417);
  const lane = new MoverScriptDriver([], () => []).compose({ identity: { seed: 6417 },
    sim: { scripts: [hash], bindings: [], scriptTickDivisor: 1 }, state: { shared: [], player: [] } }, driver.modules,
  { rules: { fields: {}, archetypes: [], events: [], maxEntities: 1 }, entities: [], actors: new Map(), query: () => [] },
  undefined, undefined, { roles: [driver.role()] });
  const hook = driver.hooks(lane.host).get(FAN_ID); if (hook === undefined) throw new Error('Missing fan hook');
  const events: string[] = [], actor = { id: 'target', tags: ['actor.creature'] as const, state: [], alive: true,
    attributes: { health: 100, maxHealth: 100 }, applyDamage: () => false };
  const family = bindMeleeContacts(FAN_ID, FAN_CONTACTS, { owner: 'env',
    targets: () => [{ actor, position: new Vector3(0, 0, -2), impulse: () => { events.push('impulse'); } }],
    hit: request => { events.push(`${request.moveId}:${request.amount}:${typeof request.source === 'string' ? request.source : request.source.id}`); return null; } });
  lane.step(1);
  expect(hook({ tick: 1, dt: 1 / 60, action: 4, fuel: 0, cooldown: 0 })).toBeNull();
  expect(hook({ tick: 1, dt: 1 / 60, action: 3, fuel: 0, cooldown: 1 })).toBeNull();
  expect(startMeleeSecondary(family, hook, { tick: 1, dt: 1 / 60, action: 3, move: 2 })).toBe(2);
  expect(events).toEqual([]); family.land(2, 0, new Vector3(), new Vector3(0, 0, -1));
  expect(events).toEqual(['impulse', 'far.fan.gust:4:env']); expect(family.secondaryCooldown).toBe(1.6);
  expect(lane.host.currentTick).toBe(1); expect(lane.host.failureCount).toBe(0);
});
