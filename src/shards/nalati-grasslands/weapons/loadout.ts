import { GoldenBow, type GoldenBowPower } from './GoldenBow';
import { BOW as BOW_PROFILE } from '#kit/weapons/bow/profiles';
import { Naizagai, type NaizagaiPower } from './Naizagai';
import type { Game, Sky, Player, Forest, Targets, Weapon, WeaponId, EquipmentService } from '#engine';





import { Sabre, type MountState } from './Sabre';
import { Spear } from './Spear';
import { BOW } from './equipment';
import { Bow } from '#kit';

/** Nalati's riding numbers are content; other bows opt into mounting through their own profile. */
export const NALATI_BOW = { ...BOW_PROFILE, mounted: {
  drawTime: 0.9, rearAngle: 110, rearDraw: 0.2, rearSpread: 0.5, arc: false,
  gaits: [{ below: 0.3, spread: 0.3 }, { below: 3.2, spread: 0.8 }, { below: 6.5, spread: 3 },
    { below: 10.5, spread: 1.5 }, { below: Infinity, spread: 1.8 }],
} };

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
export interface NalatiLoadout {
  base: Sabre;
  bow: Bow;
  sabre: Sabre;
  spear: Spear;
  extras: Weapon[];
  install: (weapons: EquipmentService) => void;
  refill: () => void;
  upgradeBow: (weapons: EquipmentService, power: GoldenBowPower) => void;
  upgradeSabre: (weapons: EquipmentService, power: NaizagaiPower) => void;
  setMount: (m: MountState | null) => void;
  /** the held weapon is a melee one (audio: the sword whoosh / hit sounds) */
  melee: (id: WeaponId) => boolean;
}

export function buildNalatiLoadout(world: NalatiWorld, targets: Targets, allowUnlocked: boolean): NalatiLoadout {
  const sabre = new Sabre(world, targets, { allowUnlocked });
  const spear = new Spear(world, targets, { allowUnlocked });
  const bow = new Bow(world, targets, { row: BOW, profile: NALATI_BOW, allowUnlocked });
  const kit: NalatiLoadout = {
    base: sabre, bow, sabre, spear,
    extras: [bow, spear],
    install(weapons) {
      for (const e of kit.extras) weapons.unlock(e.id);
      weapons.select('bow', true); // slot 1: the bow is the shard's main weapon
    },
    upgradeBow(weapons, power) {
      if (kit.bow instanceof GoldenBow) return;
      const previous = kit.bow;
      const next = new GoldenBow(world, targets, { row: BOW, profile: NALATI_BOW, allowUnlocked, power, previous });

      weapons.replace(previous.id, next); kit.bow = next;
    },
    upgradeSabre(weapons, power) {
      if (kit.sabre.row.id === 'weapon.naizagai') return;
      const next = new Naizagai(world, targets, { allowUnlocked, power });
      next.carryPassState(kit.sabre);
      weapons.replace(kit.sabre.id, next); kit.sabre = next; kit.base = next;
    },
    refill() { spear.javelins = spear.maxJavelins; kit.bow.addBolts(kit.bow.magazine); },
    setMount(m) { kit.sabre.mount = m; spear.mount = m; kit.bow.setMount(m); },
    melee: (id) => [kit.sabre, spear, bow].some((w) => w.id === id && w.row.ui.melee),
  };
  return kit;
}

export type NalatiKit = NalatiLoadout;
export const buildNalatiKit = buildNalatiLoadout;
