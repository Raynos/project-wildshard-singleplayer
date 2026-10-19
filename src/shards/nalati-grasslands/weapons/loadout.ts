import type { GoldenBowPower } from '../runtime/weapons/GoldenBow';
import { Bow } from '@wildshard/game/weapons/Bow';
import type { BowProfile } from '@wildshard/game/weapons/starterBowProfile';
import { loadHeldBow } from '@wildshard/game/plugin/heldLauncher';
import { type NaizagaiPowerHandle as NaizagaiPower, Sabre, type MountState, type SabreWeapon, sabreProfile, Spear, type SpearWeapon } from '../weapons/nativeMelee';
import type { WeaponId } from '@wildshard/engine/combat/Equipment';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import type { Targets } from '@wildshard/engine/combat/types';
import type { Weapon } from '@wildshard/engine/combat/Weapon';
import type { Game } from '@wildshard/engine/core/Game';
import type { Player } from '@wildshard/engine/player/Player';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';


import { readItemEquipment } from '@wildshard/game/plugin/nativeItems';
import gear from '../boot/gear.generated.json' with { type: 'json' };
import { Rng } from '@wildshard/engine/core/rng';
import { fetchLaneBake } from '@wildshard/game/plugin/geometry';
import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';
import { modelContext } from '@wildshard/engine/models/model';
import { Object3D } from 'three';

export const weaponCatalogue = defineSpecimenCatalogue<Record<string, object>>(gear.catalogue.map(row => ({ key: row.key, model: row.model, source: row.source })), gear.packed, gear.materials);

/** The composite recurve's baked rows and parts (generators/recurvePool.ts): the held bow draw's (H3); the Golden Bow and the
 *  Sky-Wolf skin are its paints. */
export const RECURVE = '/assets/nalati/baked/recurve-pool.json';
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
export async function buildNalatiLoadoutSliced(world: NalatiWorld, targets: Targets, allowUnlocked: boolean, yieldTask: () => Promise<void>, items: unknown): Promise<NalatiLoadout> {
  weaponCatalogue.usePacked(await fetchLaneBake(gear.packed.bin));
  const sabre = new Sabre(world, targets, { allowUnlocked });
  await yieldTask();
  const spear = new Spear(world, targets, { allowUnlocked });
  await yieldTask();
  const { profile } = await loadHeldBow(RECURVE);
  const bow = new Bow(world, targets, { row: readItemEquipment(items, 'weapon.bow'), profile, allowUnlocked });
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
      if (kit.bow.row.id === `weapon.${gear.variants.goldenBow.id}`) return;
      const previous = kit.bow;
      const next = new Bow(world, targets, { row: { ...previous.row, id: `weapon.${gear.variants.goldenBow.id}`, ui: { ...previous.row.ui, name: gear.variants.goldenBow.name, swapName: gear.variants.goldenBow.name }, meta: { ...previous.meta, name: gear.variants.goldenBow.name } }, profile, allowUnlocked });
      next.damageMultiplier = previous.damageMultiplier; next.onLoose = previous.onLoose;
      next.carryMountState(previous); power.apply(next);

      weapons.replace(previous.id, next); kit.bow = next;
    },
    upgradeSabre(weapons, power) {
      if (kit.sabre.row.id === `weapon.${gear.variants.naizagai.id}`) return;
      const base = sabreProfile();
      const next = new Sabre(world, targets, { allowUnlocked, power, profile: { ...base, id: `weapon.${gear.variants.naizagai.id}`, parent: base.id,
        ui: { ...base.ui, name: gear.variants.naizagai.name }, meta: { ...base.meta, name: gear.variants.naizagai.name } } });
      next.carryPassState(kit.sabre);
      weapons.replace(kit.sabre.id, next); kit.sabre = next; kit.base = next;
    },
    refill() { spear.javelins = spear.maxJavelins; kit.bow.addBolts(kit.bow.magazine); },
    setMount(m) { kit.sabre.mount = m; spear.mount = m; kit.bow.setMount(m); },
    melee: (id) => [kit.sabre, spear, bow].some((w) => w.id === id && w.row.ui.melee),
  };
  return kit;
}

/** The reward orb and Explorer resolve the same baked weapon geometry. */
export function weaponSpecimen(key: string, sky: Sky): Object3D {
  const model = weaponCatalogue.model(key);
  const built = model.build(modelContext(sky), model.defaults, new Rng(0));
  if (!(built instanceof Object3D)) throw new Error('Weapon specimen requires a scene');
  return built;
}
