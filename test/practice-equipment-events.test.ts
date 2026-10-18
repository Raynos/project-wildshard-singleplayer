import { expect, test, vi } from 'vitest';
import { Group, Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { Weapon } from '../src/engine/combat/Weapon';
import { SWORD_WOOD, SWORD_IRON } from '../src/game/weapons/starterMeleeProfile';

class TestWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  tryFire(): void { this.onFire?.(); }
  update(): void { /* This fixture only publishes existing equipment boundaries. */ }
}

test('bout equipment events stay local while hit feedback remains available and disposal restores world publication', () => {
  const owner = new Scope('world'), bout = owner.child('bout'), world = new Events(), local = new Events();
  const weapon = new TestWeapon(SWORD_WOOD), equipment = new EquipmentService(weapon, { scope: owner, events: world });
  const worldCharge = vi.fn<() => void>(), localCharge = vi.fn<() => void>();
  world.on('weapon.charge', worldCharge, owner); local.on('weapon.charge', localCharge, bout);
  const worldFire = vi.fn<() => void>(), worldHit = vi.fn<() => void>(), localFire = vi.fn<() => void>(), localHit = vi.fn<() => void>(), feedback = vi.fn<() => void>();
  world.on('weapon.fired', worldFire, owner); world.on('weapon.hit', worldHit, owner);
  local.on('weapon.fired', localFire, bout); local.on('weapon.hit', localHit, bout);
  equipment.onHit = feedback;
  equipment.routeEvents(bout, local);
  weapon.chargeEvent('heavy'); weapon.tryFire(); weapon.onHit?.('brine-puffer', false, true); weapon.onImpact?.('flesh', new Vector3());
  world.flush('update'); local.flush('update');
  expect(worldCharge).not.toHaveBeenCalled(); expect(localCharge).toHaveBeenCalledOnce();
  expect(worldFire).not.toHaveBeenCalled(); expect(worldHit).not.toHaveBeenCalled();
  expect(localFire).toHaveBeenCalledOnce(); expect(localHit).toHaveBeenCalledOnce(); expect(feedback).toHaveBeenCalledOnce();
  bout.dispose(); weapon.tryFire(); world.flush('update'); expect(worldFire).toHaveBeenCalledOnce();
  expect(() => equipment.routeEvents(bout, local)).toThrow('retired'); owner.dispose();
});

test('disposing an older route does not displace a newer encounter owner', () => {
  const owner = new Scope('world'), first = owner.child('first'), second = owner.child('second');
  const world = new Events(), older = new Events(), newer = new Events(), weapon = new TestWeapon(SWORD_WOOD);
  const equipment = new EquipmentService(weapon, { scope: owner, events: world }), hit = vi.fn<() => void>();
  newer.on('weapon.fired', hit, second);
  equipment.routeEvents(first, older); equipment.routeEvents(second, newer); first.dispose();
  weapon.tryFire(); newer.flush('update'); expect(hit).toHaveBeenCalledOnce(); owner.dispose();
});


test('routing covers loan unlocks and restoration before returning publications to the world', () => {
  const owner = new Scope('world'), room = owner.child('room'), world = new Events(), local = new Events();
  const wood = new TestWeapon(SWORD_WOOD), iron = new TestWeapon(SWORD_IRON);
  const equipment = new EquipmentService(wood, { scope: owner, events: world });
  equipment.add(iron, { locked: true });
  const worldUnlock = vi.fn<() => void>(), localUnlock = vi.fn<() => void>();
  world.on('weapon.unlocked', worldUnlock, owner); local.on('weapon.unlocked', localUnlock, room);
  equipment.routeEvents(room, local); equipment.lendAll(); world.flush('update'); local.flush('update');
  expect(localUnlock).toHaveBeenCalledOnce(); expect(worldUnlock).not.toHaveBeenCalled();
  expect(equipment.available).toHaveLength(2);
  equipment.endLoan(); expect(equipment.available).toHaveLength(1); room.dispose();
  equipment.unlock(iron.id); world.flush('update'); expect(worldUnlock).toHaveBeenCalledOnce(); owner.dispose();
});
