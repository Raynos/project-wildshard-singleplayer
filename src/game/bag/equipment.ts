import type { Weapon, KitEntry } from '#engine';

/** The Bag reads authored metadata; ammo and selected state remain live weapon state. */
export function equipmentEntry(w: Weapon, current: Weapon, suffix = ''): KitEntry {
  const ui = w.row.ui, ammo = ui.ammo;
  return { id: w.id, name: w.meta.name + suffix, icon: w.meta.icon, melee: ui.melee, tracers: ui.tracers,
    huntersEye: ui.huntersEye === true,
    ammoLabel: ammo?.bagLabel !== undefined && w.ammoLabel === ammo.label ? ammo.bagLabel : w.ammoLabel,
    ammo: w.state.ammo ?? 0, magazine: w.state.magazine, reserve: w.state.reserve, equipped: w === current };
}
