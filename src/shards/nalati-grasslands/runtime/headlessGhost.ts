import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { variantMods } from '@wildshard/engine/entities/species/registry';
import { GHOST_RIDER, GHOSTRIDER_SPECIES } from '../species/ghostRider';
import type { NalatiBake } from './baked';

/** The ghost row builds the same horse rig at every authored variant; its body dimensions are invariant.
 * Consume the browser-captured native horse dimensions, never construct a rig during headless admission.
 * The real rider/captain builds authenticate this invariant in the native recipe fixture; scale remains the
 * actual spawn roll (and the storm keeper's separate x1.6), not part of these unscaled dimensions.
 */
export function nalatiGhostSpec(bake: NalatiBake, variant: 'rider' | 'captain'): AnimalSimSpec {
  const species = GHOSTRIDER_SPECIES, row = species.variants.find(v => v.id === variant), horse = bake.actors.find(a => a.kind === 'horse');
  if (row === undefined || horse?.spec.kind !== 'horse') throw new Error('Missing authenticated Nalati ghost recipe');
  return { kind: GHOST_RIDER, label: row.label || species.label, variant: row.id, rarity: row.rarity,
    hp: row.hp ?? species.tuning?.hp ?? (species.aggressive === true ? 100 : 60), aggressive: species.aggressive ?? false,
    dims: structuredClone(horse.spec.dims), mods: variantMods(species, row),
    ...(species.lockable === undefined ? {} : { lockable: species.lockable }) };
}
