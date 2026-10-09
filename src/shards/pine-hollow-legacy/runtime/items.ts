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
    families.set(name, { kind: 'weapon', presentation: presentation(native), create: (row) => {
      // G51 compatibility: saved held slots and native controller branches retain crossbow/rifle/bow.
      weapon.row = { ...row, legacySlot: weapon.id, meta: native.meta }; return weapon;
    } });
  };
  adopt('pine-hollow.crossbow', weapons.primary); adopt('pine-hollow.lever', weapons.rifle); adopt('pine-hollow.longbow', weapons.secondary);
  const native = [weapons.primary.row, weapons.rifle.row, weapons.secondary.row];
  bindRuntimeItems(ctx, source, { families, icon: (name) => {
    const row = native.find((entry) => entry.ui.icon === name); if (row === undefined) throw new Error(`Unknown Pine item icon ${name}`); return row.ui.icon;
  } });
}
