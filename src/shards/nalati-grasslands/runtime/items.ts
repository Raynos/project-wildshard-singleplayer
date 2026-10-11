import { SABRE_WEAPON_PROFILE } from '../data/sabreProfile';
import { JAVELIN_WEAPON_PROFILE } from '../data/javelinProfile';
import { RIFLE_WEAPON_PROFILE } from '../data/rifleProfile';
import { BOW_PROFILE } from '../data/bowProfile';
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
    families.set(name, { kind: 'weapon', ...(name === 'bow' || name === 'firearm' || name === 'thrown' || name === 'melee' ? { profiles: [name] } : {}), presentation: presentation(native), create: (row, _spec, ports) => {
      if (name === 'melee' && JSON.stringify(ports.profile) !== JSON.stringify(SABRE_WEAPON_PROFILE)) throw new Error('Native sabre was built from a different authored profile');
      if (name === 'bow' && JSON.stringify(ports.profile) !== JSON.stringify(BOW_PROFILE)) throw new Error('Native bow was built from a different authored profile');
      if (name === 'firearm' && JSON.stringify(ports.profile) !== JSON.stringify(RIFLE_WEAPON_PROFILE)) throw new Error('Native rifle was built from a different authored profile');
      if (name === 'thrown' && JSON.stringify(ports.profile) !== JSON.stringify(JAVELIN_WEAPON_PROFILE)) throw new Error('Native javelins were built from a different authored profile');
      // G51: saved slots and the unchanged mounted controllers still address bow/sabre/spear/rifle.
      weapon.row = { ...row, legacySlot: weapon.id, meta: native.meta }; return weapon;
    } });
  };
  adopt('bow', weapons.bow); adopt('melee', weapons.sabre);
  adopt('thrown', weapons.spear); adopt('firearm', weapons.rifle);
  const native = Object.values(weapons).map((weapon) => weapon.row);
  const melee = families.get('melee'); if (melee === undefined) throw new Error('Missing Nalati melee family');
  const bow = families.get('bow'); if (bow === undefined) throw new Error('Missing Nalati bow family');
  const firearm = families.get('firearm'); if (firearm === undefined) throw new Error('Missing Nalati rifle family');
  const thrown = families.get('thrown'); if (thrown === undefined) throw new Error('Missing Nalati thrown family');
  families.delete('melee'); families.delete('bow'); families.delete('firearm'); families.delete('thrown');
  bindRuntimeItems(ctx, data, { families, kit: new Map([['melee', melee], ['bow', bow], ['firearm', firearm], ['thrown', thrown]]), icon: (name) => {
    const row = native.find((entry) => entry.ui.icon === name);
    if (row === undefined) throw new Error(`Unknown Nalati item icon ${name}`);
    return row.ui.icon;
  } });
  installNalatiWeaponHooks(ctx, weapons).catch((e: unknown) => { console.warn('[nalati] weapon hooks failed: the sabre keeps its row rule', e); });
}
