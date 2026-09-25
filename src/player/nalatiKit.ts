import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from './Player';
import type { Forest } from '../world/Forest';
import type { Targets } from './Crossbow';
import type { ExtraWeapon, WeaponId, Weapons, WeaponsOptions } from './Weapons';
import { Sabre, type MountState } from './Sabre';
import { Spear } from './Spear';
import { Bow } from './Bow';
import { WeaponStrip } from '../ui/WeaponStrip';
import { NalatiHUD } from '../ui/NalatiHUD';

/**
 * nalatiKit — the Nalati Grasslands weapon set (plan row B3; decision: 3 slots — bow · sabre · spear, javelins thrown from
 * the spear slot). main.ts builds it for `chunk.slug === 'nalati-grasslands'` instead of the crossbow / sword:
 *
 *   const kit = buildNalatiKit({ game, sky, player, forest }, targets, nolock);
 *   const weapons = new Weapons(kit.base, rifle, kit.extras, kit.options);   // the AR-15 stays in the kit, locked
 *   kit.install(weapons, game);                                              // AFTER TouchControls: every slot owned, the strip,
 *                                                                            // the phone HUD's layout D (src/ui/NalatiHUD.ts, NALATI-MERGE H2)
 *   kit.refill();                                                            // on respawn: the javelins back
 *
 * Slots (keys 1 / 2 / 3, the strip, Q = the last weapon): bow (B2's Bow.ts — held first), sabre (Sabre.ts, the kit's base
 * weapon: `Weapons` needs one), spear (Spear.ts). The bow's wind (`kit.bow.wind = wind`, src/world/Wind.ts) is the world's. `setMount(m)` is the riding row's (B7) one
 * call per frame: it hands the horse's speed / heading to every weapon that reads it (null on foot).
 */

export interface NalatiWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface NalatiKit {
  base: Sabre;
  bow: Bow;
  sabre: Sabre;
  spear: Spear;
  extras: ExtraWeapon[];
  options: WeaponsOptions;
  strip: WeaponStrip | null;
  /** Nalati's phone HUD, layout D (NALATI-MERGE H2) — built by install */
  hud: NalatiHUD | null;
  install: (weapons: Weapons, game: Game) => void;
  refill: () => void;
  setMount: (m: MountState | null) => void;
  /** the held weapon is a melee one (audio: the sword whoosh / hit sounds) */
  melee: (id: WeaponId) => boolean;
}

export function buildNalatiKit(world: NalatiWorld, targets: Targets, allowUnlocked: boolean): NalatiKit {
  const sabre = new Sabre(world, targets, { allowUnlocked });
  const spear = new Spear(world, targets, { allowUnlocked });
  const bow = new Bow(world, targets, { allowUnlocked });
  const kit: NalatiKit = {
    base: sabre, bow, sabre, spear,
    extras: [{ weapon: bow, id: 'bow', name: 'Bow' }, { weapon: spear, id: 'spear', name: 'Spear' }],
    options: { baseId: 'sabre', baseName: 'Sabre', order: ['bow', 'sabre', 'spear'], lastOnQ: true },
    strip: null,
    hud: null,
    install(weapons, game) {
      for (const e of kit.extras) weapons.unlock(e.id);
      weapons.select('bow', true); // slot 1: the bow is the shard's main weapon
      kit.strip = new WeaponStrip(weapons);
      const strip = kit.strip;
      const hud = kit.hud = new NalatiHUD(weapons);
      game.onUpdate(() => { strip.update(); hud.update(); });
    },
    refill() { spear.javelins = spear.maxJavelins; bow.addBolts(bow.magazine); },
    setMount(m) { sabre.mount = m; spear.mount = m; bow.setMount(m); },
    melee: (id) => id === 'sabre' || id === 'spear',
  };
  return kit;
}
