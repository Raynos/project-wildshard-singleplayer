import { BOW } from '../../src/game/weapons/starterBowProfile';
import { LONGBOW } from '../../src/shards/pine-hollow/weapons/longbowProfile';
import { CROSSBOW_PROFILE } from '../../src/shards/pine-hollow/weapons/crossbow/profiles';
import { AR15 } from '../../src/shards/nalati-grasslands/data/firearmProfile';
import { AR15 as PINE_AR15 } from '../../src/shards/pine-hollow/data/firearmProfile';
import { LEVER_PROFILE } from '../../src/shards/pine-hollow/weapons/leverAction';
import { SWORD_WOOD, SWORD_IRON } from '../../src/game/weapons/starterMeleeProfile';
import { JIAN_ROW } from '../../src/shards/nine-dragon-stack/vm/jianRow';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { arrowKind as bowArrow } from '../../src/shards/nalati-grasslands/weapons/recurve';
import { NALATI_BOW } from '../../src/shards/nalati-grasslands/weapons/loadout';
import { arrowKind as longbowArrow } from '../../src/shards/pine-hollow/weapons/longbowView';
import * as draw from '../../src/engine/combat/bowDraw';
import { boltFlight, boltDamage } from '../../src/shards/pine-hollow/loadout/ammo';
import { legacyConstants } from '../fake/legacySource';
import { fakeWorld } from '../fake/world';

// Spec 09 §1.4. Private constants are read through an AST adapter until the profile rows become public.
const rad = THREE.MathUtils.degToRad;
const profiles: readonly [string, Record<string, unknown>][] = [
  ['src/shards/nalati-grasslands/runtime/weapons/Sabre.ts', { DAMAGE: 24, SPEED: 0.9, MOUNT_REACH: 2.8, MOUNT_COOLDOWN: 0.7,
    PASS_SENSE: 6, CHAIN_WINDOW: 3, CHAIN_STEP: 0.1, CHAIN_MAX: 1.4, BLADE_L: 0.62, CURVE: 0.12 }],
  ['src/shards/nalati-grasslands/runtime/weapons/Spear.ts', { REACH: 3.2, THRUST_DAMAGE: 30, THRUST_STAGGER: 0.5, T_WIND: 0.12,
    T_ACTIVE_END: 0.22, T_TOTAL: 0.35, RMB_TAP_MAX: 0.25, LANCE_REHIT: 1.2,
    LANCE_REACH: 2.5, LANCE_CONE: rad(15), LANCE_MIN_SPEED: 8,
    WINDUP: 0.4, THROW_T: 0.14, THROW_RECOVER: 0.45, JAV_SPEED: 28, JAV_GRAVITY: 9.8, JAV_DAMAGE: 55, JAV_HEAD: 2,
    JAV_POOL: 5, PICKUP_R: 1.6, JAV_SURVIVE: 0.9, JAV_RADIUS: 0.03, ARC_POINTS: 32, ARC_SHOW_AFTER: 0.12, FOV_HIP: 72 }],
  ['src/shards/pine-hollow/weapons/leverAction.ts', { TUBE_MAX: 6, RESERVE_START: 21, CYCLE_DELAY: 0.12, LEVER_TIME: 0.56,
    ROUND_TIME: 0.4, RELOAD_IN: 0.22, RELOAD_OUT: 0.2, AUTO_RELOAD_DELAY: 0.35 }],
  ['src/shards/pine-hollow/runtime/weapons/LeverRifle.ts', { KICK_PITCH: rad(1.25), BRASS_COUNT: 4, BRASS_LIFE: 1.8, TRACER_COUNT: 2, TRACER_TIME: 0.09,
    SIGHT_Y: 0.045, REAR_Z: -0.13, FRONT_Z: -0.512, MUZZLE_Z: -0.535 }],
  ['src/shards/nalati-grasslands/runtime/weapons/GoldenBow.ts', { STREAK_PTS: 48, SPEED_BASE: 30, SPEED_DRAW: 28, SUN_DRAW: 0.95 }],
  ['src/shards/nalati-grasslands/runtime/weapons/Naizagai.ts', { CRESCENT_RANGE: 15, CRESCENT_DMG: 40, CRESCENT_T: 0.32, ARC_R: 6,
    GALLOP_MIN: 11, CALL_RANGE: 25, CALL_DMG: 60, CALL_R: 3, CALL_T: 0.6 }],
];

describe('weapon tuning parity (09 §1.4)', () => {
  it.each(profiles)('%s preserves its own profile', (file, expected) => {
    const actual = legacyConstants(file, Object.keys(expected), { THREE });
    for (const [name, value] of Object.entries(expected)) {
      if (typeof value === 'number') expect(actual[name], `${file}:${name}`).toBeCloseTo(value, 14);
      else expect(actual[name], `${file}:${name}`).toEqual(value);
    }
  });
  it('the public Melee profiles preserve sword defaults and explicit iron/jian damage', () => {
    expect([SWORD_WOOD.damage, SWORD_IRON.damage, JIAN_ROW.damage]).toEqual([12, 28, 12]);
    expect([SWORD_WOOD.reach, SWORD_WOOD.cooldown, SWORD_WOOD.comboGap, SWORD_WOOD.chainLag, SWORD_WOOD.heavyCharge, SWORD_WOOD.chargeBlend])
      .toEqual([2.2, 0.08, 0.6, 0.02, 0.45, 0.16]);
    expect(SWORD_WOOD.lunge).toEqual({ range: 4, heavyRange: 5, cone: rad(25), stop: 1.1, speed: 22, minTime: 0.08, maxTime: 0.15 });
    expect(SWORD_WOOD.sweep).toEqual({ rays: 5, extensions: [0.12, 0.24, 0.36, 0.48], step: 0.09, maxSamples: 6, maxHits: 8 });
    expect(SWORD_WOOD.trail).toEqual({ samples: 20, subdivisions: 3 });
    expect(SWORD_WOOD.dodgeKick).toEqual({ kick: 2.2, k: 160, c: 14 }); expect(SWORD_WOOD.armFollow).toBe(0.45);
    expect(SWORD_WOOD.feel).toEqual({ lag: { gain: 0.5, clampYaw: 0.12, clampPitch: 0.1, k: 220, c: 20, posYaw: 0.25, posPitch: 0.2 },
      bob: { x: 0.018, y: 0.014, rz: 0.02, rx: 0.012 }, sway: { ax: 0.003, fx: 0.7, ay: 0.0025, fy: 1.1 }, fovHip: 72 });
    expect(SWORD_IRON.parent).toBe(SWORD_WOOD.id); expect(JIAN_ROW.parent).toBe(SWORD_WOOD.id);
  });
  it('public ranged profiles preserve every distinct tuning value', () => {
    expect(NALATI_BOW).toMatchObject({ ...BOW, family: 'bow', quiver: 24, swayMax: rad(1.5), speedBase: 30, speedDraw: 28, damageScale: 1.2,
      aimZoom: 2, aimVmZoom: 0.85, aimSway: 0.5, aimSpread: 0.5, aimIn: 10, arcFrom: 0.25, arcColour: 0x8fe3ff, vmScale: 0.72, arrowLength: 0.8 });
    expect(LONGBOW).toMatchObject({ ...BOW, parent: 'weapon.bow', quiver: 20, swayMax: rad(1.4), speedBase: 32, speedDraw: 30, damageScale: 1.35,
      aimZoom: 1.6, arcColour: 0xffc070, arcMode: 'aim', zoomLook: false, inspectZ: -1.4,
      inspectHidesArms: true, transparentParts: true, poses: LONGBOW.poses, arrowX: -0.017, arrowY: 0.052, arrowLength: 0.76, build: LONGBOW.build, arrow: LONGBOW.arrow, wind: LONGBOW.wind });
    expect(CROSSBOW_PROFILE).toEqual({ family: 'crossbow', quiver: 30, speed: 62, gravity: 9.8, drag: 0.012, radius: 0.03, bury: 0.08,
      reload: 1.35, autoReload: 1.4, cooldown: 0.3, kick: rad(0.8), adsBlend: 0.18, adsMotion: 0.3, maxFlying: 8, maxStuck: 200 });
    expect(PINE_AR15).toEqual(AR15);
    expect(AR15).toMatchObject({ family: 'firearm', action: 'semi', magazine: 30, reserve: 90, interval: 0.09, reload: 1.6, autoReload: 0.35,
      damageScale: 0.55, range: 300, kick: rad(0.35), spreadAds: 0.12, spreadHip: 1.1, spreadRadius: 'linear', bloomShot: 0.35, bloomMax: 1.6,
      brass: { count: 3, life: 1.4 }, tracer: { count: 3, life: 0.09, width: 3 }, ads: { blend: 0.16, motion: 0.3, nearMargin: 0.03, sightY: 0.064, rearZ: 0.1, frontZ: -0.455, muzzleZ: -0.645 } });
    expect(LEVER_PROFILE).toMatchObject({ family: 'firearm', action: 'lever', magazine: 7, reserve: 21, damageScale: 1.5, range: 320, kick: rad(1.25),
      spreadAds: 0.06, spreadHip: 0.9, spreadRadius: 'sqrt', movingSpread: 0.5, movingAimReduction: 0.6, brass: { count: 4, life: 1.8 }, tracer: { count: 2, life: 0.09, width: 3 },
      ads: { blend: 0.17, motion: 0.3, nearMargin: 0.03, sightY: 0.045, rearZ: -0.13, frontZ: -0.512, muzzleZ: -0.535 } });
  });
  it('BowDraw preserves draw, fatigue and early renock timing', () => {
    expect([draw.DRAW_TIME, draw.LETDOWN_TIME, draw.RENOCK_TIME, draw.RN_EARLY, draw.HOLD_STEADY, draw.HOLD_TIRE, draw.TIRED_TIME])
      .toEqual([0.75, 0.4, 0.62, 0.4, 3, 8, 1.1]);
  });
  it('arrow rows retain distinct geometry, gravity, drag and pool sizes', () => {
    const { sky } = fakeWorld();
    for (const [factory, expected] of [
      [bowArrow, { length: 0.8, gravity: 5, drag: 0.015, windCoupling: 0.25, bury: 0.09, recover: 0.7, maxFlying: 8, maxStuck: 64 }],
      [longbowArrow, { length: 0.76, gravity: 6, drag: 0.014, windCoupling: 0.25, bury: 0.09, recover: 0.7, maxFlying: 8, maxStuck: 48 }],
    ] as const) {
      const kind = factory(sky);
      expect(kind).toMatchObject(expected); kind.geometry.dispose(); kind.material.dispose();
    }
  });
  it('special bolt multipliers stay inside each source formula and preserve pitch rain immunity', () => {
    expect(boltFlight('iron', 0)).toEqual({ gravity: 1, drag: 1 });
    expect(boltFlight('iron', 1)).toEqual({ gravity: 1.2, drag: 1.9 });
    expect(boltFlight('pitch', 0)).toEqual({ gravity: 0.8, drag: 0.7 });
    expect(boltFlight('pitch', 1)).toEqual(boltFlight('pitch', 0));
    expect(boltFlight('broadhead', 1)).toEqual({ gravity: 1.08 * 1.2, drag: 1.1 * 1.9 });
    expect(['deer', 'boar', 'bear', 'antler-king'].map((kind) => boltDamage('broadhead', kind))).toEqual([1.4, 1.4, 1, 1]);
  });
});
