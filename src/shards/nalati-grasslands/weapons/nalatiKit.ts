import type { Game } from '#engine/core/Game';
import type { Sky } from '#engine/world/Sky';
import type { Player } from '#engine/player/Player';
import type { Forest } from '#engine/world/forest/Forest';
import type { Targets } from '#engine/player/Crossbow';
import type { Weapon, WeaponId, EquipmentService } from '#engine';
import { Sabre, type MountState } from './Sabre';
import { Spear } from './Spear';
import { BOW } from './equipment';
import { Bow } from '#engine/player/Bow';

/**
 * nalatiKit — the Nalati Grasslands weapon set (plan row B3; decision: 3 slots — bow · sabre · spear, javelins thrown from
 * the spear slot). main.ts builds it for `chunk.slug === 'nalati-grasslands'` instead of the crossbow / sword:
 *
 *   const kit = buildNalatiKit({ game, sky, player, forest }, targets, nolock);
 *   const weapons = new EquipmentService(kit.base, rifle, kit.extras, kit.options);   // the AR-15 stays in the kit, locked
 *   kit.install(weapons);                                                    // every slot owned, the bow in hand (the weapon strip
 *                                                                            // is the base HUD's: ShardManifest.hud.weaponStrip, E154)
 *   kit.refill();                                                            // on respawn: the javelins back
 *
 * Slots (keys 1 / 2 / 3, the strip, Q = the last weapon): bow (B2's Bow.ts — held first), sabre (Sabre.ts, the kit's base
 * weapon: `EquipmentService` needs one), spear (Spear.ts). The bow's wind (`kit.bow.wind = wind`, src/world/Wind.ts) is the world's. `setMount(m)` is the riding row's (B7) one
 * call per frame: it hands the horse's speed / heading to every weapon that reads it (null on foot).
 */

export interface NalatiWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface NalatiKit {
  base: Sabre;
  bow: Bow;
  sabre: Sabre;
  spear: Spear;
  extras: Weapon[];
  install: (weapons: EquipmentService) => void;
  refill: () => void;
  setMount: (m: MountState | null) => void;
  /** the held weapon is a melee one (audio: the sword whoosh / hit sounds) */
  melee: (id: WeaponId) => boolean;
}

export function buildNalatiKit(world: NalatiWorld, targets: Targets, allowUnlocked: boolean): NalatiKit {
  const sabre = new Sabre(world, targets, { allowUnlocked });
  const spear = new Spear(world, targets, { allowUnlocked });
  const bow = new Bow(world, targets, { row: BOW, allowUnlocked });
  const kit: NalatiKit = {
    base: sabre, bow, sabre, spear,
    extras: [bow, spear],
    install(weapons) {
      for (const e of kit.extras) weapons.unlock(e.id);
      weapons.select('bow', true); // slot 1: the bow is the shard's main weapon
    },
    refill() { spear.javelins = spear.maxJavelins; bow.addBolts(bow.magazine); },
    setMount(m) { sabre.mount = m; spear.mount = m; bow.setMount(m); },
    melee: (id) => [sabre, spear, bow].some((w) => w.id === id && w.row.ui.melee),
  };
  return kit;
}
