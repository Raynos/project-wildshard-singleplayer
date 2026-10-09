import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { variantMods } from '@wildshard/engine/entities/species/registry';
import { WOLF_SPECIES } from '../species/wolf';
import { KOKBORI, KOKBORI_SPECIES } from '../species/kokbori';
import type { NalatiBake } from './baked';

/** Wolves and Kokbori use the SAME buildCanid dimensions at every authored variant (including dark and ruff traits).
 * Reuse its browser-captured native dimensions; only the shipping AnimalView recipe's data fields vary. This never
 * builds a rig at headless install. The dimensional invariant is checked against every real authored build.
 */
export function nalatiCanidSpec(bake: NalatiBake, kind: 'wolf' | 'kokbori', variant: string): AnimalSimSpec {
  const species = kind === KOKBORI ? KOKBORI_SPECIES : WOLF_SPECIES;
  const row = species.variants.find(v => v.id === variant), native = bake.actors.find(a => a.kind === 'wolf');
  if (row === undefined || native === undefined || species.build !== WOLF_SPECIES.build) throw new Error('Missing authenticated Nalati canid recipe');
  return { kind, label: row.label || species.label, variant: row.id, rarity: row.rarity,
    hp: row.hp ?? species.tuning?.hp ?? (species.aggressive === true ? 100 : 60), aggressive: species.aggressive ?? false,
    dims: structuredClone(native.spec.dims), mods: variantMods(species, row),
    ...(species.lockable === undefined ? {} : { lockable: species.lockable }) };
}
