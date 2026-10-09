import * as THREE from 'three';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { app } from '../src/engine/app/runtime';
import type { EquipmentService } from '../src/engine/combat/EquipmentService';
import { FlightMotion, type SpeciesFlight } from '../src/engine/ai/flight';
import { lockOn, setAimTargets, targetRadius } from '../src/engine/player/AimTargets';
import { aimPoint, LOCK, LockOnSystem, wrapAngle } from '../src/engine/player/LockOnTarget';
import { LockOn } from '../src/engine/ui/LockOn';
import { Physics } from '../src/engine/physics/Physics';
import { setActivePhysics } from '../src/engine/physics/active';
import { loadRapier } from '../src/engine/physics/rapier';
import { groups } from '../src/engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { creature } from './fake/creature';
import { fakeWorld } from './fake/world';
import { legacyDouble } from './fake/FakeGame';
import { SWORD } from '../src/game/weapons/starterEquipment';

const flight: SpeciesFlight = { altitude: 20, above: 'world', climbRate: 7, diveRate: 28 };
const previousScope = app.levelScope;
let physics: Physics | null = null;
let R: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
beforeEach(() => {
  const dom = new Window({ width: 390, height: 844 });
  vi.stubGlobal('window', dom); vi.stubGlobal('document', dom.document);
  vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844);
  app.levelScope = app.engineScope.child('lock-flight-test');
  document.body.innerHTML = '<div id="hud"></div>';
  Object.assign(lockOn, { state: 'off', target: null, candidate: null, offYaw: 0, offPitch: 0 });
  setActivePhysics(null);
});
afterEach(() => {
  app.levelScope?.dispose(); app.levelScope = previousScope;
  setAimTargets([]); setActivePhysics(null); physics?.dispose(); physics = null;
  Object.assign(lockOn, { state: 'off', target: null, candidate: null });
  for (const key of ['window', 'document', 'innerWidth', 'innerHeight']) Reflect.deleteProperty(globalThis, key);
});

function fixture(spec: SpeciesFlight | null = flight) {
  const { animal } = creature('crab', 'small', {}, spec ?? undefined);
  // An authored species kind outside the original lock allowlist, using a real Animal flight body.
  if (spec !== null) animal.kind = 'fixture-flyer';
  const f = fakeWorld(), p = f.player;
  p.camera = f.game.camera; p.camera.position.set(0, 1.6, 0);
  p.preUpdate = () => undefined; p.swimming = false; p.hover = false;
  const equipment = legacyDouble<EquipmentService>({ enabled: true, current: legacyDouble<EquipmentService['current']>({ row: SWORD }) });
  const system = new LockOnSystem(p, equipment, p.camera);
  setAimTargets([animal]);
  const poseCamera = (): void => { p.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ'); p.camera.updateMatrixWorld(); };
  const face = (): void => {
    const at = aimPoint(animal, new THREE.Vector3()).sub(p.camera.position);
    p.yaw = Math.atan2(-at.x, -at.z); p.pitch = Math.atan2(at.y, Math.hypot(at.x, at.z));
    poseCamera();
  };
  const tick = (dt = 1 / 60): void => { p.preUpdate?.(dt); poseCamera(); };
  return { animal, p, system, face, tick };
}

describe('flight-body lock-on', () => {
  it('locks an unknown flying species well above the horizon beyond the ground range', () => {
    const f = fixture(); f.animal.place(0, -8, 0, 21); f.face();
    expect(f.p.pitch).toBeGreaterThan(60 * Math.PI / 180);
    expect(f.system.hasTarget()).toBe(true); f.system.resolveToggle();
    expect(lockOn.target).toBe(f.animal); expect(lockOn.state).toBe('locked');
    expect(f.animal.flying).toBe(true);
  });
  it('measures the aim cone in 3-D instead of accepting everything on the same yaw', () => {
    const f = fixture(); f.animal.place(0, -8, 0, 21);
    expect(f.system.hasTarget()).toBe(false);
    f.face(); expect(f.system.hasTarget()).toBe(true);
  });
  it('uses true 3-D acquire and release distances, with the 1.5× release margin', () => {
    const f = fixture(); f.animal.place(0, -2, 0, 40); f.face();
    expect(f.system.hasTarget()).toBe(false); // horizontally close, vertically too far
    f.animal.place(0, -20, 0, 1.6); f.face(); f.system.resolveToggle();
    expect(lockOn.state).toBe('locked');
    f.animal.place(0, -30, 0, 1.6); f.tick(); expect(lockOn.state).toBe('locked');
    f.animal.place(0, -2, 0, 40); f.tick(); expect(lockOn.state).toBe('off');
  });
  it('reads the range override from the species flight block', () => {
    const f = fixture({ ...flight, lockRange: 36 }); f.animal.place(0, -30, 0, 1.6); f.face();
    expect(f.animal.lockRange).toBe(36); f.system.resolveToggle(); expect(lockOn.state).toBe('locked');
    f.animal.place(0, -45, 0, 1.6); f.tick(); expect(lockOn.state).toBe('locked');
    f.animal.place(0, -56, 0, 1.6); f.tick(); expect(lockOn.state).toBe('off');
  });
  it.each([0, -1, Infinity, Number.NaN])('rejects invalid species lock range %s', (range) => {
    expect(() => new FlightMotion({ ...flight, lockRange: range })).toThrow('lock range');
  });
  it('tests elevated WORLD cover and retains the lock only within LOS grace', () => {
    const f = fixture(); f.animal.place(0, -10, 0, 15); f.face();
    physics = new Physics(R);
    Object.assign(f.p.motor, { collider: physics.world.createCollider(R.ColliderDesc.ball(0.3).setTranslation(0, 1.6, 0)) });
    const wall = physics.world.createCollider(R.ColliderDesc.cuboid(3, 3, 0.2).setTranslation(0, 8, -5).setCollisionGroups(groups('WORLD')));
    physics.step(); setActivePhysics(physics); expect(f.system.hasTarget()).toBe(false);
    physics.world.removeCollider(wall, true); physics.step(); f.system.resolveToggle();
    expect(lockOn.state).toBe('locked');
    physics.world.createCollider(R.ColliderDesc.cuboid(3, 3, 0.2).setTranslation(0, 8, -5).setCollisionGroups(groups('WORLD')));
    physics.step(); f.tick(0.5); expect(lockOn.state).toBe('locked');
    f.tick(0.6); expect(lockOn.state).toBe('off');
  });
  it('tracks a dive and overhead pass with capped camera motion and a reticle on the live body', () => {
    const f = fixture(); f.animal.place(0, -10, 0, 20); f.face(); f.system.resolveToggle();
    const ui = new LockOn(f.p.camera);
    let peak = 0;
    for (let i = 0; i < 180; i++) {
      // Climb above the old pitch clamp, then dive past the eye and cross its heading.
      const z = i < 60 ? -10 : -10 + (i - 60) * 0.15;
      const y = i < 60 ? 20 : 20 - (i - 60) * 0.14;
      f.animal.place(0, z, 0, y);
      const yaw = f.p.yaw, pitch = f.p.pitch; f.tick();
      expect(Math.abs(wrapAngle(f.p.yaw - yaw))).toBeLessThanOrEqual(LOCK.ENGAGE_CAP * 0.5 / 60 + 1e-12);
      expect(Math.abs(f.p.pitch - pitch)).toBeLessThanOrEqual(LOCK.ENGAGE_CAP * 0.5 / 60 + 1e-12);
      peak = Math.max(peak, f.p.pitch);
      expect(lockOn.target).toBe(f.animal); ui.update();
      const body = aimPoint(f.animal, new THREE.Vector3()).project(f.p.camera);
      const el = document.querySelector<HTMLElement>('.ws-game-lock');
      if (el === null) throw new Error('reticle missing');
      if (body.z >= -1 && body.z <= 1) {
        expect(el.classList.contains('show')).toBe(true);
        const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(el.style.transform);
        if (match === null) throw new Error('reticle not placed');
        expect(Number(match[1]) + Number.parseFloat(el.style.width) / 2).toBeCloseTo(Math.round((body.x + 1) / 2 * innerWidth), 0);
        expect(Number(match[2]) + Number.parseFloat(el.style.height) / 2).toBeCloseTo(Math.round((1 - body.y) / 2 * innerHeight), 0);
      }
    }
    expect(peak).toBeGreaterThan(LOCK.PITCH_MAX); ui.scope.dispose();
  });
  it('keeps heading finite for a target directly overhead', () => {
    const f = fixture(); f.animal.place(0, 0, 0, 20); f.p.pitch = LOCK.FLY_PITCH;
    f.system.resolveToggle(); f.tick();
    expect(lockOn.state).toBe('locked'); expect(f.p.yaw).toBe(0); expect(Number.isFinite(f.p.pitch)).toBe(true);
  });
  it('keeps ground range, horizontal distance, kind eligibility and pitch clamp unchanged', () => {
    const f = fixture(null); expect(f.animal.flying).toBe(false); expect(f.animal.lockRange).toBeUndefined();
    f.animal.place(0, -14, 0, 0); f.face(); expect(f.system.hasTarget()).toBe(false);
    f.animal.place(0, -10, 0, 20); f.face(); f.system.resolveToggle();
    expect(lockOn.state).toBe('locked'); // ground targets keep horizontal range even at an authored elevation
    for (let i = 0; i < 180; i++) f.tick();
    expect(f.p.pitch).toBeLessThanOrEqual(LOCK.PITCH_MAX + LOCK.DEAD + 0.001);
    f.animal.position.z = -(LOCK.BREAK + targetRadius(f.animal) + 0.01); f.tick(); expect(lockOn.state).toBe('off');
    f.animal.place(0, -5, 0, 0); f.face();
    setAimTargets([{ kind: 'fixture-ground', alive: true, position: f.animal.position }]);
    expect(f.system.hasTarget()).toBe(false);
  });
});
