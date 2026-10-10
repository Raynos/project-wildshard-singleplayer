import { installWeaponHooks, type WeaponHookLane } from '@wildshard/sdk/weaponHooks';
import declaration from '../behaviour/weapons.json' with { type: 'json' };
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import { MountedSword } from '@wildshard/sdk/items/mountedSword';

/**
 * Nalati's admitted weapon hooks (SHARD-PLATFORM SF36): the sabre's mounted pass damage — its speed bonus and its pass
 * chain — answered by behaviour/weapons.as (behaviour/weapons.json; rebuilt by `node scripts/bake/weapon-hooks.mjs` in a
 * clean export). Behind the default-off "Shard directors (data)" Developer row, like the raid director: off, the sabre
 * keeps the mounted sword family's row rule, which gives the same numbers. Naizagai (the reward that replaces the sabre)
 * is not declared and keeps the row rule.
 */
export function installNalatiWeaponHooks(context: Parameters<typeof installWeaponHooks>[0], weapons: { readonly sabre: Weapon }): Promise<WeaponHookLane | null> {
  return installWeaponHooks(context, { data: declaration,
    bytes: async () => {
      const response = await fetch(new URL('../assets/141ad375895d4f14fc900f0954c566ff077d1621741aed238edffa672f41a9ac', import.meta.url));
      if (!response.ok) throw new Error('Missing Nalati weapon hook module');
      return new Uint8Array(await response.arrayBuffer());
    },
    weapons: () => weapons.sabre instanceof MountedSword && weapons.sabre.row.id === 'weapon.sabre' ? [weapons.sabre] : [] });
}
