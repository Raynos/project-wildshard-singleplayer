import { expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import { Tool } from '../src/engine/combat/Tool';
import { EmptyEquipment } from '../src/game/shardfile/emptyEquipment';
import { EnteredEquipment } from '../src/game/grid/enteredEquipment';

class PlatformTool extends Tool {
  readonly id = 'tool.hoverboard';
  readonly slot = 'tool';
  readonly actions = [];
  enabled = true;
  holster = 0;
  override update = vi.fn((): void => undefined);
  constructor() {
    super({ id: 'tool.hoverboard', ui: { name: 'Board', icon: 'you', touch: 'melee', lockOn: false,
      melee: false, tracers: false, swapIcon: '' }, meta: { name: 'Board', icon: 'you', blurb: '', category: 'tool' } });
  }
}

it('keeps one controls reference across two kits, restores callbacks and ticks each owner once', () => {
  const page = new Scope('page'), road = new EquipmentService(new EmptyEquipment(), { scope: page });
  const tool = new PlatformTool(); road.add(tool, { locked: false });
  const binding = new EnteredEquipment(road), controls = binding.service;
  const pageFire = vi.fn((): void => undefined), pageHit = vi.fn((): void => undefined);
  controls.onFire = pageFire; controls.onHit = pageHit;
  const roadUpdate = vi.spyOn(road, 'update');
  for (const ammo of [7, 3]) {
    const resident = page.child(`resident.${ammo}`), entry = resident.child('entered');
    const weapon = new EmptyEquipment(), kit = new EquipmentService(weapon, { scope: resident });
    weapon.state.ammo = ammo;
    const fire = vi.spyOn(weapon, 'tryFire'), reload = vi.spyOn(weapon, 'reload');
    const authoredFire = vi.fn((): void => undefined); kit.onFire = authoredFire;
    const prior = Object.getOwnPropertyDescriptors(kit), weaponUpdate = vi.spyOn(weapon, 'update');
    binding.bind(kit, entry);
    expect(controls.current).toBe(weapon); expect(controls.state.ammo).toBe(ammo);
    expect(controls.has('tool.hoverboard')).toBe(true); expect(controls.tools).toEqual([tool]);
    controls.tryFire(); controls.reload(); expect(fire).toHaveBeenCalledOnce(); expect(reload).toHaveBeenCalledOnce();
    weapon.onFire?.(); weapon.onHit?.('boar', false, false);
    expect(authoredFire).toHaveBeenCalledOnce();
    expect(pageFire).toHaveBeenCalledTimes(ammo === 7 ? 1 : 2);
    expect(pageHit).toHaveBeenCalledTimes(ammo === 7 ? 1 : 2);
    controls.enabled = false; expect(kit.enabled).toBe(false); expect(tool.enabled).toBe(false);
    controls.setEnabled(true); expect(kit.enabled).toBe(true); expect(tool.enabled).toBe(true);
    controls.adsHeld = true; controls.altHeld = true; expect(kit.adsHeld).toBe(true); expect(kit.altHeld).toBe(true);
    controls.update(1 / 60, 1); expect(weaponUpdate).not.toHaveBeenCalled();
    kit.update(1 / 60, 1); expect(weaponUpdate).toHaveBeenCalledOnce();
    const lateFire = kit.onFire;
    entry.dispose();
    lateFire(); expect(authoredFire).toHaveBeenCalledOnce();
    expect(controls.current).toBe(road.current); expect(controls.adsHeld).toBe(false); expect(controls.altHeld).toBe(false);
    for (const key of ['onFire', 'onHit', 'onImpact', 'onReloadStart', 'onReloadEnd', 'onDry', 'onSwap', 'onUnlock']) {
      expect(Object.getOwnPropertyDescriptor(kit, key)).toEqual(prior[key]);
    }
    weapon.onFire?.(); expect(authoredFire).toHaveBeenCalledTimes(2);
    expect(pageFire).toHaveBeenCalledTimes(ammo === 7 ? 1 : 2);
    resident.dispose();
  }
  expect(roadUpdate).toHaveBeenCalledTimes(2); expect(tool.update).toHaveBeenCalledTimes(2);
  expect(controls.onFire).toBe(pageFire); controls.tryFire(); expect(pageFire).toHaveBeenCalledTimes(2);
  page.dispose(); expect(page.census.resources).toBe(0);
});

it('refuses overlapping or disposed entries without changing the live controls target', () => {
  const page = new Scope('page'), road = new EquipmentService(new EmptyEquipment(), { scope: page });
  const kit = new EquipmentService(new EmptyEquipment(), { scope: page });
  const binding = new EnteredEquipment(road), first = page.child('first'), other = page.child('other');
  binding.bind(kit, first);
  expect(() => binding.bind(kit, other)).toThrow('not available');
  expect(binding.service.current).toBe(kit.current);
  first.dispose(); other.dispose();
  expect(() => binding.bind(kit, other)).toThrow('not available');
  expect(binding.service.current).toBe(road.current); page.dispose();
});
