import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import type { TargetHit } from '../../src/engine/combat/types';
import { Melee } from '../../src/engine/combat/Melee';
import { SWORD_WOOD } from '../../src/game/weapons/starterMeleeProfile';
import { Thrown } from '../../src/engine/combat/Thrown';
import { Sabre, PASS_RIGHT, SABRE_PROFILE } from '../../src/shards/nalati-grasslands/runtime/weapons/Sabre';
import { Spear, JAVELIN, SPEAR_PROFILE } from '../../src/shards/nalati-grasslands/runtime/weapons/Spear';
import { Naizagai, NaizagaiPower, NAIZAGAI_PROFILE } from '../../src/shards/nalati-grasslands/runtime/weapons/Naizagai';
import { buildNalatiLoadout } from '../../src/shards/nalati-grasslands/weapons/loadout';
import { GoldenBow, GoldenBowPower } from '../../src/shards/nalati-grasslands/runtime/weapons/GoldenBow';
import { fakeWorld } from '../fake/world';
import { manager } from '../fake/manager';

beforeEach(() => { vi.stubGlobal('document', new EventTarget()); vi.stubGlobal('window', new EventTarget()); });
afterEach(() => { Reflect.deleteProperty(globalThis, 'document'); Reflect.deleteProperty(globalThis, 'window'); });
function world() {
  const f = fakeWorld(); return { ...f, world: { game: f.game.asGame(), sky: f.sky, player: f.player, forest: f.forest } };
}
class PassSabre extends Sabre {
  recordPass(): void { this.onMoveHit(PASS_RIGHT); }
}
describe('Melee content and reward replacement', () => {
  it('replaces the golden bow once, keeps its quiver, saddle data and source multiplier', () => {
    const f = world(), kit = buildNalatiLoadout(f.world, { raycast: () => null }, true);
    const scope = new Scope('golden-replacement'), service = new EquipmentService(kit.base, { scope });
    for (const weapon of kit.extras) service.add(weapon, { locked: false });
    kit.install(service); kit.bow.state.bolts = 7; kit.bow.damageMultiplier = () => 2;
    kit.setMount({ speed: 12, yaw: 0.4 });
    const previous = kit.bow;
    const power = new GoldenBowPower({ scene: f.game.scene, sky: f.sky, camera: f.game.camera, raycast: () => null });
    kit.upgradeBow(service, power); kit.upgradeBow(service, power);
    expect(kit.bow).toBeInstanceOf(GoldenBow); expect(service.current).toBe(kit.bow);
    expect(kit.bow.state.bolts).toBe(7); expect(kit.bow.drawSpeedScale).toBe(1.2);
    expect(kit.bow.carrierVelocity.toArray()).toEqual(previous.carrierVelocity.toArray());
    expect(previous.model.parent).toBeNull(); expect(service.available).toHaveLength(3);
    const hit = { animal: { kind: 'boar' } } as TargetHit;
    expect(kit.bow.damageMultiplier(hit)).toBe(2);
    kit.setMount(null); expect(kit.bow.carrierVelocity.length()).toBe(0); expect(kit.bow.drawSpeedScale).toBe(1.2);
    scope.dispose();
  });
  it('preserves the sabre slot, held model, ownership, heavy perk and pass clock', () => {
    const f = world(), original = new PassSabre(f.world), scope = new Scope('replacement');
    const service = new EquipmentService(original, { scope, events: app.events });
    original.mount = { speed: 12, yaw: 0 }; original.heavyMult = 1.4; original.recordPass();
    original.update(0.2, 0.2);
    const listeners = scope.census.listeners;
    const power = new NaizagaiPower({ scene: f.game.scene, player: f.player, camera: f.game.camera,
      animals: manager().manager, storm: () => false });
    const worldRoots = f.game.scene.children.length;
    const upgraded = new Naizagai(f.world, { raycast: () => null }, { power }); upgraded.carryPassState(original);
    service.replace(original.id, upgraded);
    expect(upgraded).toBeInstanceOf(Sabre); expect(upgraded).toBeInstanceOf(Melee);
    expect(service.current).toBe(upgraded); expect(service.available).toEqual([upgraded]);
    expect(upgraded.row.id).toBe('weapon.naizagai'); expect(upgraded.id).toBe('sabre'); expect(service.has('sabre')).toBe(true);
    expect(upgraded.heavyMult).toBe(1.4); expect(upgraded.passChain).toBe(1); expect(upgraded.passChainLeft).toBeCloseTo(2.8);
    expect(upgraded.mount).toBe(original.mount); expect(upgraded.model.visible).toBe(true); expect(original.model.parent).toBeNull();
    expect(scope.census.listeners).toBe(listeners);
    expect(f.game.scene.children).toHaveLength(worldRoots); // the outgoing sword's world stars leave with its owner
    const swing = vi.spyOn(power, 'onSwingStart'); upgraded.tryFire(); expect(swing).toHaveBeenCalledOnce();
    scope.dispose(); expect(scope.census.listeners).toBe(0); expect(upgraded.model.parent).toBeNull();
  });
  it('the kit changes its live mounted reference once and keeps all three javelins', () => {
    const f = world(), kit = buildNalatiLoadout(f.world, { raycast: () => null }, true);
    const scope = new Scope('kit'), service = new EquipmentService(kit.base, { scope });
    const original = kit.sabre;
    const power = new NaizagaiPower({ scene: f.game.scene, player: f.player, camera: f.game.camera,
      animals: manager().manager, storm: () => false });
    kit.upgradeSabre(service, power); kit.upgradeSabre(service, power);
    const mounted = { speed: 13, yaw: 0.4 }; kit.setMount(mounted);
    expect(kit.sabre).not.toBe(original); expect(kit.base).toBe(kit.sabre); expect(kit.sabre.mount).toBe(mounted);
    expect(kit.spear.javelins).toBe(3); expect(kit.spear.maxJavelins).toBe(3); expect(service.available).toHaveLength(1);
    scope.dispose();
  });
  it('three composed javelins exhaust on release and retain the frozen flight formula', () => {
    const helper = new Thrown(JAVELIN); expect([helper.release(), helper.release(), helper.release(), helper.release()]).toEqual([true, true, true, false]);
    expect(helper.ammo).toBe(0);
    const pos = new THREE.Vector3(), vel = new THREE.Vector3(0, 0, -28); helper.flightStep(pos, vel, 0.1);
    expect(pos.toArray()).toEqual([0, -0.09800000000000002, -2.8000000000000003]);
    expect([SPEAR_PROFILE.damage, JAVELIN.damage, JAVELIN.headMultiplier]).toEqual([30, 55, 2]);
  });
  it('the spear consumes the authored thrust damage and timing', () => {
    const f = world(), dealt: number[] = [];
    const animal = { damageFor: () => 1, kind: 'boar', alive: true, position: new THREE.Vector3(0, 0, -1), applyDamage: (amount: number) => { dealt.push(amount); return false; } };
    const hit: TargetHit = { animal, point: animal.position, distance: 1, headshot: false };
    const spear = new Spear(f.world, { raycast: () => hit }, { profile: { ...SPEAR_PROFILE,
      thrust: { ...SPEAR_PROFILE.thrust, damage: 37, windup: 0.05, total: 0.1 } } });
    spear.tryFire(); spear.update(0.05, 0.05); expect(dealt).toEqual([37]);
    spear.update(0.06, 0.11); expect(spear.thrusting).toBe(false);
  });
  it('authored rows retain separate feel, moves, powers and contact hit-stop', () => {
    expect(SABRE_PROFILE.moves).not.toBe(SWORD_WOOD.moves);
    expect([SWORD_WOOD.hitStop?.body, SABRE_PROFILE.hitStop?.body, SPEAR_PROFILE.hitStop?.body]).toEqual([0.06, 0.045, 0]);
    expect(SPEAR_PROFILE.feel).toEqual({ lag: { gain: 0.4, clampYaw: 0.1, clampPitch: 0.08, k: 200, c: 20, posYaw: 0.25, posPitch: 0.2 },
      bob: { x: 0.016, y: 0.013, rx: 0.01, rz: 0.015 }, sway: { ax: 0.003, fx: 0.7, ay: 0.0025, fy: 1.1 }, fovHip: 72 });
    expect(NAIZAGAI_PROFILE.powers).toEqual({ crescentRange: 15, crescentDamage: 40, crescentTime: 0.32, arcRadius: 6,
      gallopMin: 11, callRange: 25, callDamage: 60, callRadius: 3, callTime: 0.6, stormMultiplier: 1.25, stormArcs: 2, clearArcs: 1 });
  });
});
