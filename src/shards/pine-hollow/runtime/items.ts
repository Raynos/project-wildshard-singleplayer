import { CROSSBOW_WEAPON_PROFILE } from '../data/crossbowProfile';
import { LEVER_WEAPON_PROFILE } from '../data/leverProfile';
import { BOW_PROFILE } from '../data/bowProfile';
import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { ItemFamily, ItemFamilyPresentation } from '@wildshard/engine/combat/itemFamilies';
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeItems } from '@wildshard/game/shardfile/hybridRows';
import source from '../shard.config';

/** Preserve native ammunition, cues and feel; the declaration owns the public identity and input/UI fields. */
function presentation(row: EquipmentRow): ItemFamilyPresentation {
  const { name: _name, icon: _icon, inputContext: _context, swapIcon: _swap, ...ui } = row.ui;
  return { ui, ...(row.cues === undefined ? {} : { cues: row.cues }), ...(row.hitStop === undefined ? {} : { hitStop: row.hitStop }),
    ...(row.rangedFeel === undefined ? {} : { rangedFeel: row.rangedFeel }) };
}

/** Adopt after the native awaited construction sequence: no duplicate model, projectile owner or removal of boot yields. */
export function bindPineItems(ctx: Pick<ShardContext, 'app' | 'scope' | 'game'>, weapons: {
  primary: Weapon; rifle: Weapon; secondary: Weapon;
}): void {
  const families = new Map<string, ItemFamily>();
  const adopt = (name: string, weapon: Weapon): void => {
    const native = weapon.row;
    families.set(name, { kind: 'weapon', ...(name === 'bow' || name === 'firearm' ? { profiles: [name] } : {}), presentation: presentation(native), create: (row, _spec, ports) => {
      if (name === 'bow' && JSON.stringify(ports.profile) !== JSON.stringify(BOW_PROFILE)) throw new Error('Native bow was built from a different authored profile');
      if (name === 'firearm' && JSON.stringify(ports.profile) !== JSON.stringify(LEVER_WEAPON_PROFILE)) throw new Error('Native lever was built from a different authored profile');
      // G51 compatibility: saved held slots and native controller branches retain crossbow/rifle/bow.
      weapon.row = { ...row, legacySlot: weapon.id, meta: native.meta }; return weapon;
    } });
  };
  adopt('bow', weapons.secondary);
  // Both native ranged owners use firearm declarations. Dispatch by admitted identity, retaining each owner's cues and UI.
  const firearms = new Map([['weapon.crossbow', { weapon: weapons.primary, profile: CROSSBOW_WEAPON_PROFILE }],
    ['weapon.lever', { weapon: weapons.rifle, profile: LEVER_WEAPON_PROFILE }]]);
  const nativeRows = new Map(Array.from(firearms, ([id, value]) => [id, value.weapon.row]));
  families.set('firearm', { kind: 'weapon', profiles: ['firearm'], create: (row, _spec, ports) => {
    const binding = firearms.get(row.id), native = nativeRows.get(row.id);
    if (binding === undefined || native === undefined || JSON.stringify(ports.profile) !== JSON.stringify(binding.profile)) throw new Error('Native firearm was built from a different authored profile');
    const preserved = presentation(native);
    binding.weapon.row = { ...preserved, ...row, ui: { ...row.ui, ...preserved.ui }, legacySlot: binding.weapon.id, meta: native.meta };
    return binding.weapon;
  } });
  const native = [weapons.primary.row, weapons.rifle.row, weapons.secondary.row];
  const bow = families.get('bow'); if (bow === undefined) throw new Error('Missing Pine bow family');
  const firearm = families.get('firearm'); if (firearm === undefined) throw new Error('Missing Pine firearm family');
  families.delete('bow'); families.delete('firearm');
  bindRuntimeItems(ctx, source, { families, kit: new Map([['bow', bow], ['firearm', firearm]]), icon: (name) => {
    const row = native.find((entry) => entry.ui.icon === name); if (row === undefined) throw new Error(`Unknown Pine item icon ${name}`); return row.ui.icon;
  } });
}
