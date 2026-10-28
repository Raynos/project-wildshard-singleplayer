// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Group } from 'three';
import { Scope } from '../src/engine/app/scope';
import { EquipmentService } from '../src/engine/combat/EquipmentService';
import type { EquipmentRow, WeaponId } from '../src/engine/combat/Equipment';
import { Weapon } from '../src/engine/combat/Weapon';
import { WeaponStrip } from '../src/engine/ui/WeaponStrip';
import { WeaponStrip as Before } from '../src/engine/test/weapon-strip-before';
import { SWORD_WOOD } from '../src/game/weapons/starterMeleeProfile';

type Slot = 'sword' | 'bow' | 'spear' | 'sabre';
const row = (slot: Slot): EquipmentRow => ({ ...SWORD_WOOD, id: `weapon.${slot}`, legacySlot: slot,
  ui: { ...SWORD_WOOD.ui, name: slot, swapName: slot } });
class NativeWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: 3, magazine: 3, reserve: 9, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  tryFire(): void { this.state.ammo--; }
  update(): void { /* The original service owns selection and live state. */ }
}

for (const touch of [false, true]) test(`original ${touch ? 'touch ring' : 'desktop strip'} DOM and live ordering remain exact`, () => {
  function fixture(Strip: new (service: EquipmentService) => Pick<WeaponStrip, 'el' | 'scope' | 'update'>) {
    const host = document.createElement('div'); host.id = 'hud';
    if (touch) { host.className = 'touch'; const layer = document.createElement('div'); layer.className = 'ws-touch'; host.append(layer); }
    document.body.append(host);
    const scope = new Scope('strip-values'), order: WeaponId[] = ['spear', 'sword', 'bow'];
    const first = new NativeWeapon(row('sword')), bow = new NativeWeapon(row('bow')), spear = new NativeWeapon(row('spear'));
    const service = new EquipmentService(first, { scope, order });
    service.add(bow, { locked: true }); service.add(spear, { locked: false });
    const strip = new Strip(service); host.removeAttribute('id');
    return { host, scope, order, service, strip };
  }
  const old = fixture(Before), now = fixture(WeaponStrip), scratch: Weapon[] = [];
  try {
    for (let tick = 0; tick < 160; tick++) {
      for (const f of [old, now]) {
        if (tick === 16) f.service.add(new NativeWeapon(row('sabre')), { locked: false, order: 1 });
        if (tick === 43) f.service.replace('bow', new NativeWeapon(row('bow')));
        if (tick % 17 === 0) f.service.unlock('bow');
        if (tick % 31 === 0) f.service.lendAll();
        if (tick % 37 === 0) f.service.endLoan();
        if (tick % 11 === 0) f.order.reverse();
        if (tick === 71) f.order.splice(0, f.order.length, 'spear');
        if (tick === 91) f.service.list.reverse();
        const available = f.service.available, next = available[tick % available.length];
        if (next === undefined) throw new Error('Missing actual available weapon');
        f.service.select(next.id, true);
        for (const weapon of f.service.list) weapon.state.ammo = tick % 5;
        f.strip.update();
      }
      expect(now.host.innerHTML).toBe(old.host.innerHTML);
      expect(now.service.current.id).toBe(old.service.current.id);
      expect(now.service.availableInto(scratch)).toBe(scratch);
      expect(scratch).toEqual(now.service.available);
    }
    const first = now.strip.el.firstElementChild, stable = now.host.innerHTML;
    for (let tick = 0; tick < 128; tick++) { old.strip.update(); now.strip.update(); }
    expect(now.strip.el.firstElementChild).toBe(first);
    expect(now.host.innerHTML).toBe(stable); expect(now.host.innerHTML).toBe(old.host.innerHTML);
    const installed = [...now.service.list];
    expect(() => now.service.availableInto(now.service.list)).toThrow('Available equipment target must not be the installed list');
    expect(now.service.list).toEqual(installed);
    const detached = now.service.available; detached.length = 0;
    expect(now.service.available).toEqual(scratch);
  } finally {
    old.strip.scope.dispose(); now.strip.scope.dispose(); old.scope.dispose(); now.scope.dispose(); old.host.remove(); now.host.remove();
  }
});
