// @vitest-environment happy-dom
import { Group, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import type { EquipmentRow } from '../../src/engine/combat/Equipment';
import { EquipmentService } from '../../src/engine/combat/EquipmentService';
import { Weapon } from '../../src/engine/combat/Weapon';
import type { EquipmentPickup } from '../../src/engine/combat/EquipmentPickup';
import { SWORD_WOOD, SWORD_IRON } from '../../src/game/weapons/starterMeleeProfile';

class FixtureWeapon extends Weapon {
  readonly model = new Group(); enabled = true; adsHeld = false; holster = 0; aimInfo = null;
  readonly state = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  tryFire(): void { /* No contact simulation needed for placement. */ }
  update(): void { /* The pickup has its own original frame position. */ }
}

function fixture(saved = false, hold?: string) {
  const scope = new Scope('level');
  const log: string[] = [], prompts: EquipmentPickup['interactable'][] = [];
  const drop: EquipmentPickup = {
    interactable: { position: new Vector3(1, 2, 3), radius: 2.6, label: 'Take iron sword', onInteract: () => { drop.onPickup?.(); } },
    update: vi.fn((_dt: number, _t: number): void => { /* Record the retained frame clock. */ }), dispose: vi.fn(() => { log.push('dispose'); }),
  };
  const create = vi.fn((at: string, prompt: string): EquipmentPickup | null => { log.push(`create:${at}:${prompt}`); return drop; });
  const iron: EquipmentRow = { ...SWORD_IRON, pickup: { owned: 'iron-sword', prompt: 'Take iron sword', toast: 'acquired', create } };
  const weapons = new EquipmentService(new FixtureWeapon(SWORD_WOOD), { scope, input: { bind: () => { /* No DOM listeners. */ } } });
  weapons.add(new FixtureWeapon(iron), { locked: true });
  const owned = new Set(saved ? ['iron-sword'] : []);
  const grant = vi.fn((id: string) => { owned.add(id); log.push(`grant:${id}`); });
  const onNear = vi.fn(), onPickup = vi.fn((row: EquipmentRow, toast: string) => { log.push(`toast:${row.id}:${toast}`); });
  const host = { prompts, owned: { has: (id: string) => owned.has(id), grant }, onNear, onPickup, hold };
  const loadout = { pickups: [{ id: iron.id, at: 'wreck.deck' }] };
  return { scope, weapons, drop, create, owned, grant, onNear, onPickup, host, loadout, log, prompts };
}

describe('level equipment pickup rows (E357 S4.1 step 5)', () => {
  it('places only declared rows and takes once, saving before the animated swap and feedback', () => {
    const f = fixture();
    f.weapons.placePickups({}, f.host); expect(f.create).not.toHaveBeenCalled();
    f.weapons.onSwap = (to) => { f.log.push(`swap:${to}`); };
    f.weapons.placePickups(f.loadout, f.host);
    expect(f.prompts).toEqual([f.drop.interactable]); expect(f.weapons.pickup(SWORD_IRON.id)).toBe(f.drop);
    expect(f.weapons.has('sword-iron')).toBe(false);
    f.drop.onNear?.(true); expect(f.onNear).toHaveBeenCalledWith(true);
    f.drop.interactable.onInteract(); f.drop.interactable.onInteract();
    expect(f.grant).toHaveBeenCalledOnce(); expect(f.onPickup).toHaveBeenCalledOnce();
    expect(f.log).toEqual(['create:wreck.deck:Take iron sword', 'grant:iron-sword', 'swap:sword-iron', 'toast:weapon.sword-iron:acquired']);
    expect(f.weapons.current.id).toBe('sword'); expect(f.weapons.swappingNow).toBe(true);
    f.weapons.update(0.5, 1); expect(f.weapons.current.id).toBe('sword-iron');
    f.weapons.updatePickups(0.01, 2); expect(f.drop.update).toHaveBeenCalledWith(0.01, 2);
    f.scope.dispose();
  });

  it.each([true, false])('builds then hides saved or harness-held pickups, without a grant or sting (saved=%s)', (saved) => {
    const f = fixture(saved, saved ? undefined : SWORD_IRON.id);
    f.weapons.placePickups(f.loadout, f.host);
    expect(f.log).toEqual(['create:wreck.deck:Take iron sword', 'dispose']);
    expect(f.weapons.current.id).toBe('sword-iron'); expect(f.weapons.swappingNow).toBe(false);
    expect(f.grant).not.toHaveBeenCalled(); expect(f.onPickup).not.toHaveBeenCalled();
    expect(f.owned.has('iron-sword')).toBe(saved);
    f.drop.interactable.onInteract(); expect(f.grant).not.toHaveBeenCalled();
    f.scope.dispose();
  });

  it('releases prompts, callbacks and ticking with the level, including retained callback references', () => {
    const f = fixture(); f.weapons.placePickups(f.loadout, f.host);
    const take = f.drop.onPickup, near = f.drop.onNear;
    f.scope.dispose();
    expect(f.prompts).toEqual([]); expect(f.weapons.pickup(SWORD_IRON.id)).toBeNull();
    f.weapons.updatePickups(1, 1); expect(f.drop.update).not.toHaveBeenCalled();
    take?.(); near?.(true);
    expect(f.grant).not.toHaveBeenCalled(); expect(f.onNear).not.toHaveBeenCalled();
    expect(f.drop.dispose).toHaveBeenCalledOnce();
    expect(() => f.weapons.placePickups(f.loadout, f.host)).toThrow('disposed');
  });

  it('restores owned equipment even when content has no pickup site', () => {
    const f = fixture(true); f.create.mockReturnValueOnce(null);
    f.weapons.placePickups(f.loadout, f.host);
    expect(f.weapons.current.id).toBe('sword-iron'); expect(f.weapons.swappingNow).toBe(false);
    expect(f.weapons.pickup(SWORD_IRON.id)).toBeNull(); expect(f.prompts).toEqual([]);
    expect(f.grant).not.toHaveBeenCalled(); expect(f.onPickup).not.toHaveBeenCalled();
    f.scope.dispose();
  });

  it('rejects missing rows and duplicate placements instead of silently losing content', () => {
    const f = fixture();
    expect(() => f.weapons.placePickups({ pickups: [{ id: 'weapon.absent', at: 'site' }] }, f.host)).toThrow('not installed');
    expect(() => f.weapons.placePickups({ pickups: [{ id: SWORD_WOOD.id, at: 'site' }] }, f.host)).toThrow('no pickup factory');
    f.weapons.placePickups(f.loadout, f.host);
    expect(() => f.weapons.placePickups(f.loadout, f.host)).toThrow('Duplicate');
    f.scope.dispose();
  });
});
