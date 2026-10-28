import { expect, test, vi } from 'vitest';
import { Group } from 'three';
import { Scope } from '@wildshard/engine/app/scope';
import { Weapon } from '@wildshard/engine/combat/Weapon';
import { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import { SWORD_WOOD } from '../weapons/starterMeleeProfile';

type Slot = 'sword' | 'bow' | 'spear';
const row = (slot: Slot): EquipmentRow => ({ ...SWORD_WOOD, id: `weapon.${slot}`, legacySlot: slot });
class NativeWeapon extends Weapon {
  readonly model = new Group();
  readonly state = { ammo: 3, magazine: 3, reserve: 9, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  tryFire(): void { this.state.ammo--; }
  update(): void { /* The service retains the same native state and owner. */ }
}
function gate() {
  let release: () => void = () => { throw new Error('Missing gate'); };
  let refuse: (reason: unknown) => void = () => { throw new Error('Missing gate'); };
  const pending = new Promise<void>((resolve, reject) => { release = resolve; refuse = reject; });
  return { pending, release, refuse };
}
function fixture() {
  const scope = new Scope('equipment-preparation'), first = new NativeWeapon(row('sword')), next = new NativeWeapon(row('bow')), last = new NativeWeapon(row('spear'));
  const service = new EquipmentService(first, { scope });
  service.add(next, { locked: false }); service.add(last, { locked: false });
  return { scope, first, next, last, service };
}

test('ordinary selection remains synchronous without a preparation port', () => {
  const f = fixture();
  try { f.service.select('bow', true); expect(f.service.current).toBe(f.next); expect(f.next.enabled).toBe(true); expect(f.first.enabled).toBe(false); }
  finally { f.scope.dispose(); }
});

test('a late view starts only on demand and keeps the original weapon active until ready', async () => {
  const f = fixture(), read = gate(), prepare = vi.fn(() => read.pending), original = f.next.state;
  f.service.prepareOnSelect('bow', prepare);
  try {
    expect(prepare).not.toHaveBeenCalled(); f.service.select('bow', true);
    const settled = vi.fn(), pending = (async () => { await f.service.settleSelection(); settled(); })();
    await Promise.resolve(); expect(prepare).toHaveBeenCalledOnce(); expect(settled).not.toHaveBeenCalled();
    expect(f.service.current).toBe(f.first); expect(f.first.enabled).toBe(true); expect(f.first.model.visible).toBe(true); expect(f.next.enabled).toBe(false);
    read.release(); await pending;
    expect(f.service.current).toBe(f.next); expect(f.next.state).toBe(original); expect(f.next.state.ammo).toBe(3); expect(f.next.model.visible).toBe(true);
    f.service.select('sword', true); f.service.select('bow', true); expect(f.service.current).toBe(f.next); expect(prepare).toHaveBeenCalledOnce();
  } finally { read.release(); f.scope.dispose(); }
});

test('duplicate pending selection joins one read and preserves an instant restore request', async () => {
  const f = fixture(), read = gate(), prepare = vi.fn(() => read.pending);
  f.service.prepareOnSelect('bow', prepare);
  try {
    f.service.select('bow'); f.service.select('bow', true); await Promise.resolve(); expect(prepare).toHaveBeenCalledOnce();
    read.release(); await f.service.settleSelection();
    expect(f.service.current).toBe(f.next); expect(f.service.swappingNow).toBe(false);
  } finally { read.release(); f.scope.dispose(); }
});

test('redirects settle the latest target without waiting for an obsolete read', async () => {
  const f = fixture(), slow = gate(), fresh = gate();
  f.service.prepareOnSelect('bow', () => slow.pending); f.service.prepareOnSelect('spear', () => fresh.pending);
  try {
    f.service.select('bow', true); const pending = f.service.settleSelection();
    f.service.step(1); expect(f.service.current).toBe(f.first);
    fresh.release(); await pending; f.service.update(1, 1);
    expect(f.service.current).toBe(f.last); slow.refuse(new Error('Retired request')); await Promise.resolve();
    expect(f.service.current).toBe(f.last);
  } finally { slow.release(); fresh.release(); f.scope.dispose(); }
});

test('cancelling back to the current weapon never activates the late old result', async () => {
  const f = fixture(), read = gate(); f.service.prepareOnSelect('bow', () => read.pending);
  try {
    f.service.select('bow', true); const pending = f.service.settleSelection(); f.service.select('sword', true); await pending;
    read.release(); await Promise.resolve(); await Promise.resolve(); expect(f.service.current).toBe(f.first);
  } finally { read.release(); f.scope.dispose(); }
});

test('a genuine preparation refusal retains the current weapon and rejects restored readiness', async () => {
  const f = fixture(), read = gate(), failure = new Error('Exact asset refusal'), log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let failed = true; const prepare = vi.fn(() => failed ? read.pending : Promise.resolve());
  f.service.prepareOnSelect('bow', prepare);
  try {
    f.service.select('bow', true); const pending = f.service.settleSelection(); read.refuse(failure);
    await expect(pending).rejects.toBe(failure); expect(f.service.current).toBe(f.first); expect(f.first.enabled).toBe(true);
    failed = false; f.service.select('bow', true); await f.service.settleSelection(); expect(f.service.current).toBe(f.next); expect(prepare).toHaveBeenCalledTimes(2);
  } finally { log.mockRestore(); f.scope.dispose(); }
});

test('retirement before a request starts performs no IO and refuses readiness', async () => {
  const f = fixture(), prepare = vi.fn(() => Promise.resolve()); f.service.prepareOnSelect('bow', prepare);
  f.service.select('bow', true); f.scope.dispose();
  await expect(f.service.settleSelection()).rejects.toThrow('owner left'); await Promise.resolve(); expect(prepare).not.toHaveBeenCalled();
});

test('retirement during IO settles readiness before that read finishes and cannot publish later', async () => {
  const f = fixture(), read = gate(); f.service.prepareOnSelect('bow', () => read.pending);
  f.service.select('bow', true); await Promise.resolve(); const pending = f.service.settleSelection(); f.scope.dispose();
  await expect(pending).rejects.toThrow('owner left'); read.release(); await Promise.resolve(); expect(f.service.current).toBe(f.first);
});

test('a replaced target cannot publish its stale preparation', async () => {
  const f = fixture(), read = gate(); f.service.prepareOnSelect('bow', () => read.pending);
  try {
    f.service.select('bow', true); const pending = f.service.settleSelection();
    const replacement = new NativeWeapon(row('bow')); f.service.replace('bow', replacement); await pending;
    read.release(); await Promise.resolve(); expect(f.service.current).toBe(f.first); expect(f.service.get('bow')).toBe(replacement);
  } finally { read.release(); f.scope.dispose(); }
});

test('loan revocation cancels an unowned pending target without altering the retained loadout', async () => {
  const scope = new Scope('loan-preparation'), first = new NativeWeapon(row('sword')), next = new NativeWeapon(row('bow')), service = new EquipmentService(first, { scope }), read = gate();
  service.add(next, { locked: true }); service.prepareOnSelect('bow', () => read.pending);
  try {
    service.select('bow', true); expect(service.current).toBe(first);
    service.lendAll(); service.select('bow', true); const pending = service.settleSelection(); service.endLoan(); await pending;
    read.release(); await Promise.resolve(); expect(service.current).toBe(first); expect(service.has('bow')).toBe(false);
  } finally { read.release(); scope.dispose(); }
});

test('initial, duplicate and closed preparation declarations refuse', () => {
  const f = fixture();
  try {
    expect(() => f.service.prepareOnSelect('sword', () => Promise.resolve())).toThrow('before publication');
    f.service.prepareOnSelect('bow', () => Promise.resolve());
    expect(() => f.service.prepareOnSelect('bow', () => Promise.resolve())).toThrow('already registered');
    f.scope.dispose(); expect(() => f.service.prepareOnSelect('spear', () => Promise.resolve())).toThrow('owner left');
  } finally { f.scope.dispose(); }
});
