import type { EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { ItemFamily, ItemFamilyPresentation } from '@wildshard/engine/combat/itemFamilies';
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeItems } from '@wildshard/game/shardfile/hybridRows';
import type { Shardfile } from '@wildshard/sdk/shardfile';
import source from '../shard.config';
import { installNalatiWeaponHooks } from '../weapons/hooks';

function presentation(row: EquipmentRow): ItemFamilyPresentation {
  const { name: _name, icon: _icon, inputContext: _context, swapIcon: _swap, ...ui } = row.ui;
  return { ui, ...(row.cues === undefined ? {} : { cues: row.cues }), ...(row.hitStop === undefined ? {} : { hitStop: row.hitStop }),
    ...(row.rangedFeel === undefined ? {} : { rangedFeel: row.rangedFeel }) };
}

/** Adopt the existing native equipment once: no duplicate model, combat actor, projectile or changed construction order.
 *  Then admit the sabre's weapon hook (SF36) behind the default-off "Shard directors (data)" row; off, nothing is fetched
 *  and the sabre keeps its row rule. */
export function bindNalatiItems(ctx: Pick<ShardContext, 'app' | 'scope' | 'game'> & Parameters<typeof installNalatiWeaponHooks>[0],
  weapons: { bow: Weapon; sabre: Weapon; spear: Weapon; rifle: Weapon }, data: Shardfile = source): void {
  const families = new Map<string, ItemFamily>();
  const adopt = (name: string, weapon: Weapon): void => {
    const native = weapon.row;
    families.set(name, { kind: 'weapon', presentation: presentation(native), create: (row) => {
      // G51: saved slots and the unchanged mounted controllers still address bow/sabre/spear/rifle.
      weapon.row = { ...row, legacySlot: weapon.id, meta: native.meta }; return weapon;
    } });
  };
  adopt('nalati-grasslands.bow', weapons.bow); adopt('nalati-grasslands.sabre', weapons.sabre);
  adopt('nalati-grasslands.spear', weapons.spear); adopt('nalati-grasslands.rifle', weapons.rifle);
  const native = Object.values(weapons).map((weapon) => weapon.row);
  bindRuntimeItems(ctx, data, { families, icon: (name) => {
    const row = native.find((entry) => entry.ui.icon === name);
    if (row === undefined) throw new Error(`Unknown Nalati item icon ${name}`);
    return row.ui.icon;
  } });
  installNalatiWeaponHooks(ctx, weapons).catch((e: unknown) => { console.warn('[nalati] weapon hooks failed: the sabre keeps its row rule', e); });
}
