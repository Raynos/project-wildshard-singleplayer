import { GoldenBow, type GoldenBowPower } from './GoldenBow';
import { Bow } from '@wildshard/kit/weapons/bow/family';
import { BOW as BOW_PROFILE } from '@wildshard/kit/weapons/bow/profiles';
import { POSE, buildRecurve, arrowKind, ARROW_LEN } from './recurve';
import { Naizagai, type NaizagaiPower } from './Naizagai';
import type { WeaponId } from '@wildshard/engine/combat/Equipment';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import type { Targets } from '@wildshard/engine/combat/types';
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import type { Game } from '@wildshard/engine/core/Game';
import type { Player } from '@wildshard/engine/player/Player';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';





import { Sabre, type MountState } from './Sabre';
import { Spear } from './Spear';
import { BOW } from './equipment';

/** Nalati's recurve: the kit bow's numbers with the recurve's view (SF54: moved out of the kit's BOW row unchanged), and
 * its riding numbers, which are content; other bows opt into mounting through their own profile. */
export const NALATI_BOW = { ...BOW_PROFILE, poses: POSE, arrowX: 0.02, arrowY: 0.058, arrowLength: ARROW_LEN, build: buildRecurve, arrow: arrowKind, mounted: {
  drawTime: 0.9, rearAngle: 110, rearDraw: 0.2, rearSpread: 0.5, arc: false,
  gaits: [{ below: 0.3, spread: 0.3 }, { below: 3.2, spread: 0.8 }, { below: 6.5, spread: 3 },
    { below: 10.5, spread: 1.5 }, { below: Infinity, spread: 1.8 }],
} };

/** Nalati's authored three-slot loadout. The plugin registers the rifle as a practice loan;
 * the normal equipment service owns selection, swaps and reward replacements. */
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

