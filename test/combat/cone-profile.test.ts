// oxlint-disable-next-line import/no-nodejs-modules -- Native fixture uses the shipped Rapier module.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { createSimHost, type SimHost } from '../../src/engine/sim';
import { loadRapier, type Rapier } from '../../src/engine/physics/rapier';
import { restoreSimHost, snapshotSimHost, type SimSnapshot } from '../../src/engine/sim/snapshot';
import { parseItems, type ShardItems } from '../../src/format/items';
import { HOST_PROBE, installNativeMelee, type NativeMeleeOwner } from '../../src/game/plugin/simulation';
import { FAN_PROFILE, FAN_STRIKES, SKY_ITEMS } from '../../src/shards/far-reach/data/items';
import type { DamageRequest } from '../../src/engine/combat/pipeline';

const row = SKY_ITEMS.rows[0];
const from = new Vector3(0, 1.68, 0), dir = new Vector3(0, -1.68, -3).normalize();
let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
type WeaponRow = Extract<ShardItems['rows'][number], { kind: 'weapon' }>;
function admitted(input: unknown): WeaponRow {
  const weapon = parseItems({ ...SKY_ITEMS, rows: [input] }).rows[0];
  if (weapon?.kind !== 'weapon' || weapon.native === undefined) throw new Error('Native weapon definition required');
  return weapon;
}
const level = { version: 1, id: 'cone.fixture', seed: 1, ground: { size: 500, height: 0 },
  player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 0 }, weapon: HOST_PROBE, quests: [],
  entities: [{ id: 'bird', seed: 1, scale: 1, at: { x: 0, y: 0, z: -3 }, yaw: 0,
    spec: { kind: 'fixture', label: 'Fixture', variant: 'fixture', rarity: 'common' as const, hp: 100, aggressive: false,
      dims: { bodyY: 0.5, bodyHalfLen: 0.3, bodyRadius: 0.2, headRadius: 0.1, legLen: 0.4, feet: [] as [number, number][], halfWidth: 0.2 },
      mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 1, relentless: false } } }] };
function fixture(input: unknown = row, saved?: SimSnapshot) {
  const weapon = admitted(input);
  let owner: NativeMeleeOwner | undefined;
  const install = (host: SimHost): void => { owner = installNativeMelee(host, weapon, weapon.native, { commands: () => [] }); };
  const host = saved === undefined ? createSimHost(level, { rapier }) : restoreSimHost(level, { rapier }, saved, install);
  if (saved === undefined) install(host);
  if (owner === undefined) throw new Error('Native melee owner missing');
  const hits: DamageRequest[] = [], impulses: Vector3[] = [], order: string[] = [], original = host.combat.hit.bind(host.combat);
  vi.spyOn(host.combat, 'hit').mockImplementation(request => { order.push('hit'); hits.push(request); return original(request); });
  const bird = host.entities.get('bird'); if (bird === undefined) throw new Error('Missing native bird');
  const impulse = bird.impulse.bind(bird);
  vi.spyOn(bird, 'impulse').mockImplementation(velocity => { order.push('impulse'); impulses.push(velocity.clone()); impulse(velocity); });
  const state = () => host.adapters.get(row.native.step)?.snapshot();
  return { host, owner, fan: owner.family, hits, impulses, order, state };
}

describe('admitted fan contacts reach the actual native owner', () => {
  it('retains every shipping contact number and identity exactly from the declared item', () => {
    const f = fixture();
    try {
      const [light, heavy, gust] = f.fan.moves;
      expect([light?.reach, light?.size, light?.hits[0]?.damage, heavy?.hits[0]?.damage, light?.cooldown, heavy?.cooldown])
        .toEqual([FAN_STRIKES.slash.reach, FAN_STRIKES.slash.halfAngle, FAN_STRIKES.slash.light, FAN_STRIKES.slash.heavy,
          FAN_STRIKES.slash.cooldown, FAN_STRIKES.slash.heavyCooldown]);
      expect([gust?.reach, gust?.size, gust?.hits[0]?.damage, gust?.cooldown]).toEqual([FAN_STRIKES.gust.reach,
        FAN_STRIKES.gust.halfAngle, FAN_STRIKES.gust.damage, FAN_STRIKES.gust.cooldown]);
      expect(f.fan.moves.every(move => move.hits.every(hit => hit.weaponId === row.id))).toBe(true);
      expect(f.state()).toEqual({ cooldown: 0, gustCooldown: 0 });
    } finally { f.host.dispose(); }
  });
  it('restores changed damage, clocks and impulses without restarting retained clocks', () => {
    const f = fixture(); let next: ReturnType<typeof fixture> | undefined;
    try {
      f.fan.claim(0); f.fan.claim(2); f.fan.cool(0.1);
      const saved = snapshotSimHost(f.host), before = f.state(), [light, heavy, gust] = row.contacts;
      const hit = gust.hits[0], reaction = hit.reactions[0];
      const changed = { ...row, light: { ...row.light, damage: 21, cooldown: 0.2 },
        profile: { ...FAN_PROFILE, gust: { ...FAN_PROFILE.gust, push: 7, lift: 2, damage: 11, cooldown: 0.7 } },
        contacts: [{ ...light, cooldown: 0.2, hits: [{ ...light.hits[0], damage: 21 }] }, heavy,
          { ...gust, cooldown: 0.7, hits: [{ ...hit, damage: 11, reactions: [{ ...reaction, speed: 7, lift: 2 }] }] }] };
      next = fixture(changed, saved); expect(next.state()).toEqual(before);
      expect(next.fan.land(0, 0, from, dir)).toBe(1); expect(next.hits[0]?.amount).toBe(21);
      next.fan.land(2, 0, from, dir); expect(next.fan.touched).toBe(1); expect(next.hits[1]?.amount).toBe(11);
      expect(next.impulses).toEqual([new Vector3(0, 2, -7)]); expect(next.order).toEqual(['hit', 'impulse', 'hit']);
      next.fan.cool(2); expect(next.fan.claim(0)).toBe(true); expect(next.fan.claim(2)).toBe(true);
      expect(next.state()).toEqual({ cooldown: 0.2, gustCooldown: 0.7 });
    } finally { next?.host.dispose(); f.host.dispose(); }
  });
  it('refuses missing definitions, incompatible shapes and changed identity before touching continuation', () => {
    const f = fixture(); let next: ReturnType<typeof fixture> | undefined;
    try {
      f.fan.claim(1); f.fan.claim(2); const saved = snapshotSimHost(f.host), before = f.state();
      const { contacts: _contacts, ...missing } = row; expect(() => admitted(missing)).toThrow();
      expect(() => admitted({ ...row, id: 'weapon.other' })).toThrow();
      expect(() => admitted({ ...row, heavy: { ...row.heavy, width: 1 } })).toThrow();
      expect(() => admitted({ ...row, profile: { ...FAN_PROFILE, gust: { ...FAN_PROFILE.gust, push: -1 } } })).toThrow();
      const { native: _native, ...missingNative } = row; expect(() => fixture(missingNative)).toThrow();
      for (const state of [{ cooldown: -1, gustCooldown: 0 }, { cooldown: 0, gustCooldown: -1 }, { cooldown: 0, gustCooldown: 0, extra: 1 }]) {
        let failed: SimHost | undefined;
        try { expect(() => restoreSimHost(level, { rapier }, { ...saved, adapters: saved.adapters.map(adapter =>
          adapter.id === row.native.step ? { ...adapter, state } : adapter) }, fresh => {
          failed = fresh; installNativeMelee(fresh, row, row.native, { commands: () => [] });
        })).toThrow(); } finally { failed?.dispose(); }
      }
      expect(f.state()).toEqual(before);
      next = fixture(row, saved); next.fan.cool(0.1); f.fan.cool(0.1); expect(next.state()).toEqual(f.state());
    } finally { next?.host.dispose(); f.host.dispose(); }
  });
});
