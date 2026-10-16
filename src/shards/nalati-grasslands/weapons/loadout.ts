import { BOW_PROFILE as BOW_ROW } from '../data/bowProfile';
import { GoldenBow, type GoldenBowPower } from '../runtime/weapons/GoldenBow';
import { Bow } from '@wildshard/game/weapons/Bow';
import { BOW as BOW_PROFILE, type BowProfile } from '@wildshard/game/weapons/starterBowProfile';
import { heldBowProfile, loadHeldBow, type HeldBowRows } from '@wildshard/game/plugin/heldLauncher';
import type { HeldFirearmModel } from '@wildshard/game/plugin/heldFirearm';
import { Naizagai, type NaizagaiPower } from '../runtime/weapons/Naizagai';
import type { WeaponId } from '@wildshard/engine/combat/Equipment';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import type { Targets } from '@wildshard/engine/combat/types';
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import type { Game } from '@wildshard/engine/core/Game';
import type { Player } from '@wildshard/engine/player/Player';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';





import { Sabre, type MountState, type SabreWeapon } from '../runtime/weapons/Sabre';
import { Spear, type SpearWeapon } from '../runtime/weapons/Spear';
import { BOW } from './equipment';

/** The composite recurve's baked rows and parts (generators/recurvePool.ts): the held bow draw's (H3); the Golden Bow and the
 *  Sky-Wolf skin are its paints. */
export const RECURVE = '/assets/nalati/baked/recurve-pool.json';
/** Nalati's recurve: the kit bow's numbers, its riding numbers (content; other bows opt into mounting through their own
 * profile) and the baked recurve on the held bow draw. */
const nalatiBow = ({ rows, model }: { readonly rows: HeldBowRows; readonly model: HeldFirearmModel }) => heldBowProfile({ ...BOW_PROFILE, quiver: BOW_ROW.quiver, speedBase: BOW_ROW.speedBase, speedDraw: BOW_ROW.speedDraw, damageScale: BOW_ROW.damageScale,
  aimSpread: BOW_ROW.spread.aimMultiplier, draw: BOW_ROW.draw, loose: { ...BOW_ROW.spread, muzzle: BOW_ROW.muzzle },
  projectile: { ...BOW_ROW.flight, maxFlying: BOW_ROW.pool, substeps: BOW_ROW.substeps, lifetime: BOW_ROW.lifetime }, mounted: {
  drawTime: 0.9, rearAngle: 110, rearDraw: 0.2, rearSpread: 0.5, arc: false,
  gaits: [{ below: 0.3, spread: 0.3 }, { below: 3.2, spread: 0.8 }, { below: 6.5, spread: 3 },
    { below: 10.5, spread: 1.5 }, { below: Infinity, spread: 1.8 }],
} }, rows, model);

/** Nalati's authored three-slot loadout. The plugin registers the rifle as a practice loan;
 * the normal equipment service owns selection, swaps and reward replacements. */
export interface NalatiWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface NalatiLoadout {
  base: SabreWeapon;
  bow: Bow;
  sabre: SabreWeapon;
  spear: SpearWeapon;
  extras: Weapon[];
  install: (weapons: EquipmentService) => void;
  refill: () => void;
  upgradeBow: (weapons: EquipmentService, power: GoldenBowPower) => void;
  upgradeSabre: (weapons: EquipmentService, power: NaizagaiPower) => void;
  setMount: (m: MountState | null) => void;
  /** the held weapon is a melee one (audio: the sword whoosh / hit sounds) */
  melee: (id: WeaponId) => boolean;
}

/** Nalati's loadout, a task apart per weapon (SF67: the three viewmodels and the arms were one ~300 ms task at 4x CPU); the
 *  bow waits for its baked parts */
export async function buildNalatiLoadoutSliced(world: NalatiWorld, targets: Targets, allowUnlocked: boolean, yieldTask: () => Promise<void>): Promise<NalatiLoadout> {
  const sabre = new Sabre(world, targets, { allowUnlocked });
  await yieldTask();
  const spear = new Spear(world, targets, { allowUnlocked });
  await yieldTask();
  const profile = nalatiBow(await loadHeldBow(RECURVE));
  const bow = new Bow(world, targets, { row: BOW, profile, allowUnlocked });
  return loadoutOf(world, targets, allowUnlocked, sabre, spear, bow, profile);
}

function loadoutOf(world: NalatiWorld, targets: Targets, allowUnlocked: boolean, sabre: SabreWeapon, spear: SpearWeapon, bow: Bow, profile: BowProfile): NalatiLoadout {
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
      const next = new GoldenBow(world, targets, { row: BOW, profile, allowUnlocked, power, previous });

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

