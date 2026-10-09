import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/engine/app/runtime';
import type { SpeciesRow } from '../src/engine/ai/species';
import { Animal } from '../src/engine/entities/AnimalView';
import { AnimalFactory } from '../src/engine/entities/AnimalFactory';
import { speciesWithLook } from '../src/engine/entities/species/look';
import { speciesDef } from '../src/engine/entities/species/registry';
import type { EquipmentService } from '../src/engine/combat/EquipmentService';
import { lockOn, setAimTargets, type AimTarget } from '../src/engine/player/AimTargets';
import { LockOnSystem } from '../src/engine/player/LockOnTarget';
import { setActivePhysics } from '../src/engine/physics/active';
import { SWORD } from '../src/game/weapons/starterEquipment';
import { CRAB, CRAB_LOOK } from '../src/shards/driftwood-isle/species/crab';
import { fakeWorld } from './fake/world';
import { legacyDouble } from './fake/FakeGame';

const previousScope = app.levelScope;
beforeEach(() => {
  app.levelScope = app.engineScope.child('lock-species-test');
  Object.assign(lockOn, { state: 'off', target: null, candidate: null });
  setActivePhysics(null);
});
afterEach(() => {
  app.levelScope?.dispose(); app.levelScope = previousScope;
  setAimTargets([]); Object.assign(lockOn, { state: 'off', target: null, candidate: null });
});

function fixture() {
  const f = fakeWorld(), p = f.player;
  p.camera = f.game.camera; p.camera.position.set(0, 1.6, 0);
  p.preUpdate = () => undefined; p.swimming = false; p.hover = false;
  const equipment = legacyDouble<EquipmentService>({ enabled: true, current: legacyDouble<EquipmentService['current']>({ row: SWORD }) });
  const system = new LockOnSystem(p, equipment, p.camera);
  const factory = new AnimalFactory(f.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  const original = factory.model('crab', 'small');
  const animal = (row: SpeciesRow): Animal => {
    const model = { ...original, kind: row.kind, species: speciesWithLook(row, CRAB_LOOK) };
    const target = new Animal(factory.instantiate(model, 0.5), model, 0.5);
    target.place(0, -5, 0, 0); return target;
  };
  const acquire = (target: AimTarget): void => {
    setAimTargets([target]); system.resolveToggle();
    expect(lockOn.state).toBe('locked'); expect(lockOn.target).toBe(target);
  };
  return { animal, system, acquire };
}

describe('authored species lock eligibility (E384)', () => {
  const { lockable: _legacyLockable, ...base } = CRAB;
  const row: SpeciesRow = { ...base, id: 'fixture.species', kind: 'fixture-ground', aggressive: true };
  it('locks an authored ground species through its public row, independent of kind', () => {
    const f = fixture(), target = f.animal({ ...row, lockable: true });
    expect(target.lockable).toBe(true); f.acquire(target);
  });
  it('does not lock an omitted ground species, even when aggressive', () => {
    const f = fixture(), target = f.animal(row);
    expect(target.lockable).toBe(false); setAimTargets([target]); f.system.resolveToggle();
    expect(lockOn.state).toBe('off'); expect(lockOn.target).toBeNull();
  });
  it.each([false, true])('honours explicit lockable=%s on a flight species', (lockable) => {
    const f = fixture(), target = f.animal({ ...row, lockable, flight: { altitude: 1, above: 'world', climbRate: 7, diveRate: 28 } });
    expect(target.lockable).toBe(lockable); setAimTargets([target]); f.system.resolveToggle();
    expect(lockOn.state).toBe(lockable ? 'locked' : 'off');
  });
  it('keeps an omitted flight species lockable by default', () => {
    const f = fixture(), target = f.animal({ ...row, flight: { altitude: 1, above: 'world', climbRate: 7, diveRate: 28 } });
    expect(target.lockable).toBe(true); f.acquire(target);
  });
  it.each(['crab', 'boar', 'monkey', 'sailor', 'bear', 'captain', 'wolf', 'kokbori', 'leopard', 'eagle', 'ghost-rider', 'balbal', 'golden-king'])('keeps original %s lockable through its species declaration', (kind) => {
    const f = fixture(), def = speciesDef(kind);
    const target = f.animal({ ...def, id: `fixture.${kind}` });
    expect(def.lockable).toBe(true); f.acquire(target);
  });
  it.each(['deer', 'elk', 'horse', 'sheepdog'])('keeps original passive %s ineligible', (kind) => {
    const f = fixture(), target = f.animal({ ...speciesDef(kind), id: `fixture.${kind}` });
    expect(target.lockable).toBe(false); setAimTargets([target]); expect(f.system.hasTarget()).toBe(false);
  });
  it.each(['storm-titan', 'training-dummy'])('keeps synthetic %s lockable through the target field', (kind) => {
    fixture().acquire({ kind, lockable: true, alive: true, position: new THREE.Vector3(0, 0, -5) });
  });
  it('ignores dead and hidden targets even with an authored opt-in', () => {
    const f = fixture();
    for (const flags of [{ alive: false }, { alive: true, hidden: true }]) {
      setAimTargets([{ kind: 'fixture', lockable: true, position: new THREE.Vector3(0, 0, -5), ...flags }]);
      expect(f.system.hasTarget()).toBe(false);
    }
  });
});
