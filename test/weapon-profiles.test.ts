import { WHIP_PROFILE } from '../src/shards/sunscar-dunes/data/items';
import { expect, it } from 'vitest';
import { parseWeaponProfile } from '@wildshard/format/weaponProfiles';
import { parseItems } from '@wildshard/format/items';
import { formatJsonSchemas } from '../src/sdk/formatJsonSchema';
import { Scope } from '../src/engine/app/scope';
import { InputService } from '../src/engine/input/InputService';
import type { ItemFamily } from '../src/engine/combat/itemFamilies';
import type { Actor } from '../src/engine/combat/pipeline';
import { Weapon } from '../src/engine/combat/Weapon';
import { installDeclaredItems } from '../src/game/shardfile/items';
import { ITEMS } from '../src/shards/_template/data/items';
import { LONGBOW_LOOSE, ARROW_FLIGHT } from '../src/shards/pine-hollow/weapons/longbowFlight';
import { DRAW_TIME, LETDOWN_TIME, RENOCK_TIME, RN_EARLY, HOLD_STEADY, HOLD_TIRE, TIRED_TIME } from '../src/engine/combat/bowDraw';

const melee = {
  family: 'melee', damage: 18, reach: 2, swingScale: 1, cooldown: 0.35, comboGap: 0.8, chainLag: 0.1, heavyCharge: 0.6,
  moves: { combo: [{ windup: 0.1, slashEnd: 0.3, total: 0.5, damage: 1 }], heavy: { windup: 0.3, slashEnd: 0.5, total: 0.8, damage: 2 } },
  lunge: { range: 3, heavyRange: 4, cone: 0.5, stop: 0.7, speed: 10, minTime: 0.1, maxTime: 0.4 },
  sweep: { rays: 5, extensions: [0, 0.5, 1], step: 0.1, maxSamples: 32, maxHits: 16 },
};
const bow = {
  family: 'bow', quiver: LONGBOW_LOOSE.quiver, speedBase: LONGBOW_LOOSE.speedBase, speedDraw: LONGBOW_LOOSE.speedDraw, damageScale: LONGBOW_LOOSE.damageScale,
  draw: { drawTime: DRAW_TIME, letdownTime: LETDOWN_TIME, renockTime: RENOCK_TIME, renockEarly: RN_EARLY, holdSteady: HOLD_STEADY, holdTire: HOLD_TIRE, tiredTime: TIRED_TIME },
  spread: { degrees: 0.3, radius: 'sqrt', axisScale: 1, aimMultiplier: 0.5, motion: 0.6 }, flight: ARROW_FLIGHT, muzzle: 0.55, pool: 8, substeps: 4, lifetime: 12,
};
const firearm = {
  family: 'firearm', action: 'lever', magazine: 7, reserve: 21, interval: 0.68, reload: 0.4, reloadMode: 'perRound', autoReload: 0.35,
  damageScale: 1.5, range: 320, spreadAds: 0.06, spreadHip: 0.9, spreadRadius: 'sqrt', bloomShot: 0, bloomMax: 0, movingSpread: 0.5, movingAimReduction: 0.6,
  projectile: { kind: 'bullet', delivery: 'hitscan', speed: 0, radius: 0, flight: { gravity: 0, drag: 0, windCoupling: 0 }, pool: 1, substeps: 1, lifetime: 1 },
};
const thrown = {
  family: 'thrown', speed: 28, gravity: 9.8, damage: 55, headMultiplier: 2, radius: 0.03, headOffset: 0.8,
  windup: 0.4, release: 0.14, recovery: 0.45, carried: 3, pool: 5, pickupRadius: 1.6, pickupHeight: 2.2, survive: 0.9,
  arcPoints: 20, arcAfter: 0.1, stagger: 1,
};

it('round-trips all five complete numeric families exactly and emits a JSON Schema for each defining root', () => {
  for (const row of [melee, bow, firearm, thrown, WHIP_PROFILE]) {
    expect(parseWeaponProfile(row)).toEqual(row);
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- Prove the persisted JSON boundary, not a structured in-memory copy.
    expect(parseWeaponProfile(JSON.parse(JSON.stringify(row)) as unknown)).toEqual(row);
  }
  const schemas = formatJsonSchemas();
  for (const name of ['WeaponProfile', 'MeleeWeaponProfile', 'BowWeaponProfile', 'FirearmWeaponProfile', 'ThrownWeaponProfile', 'LashWeaponProfile']) {
    expect(schemas[`weaponProfiles.${name}`]?.title).toBe(`weaponProfiles.${name}`);
  }
});

it('refuses non-JSON author code, nonfinite/negative tuning, wrong families and unsafe or inconsistent bounded clocks/pools', () => {
  for (const invalid of [
    { ...bow, callback: () => undefined }, { ...bow, speedDraw: Infinity }, { ...bow, quiver: 0.5 },
    { ...bow, family: 'invented' },
    { ...WHIP_PROFILE, timing: { ...WHIP_PROFILE.timing, second: WHIP_PROFILE.timing.unroll } },
    { ...WHIP_PROFILE, timing: { ...WHIP_PROFILE.timing, show: WHIP_PROFILE.timing.unroll } },
    { ...WHIP_PROFILE, timing: { ...WHIP_PROFILE.timing, pull: Infinity } },
    { ...WHIP_PROFILE, contact: { ...WHIP_PROFILE.contact, chestHeight: Infinity } },
    { ...WHIP_PROFILE, contact: { ...WHIP_PROFILE.contact, bodyAllowance: -1 } },
    { ...WHIP_PROFILE, moves: { ...WHIP_PROFILE.moves, first: '' } }, { ...bow, draw: { ...bow.draw, holdTire: HOLD_STEADY } },
    { ...bow, substeps: 65 }, { ...melee, sweep: { ...melee.sweep, extensions: [] } },
    { ...melee, lunge: { ...melee.lunge, minTime: 2 } },
    { ...melee, moves: { ...melee.moves, heavy: { ...melee.moves.heavy, slashEnd: 2 } } },
    { ...firearm, magazine: 0 }, { ...firearm, spreadHip: -1 }, { ...firearm, reloadMode: 'invented' },
    { ...thrown, carried: 6 }, { ...thrown, survive: 1.01 }, { ...thrown, arcPoints: 1 }, { ...thrown, pool: 1025 },
  ]) expect(() => parseWeaponProfile(invalid)).toThrow();
});

it('leaves absent-profile item rows byte-identical and requires a matching shared family for an additive profile', () => {
  expect(JSON.stringify(parseItems(ITEMS))).toBe(JSON.stringify(ITEMS));
  const row = parseItems(ITEMS).rows.find(item => item.kind === 'weapon' && item.context === 'weapon.melee');
  if (row?.kind !== 'weapon') throw new Error('Missing template weapon');
  const base = { version: 1, rows: [], contexts: [], loadout: { primary: row.id, secondary: null, tools: [] } };
  const items = { ...base, rows: [{ ...row, family: 'melee', profile: melee }] };
  expect(parseItems(items).rows[0]).toEqual(items.rows[0]);
  const native = { ...items, rows: [{ ...row, family: 'example.whip', hook: null, profile: WHIP_PROFILE }] };
  expect(parseItems(native).rows[0]).toEqual(native.rows[0]);
  expect(() => parseItems({ ...items, rows: [{ ...row, family: 'bow', profile: melee }] })).toThrow();
});

class NativeWeapon extends Weapon {
  readonly model = { visible: false, parent: null, removeFromParent: () => undefined };
  readonly state = { ammo: 5, magazine: 5, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  holster = 0; enabled = true; adsHeld = false; aimInfo = null;
  tryFire(): void { /* The fixture only proves admission and port delivery. */ }
  update(): void { /* No rendered view or second native actor. */ }
}

it('refuses an unhosted profile before constructing or installing anything; an admitted family receives exact data', () => {
  const scope = new Scope('profiles'), input = new InputService(() => 0), received: unknown[] = [];
  const actor: Actor = { id: 'actor.player', tags: [], attributes: { health: 100, maxHealth: 100 }, state: [], alive: true, applyDamage: () => false };
  const family: ItemFamily = { kind: 'weapon', create: (row, _spec, ports) => { received.push(ports.profile); return new NativeWeapon(row); } };
  const row = parseItems(ITEMS).rows.find(item => item.kind === 'weapon' && item.context === 'weapon.melee');
  if (row?.kind !== 'weapon') throw new Error('Missing template weapon');
  const items = { version: 1, rows: [{ ...row, family: 'melee', hook: null, profile: melee }], contexts: [], loadout: { primary: row.id, secondary: null, tools: [] } };
  const ports = { scope, input, actorId: actor.id, families: new Map([['melee', family]]),
    aim: () => ({ origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: 1 } }), icon: () => 'sword' as const,
    runtime: () => ({ actor, combat: { hit: () => null }, targets: () => [], hook: null, effect: () => undefined }),
  };
  try {
    const census = scope.census;
    expect(() => installDeclaredItems(items, ports)).toThrow('Unhosted weapon profile melee');
    expect(scope.census).toEqual(census); expect(received).toEqual([]);
    family.profiles = ['bow'];
    expect(() => installDeclaredItems(items, ports)).toThrow('Unhosted weapon profile melee');
    family.profiles = ['melee'];
    const installed = installDeclaredItems(items, ports);
    expect(received).toEqual([parseWeaponProfile(melee)]); expect(installed.primary?.row.id).toBe(row.id);
  } finally { scope.dispose(); }
});

it('preserves existing lash profile admission without inventing newly authored contact values', () => {
  const { contact: _contact, ...legacy } = WHIP_PROFILE;
  expect(parseWeaponProfile(legacy)).toEqual(legacy);
});
