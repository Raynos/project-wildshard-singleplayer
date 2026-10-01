import { SWORD_WOOD, SWORD_IRON } from '#kit';
import { JIAN_ROW } from '#shards/nine-dragon-stack/vm/jianRow';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { arrowKind as bowArrow } from '#engine/player/Bow';
import { arrowKind as longbowArrow } from '#engine/player/Longbow';
import * as draw from '#engine/player/bowDraw';
import { boltFlight, boltDamage } from '#shards/pine-hollow/loadout/ammo';
import { legacyConstants } from '../fake/legacySource';
import { fakeWorld } from '../fake/world';

// Spec 09 §1.4. Private constants are read through an AST adapter until the profile rows become public.
const rad = THREE.MathUtils.degToRad;
const profiles: readonly [string, Record<string, unknown>][] = [
  ['src/shards/nalati-grasslands/weapons/Sabre.ts', { DAMAGE: 24, SPEED: 0.9, MOUNT_REACH: 2.8, MOUNT_COOLDOWN: 0.7,
    PASS_SENSE: 6, CHAIN_WINDOW: 3, CHAIN_STEP: 0.1, CHAIN_MAX: 1.4, BLADE_L: 0.62, CURVE: 0.12 }],
  ['src/shards/nalati-grasslands/weapons/Spear.ts', { REACH: 3.2, THRUST_DAMAGE: 30, THRUST_STAGGER: 0.5, T_WIND: 0.12,
    T_ACTIVE_END: 0.22, T_TOTAL: 0.35, BRACE_SET: 0.25, BRACE_MAX: 4, BRACE_COOLDOWN: 1, BRACE_REHIT: 1.2,
    BRACE_CONE: rad(30), BRACE_MIN_SPEED: 4, LANCE_REACH: 2.5, LANCE_CONE: rad(15), LANCE_MIN_SPEED: 8,
    WINDUP: 0.4, THROW_T: 0.14, THROW_RECOVER: 0.45, JAV_SPEED: 28, JAV_GRAVITY: 9.8, JAV_DAMAGE: 55, JAV_HEAD: 2,
    JAV_POOL: 5, PICKUP_R: 1.6, JAV_SURVIVE: 0.9, JAV_RADIUS: 0.03, ARC_POINTS: 32, ARC_SHOW_AFTER: 0.12, FOV_HIP: 72 }],
  ['src/engine/player/Bow.ts', { QUIVER_MAX: 24, SWAY_MAX: rad(1.5), ARC_MAX: 56, ARC_SPACING: 0.8, ARC_SKIP: 0.5, ARC_BLEND: 11, ARC_CYAN: 0x8fe3ff, ARC_FROM: 0.25, SPEED_BASE: 30, SPEED_DRAW: 28, DAMAGE_SCALE: 1.2,
    AIM_ZOOM: 2, AIM_VM_ZOOM: 0.85, AIM_SWAY: 0.5, AIM_SPREAD: 0.5, AIM_IN: 10, ARROW_LEN: 0.8, VM_SCALE: 0.72 }],
  ['src/engine/player/Longbow.ts', { QUIVER_MAX: 20, SWAY_MAX: rad(1.4), ARC_MAX: 56, ARC_SPACING: 0.8, ARC_SKIP: 0.5, ARC_BLEND: 11, ARC_AMBER: 0xffc070, ARC_FROM: 0.25, SPEED_BASE: 32, SPEED_DRAW: 30, DAMAGE_SCALE: 1.35,
    AIM_ZOOM: 1.6, AIM_VM_ZOOM: 0.85, AIM_SWAY: 0.5, AIM_SPREAD: 0.5, AIM_IN: 10, ARROW_LEN: 0.76, VM_SCALE: 0.72 }],
  ['src/engine/player/Crossbow.ts', { MAX_BOLTS: 30, BOLT_SPEED: 62, BOLT_DRAG: 0.012, GRAVITY: 9.8,
    RELOAD_DURATION: 1.35, AUTO_RELOAD_DELAY: 1.4, FIRE_COOLDOWN: 0.3, MAX_FLYING: 8, MAX_STUCK: 200, STUCK_BURY: 0.08,
    BOLT_RADIUS: 0.03, MAX_TRACERS: 8, TRACER_POINTS: 2048, TRACER_LIFE: 6, TRACER_FADE: 1.5, TRACER_WIDTH: 8,
    FOV_HIP: 72, FOV_ADS: 58, KICK_PITCH: rad(0.8), ADS_EYE_ABOVE_RAIL: 0.056 }],
  ['src/engine/player/Rifle.ts', { MAGAZINE: 30, RESERVE_START: 90, FIRE_INTERVAL: 0.09, RELOAD_TIME: 1.6, AUTO_RELOAD_DELAY: 0.35,
    DAMAGE_SCALE: 0.55, HITSCAN_RANGE: 300, KICK_PITCH: rad(0.35), BRASS_COUNT: 3, BRASS_LIFE: 1.4, TRACER_COUNT: 3,
    TRACER_TIME: 0.09, TRACER_WIDTH: 3, SIGHT_Y: 0.064, REAR_Z: 0.1, FRONT_Z: -0.455, MUZZLE_Z: -0.645 }],
  ['src/shards/pine-hollow/weapons/LeverRifle.ts', { TUBE_MAX: 6, RESERVE_START: 21, CYCLE_DELAY: 0.12, LEVER_TIME: 0.56,
    ROUND_TIME: 0.4, RELOAD_IN: 0.22, RELOAD_OUT: 0.2, AUTO_RELOAD_DELAY: 0.35, DAMAGE_SCALE: 1.5,
    HITSCAN_RANGE: 320, KICK_PITCH: rad(1.25), BRASS_COUNT: 4, BRASS_LIFE: 1.8, TRACER_COUNT: 2, TRACER_TIME: 0.09,
    SIGHT_Y: 0.045, REAR_Z: -0.13, FRONT_Z: -0.512, MUZZLE_Z: -0.535 }],
  ['src/shards/nalati-grasslands/weapons/GoldenBow.ts', { STREAK_PTS: 48, SPEED_BASE: 30, SPEED_DRAW: 28, SUN_DRAW: 0.95 }],
  ['src/shards/nalati-grasslands/weapons/Naizagai.ts', { CRESCENT_RANGE: 15, CRESCENT_DMG: 40, CRESCENT_T: 0.32, ARC_R: 6,
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
