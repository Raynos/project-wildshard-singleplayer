import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { variantMods } from '@wildshard/engine/entities/species/registry';
import { HORSE_SPECIES } from '../species/horse';
import rows from '../data/bodies.json' with { type: 'json' };
import { bodyKey } from '../species/bodyKey';

/** Tulpar owns its actual authored loft dimensions, including tack and long mane; never borrows the boot stallion. */
export function nalatiTulparSpec(): AnimalSimSpec {
  const variant = HORSE_SPECIES.variants.find(v => v.id === 'tulpar');
  if (variant === undefined) throw new Error('Missing Nalati Tulpar variant');
  const row = rows.bodies.find(b => b.key === bodyKey('horse', variant));
  if (row === undefined) throw new Error('Missing actual Nalati Tulpar body recipe');
  const { capsuleAxis, ...dims } = row.dims;
  if (capsuleAxis !== undefined && capsuleAxis !== 'y' && capsuleAxis !== 'z') throw new Error('Invalid Tulpar capsule axis');
  return { kind: 'horse', label: variant.label || HORSE_SPECIES.label, variant: variant.id, rarity: variant.rarity,
    hp: variant.hp ?? HORSE_SPECIES.tuning?.hp ?? (HORSE_SPECIES.aggressive === true ? 100 : 60),
    aggressive: HORSE_SPECIES.aggressive ?? false,
    dims: { ...dims, feet: dims.feet.map(f => [f[0] ?? 0, f[1] ?? 0]), ...(capsuleAxis === undefined ? {} : { capsuleAxis }) },
    mods: variantMods(HORSE_SPECIES, variant), ...(HORSE_SPECIES.lockable === undefined ? {} : { lockable: HORSE_SPECIES.lockable }) };
}
