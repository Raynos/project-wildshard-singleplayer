import { PINE_SPAWNS } from './spawnTables';
import { PINE_NATIVE_HUNT } from './nativeHunt';
import { bakeSpecies } from '@wildshard/sdk/bake/species';
import { readSpecies } from '@wildshard/format/speciesPrograms';
import { DEER } from '@wildshard/game/systems/species/deer';
import { ELK } from '@wildshard/game/systems/species/elk';
import { PINE_BOAR, PINE_BEAR, PINE_ELK_THRALL, PINE_SPECIES, pineDeer, pineElk } from './speciesRows';
import physics from '../data/physics.generated.json' with { type: 'json' };

const king = physics.parked[0];
if (king?.kind !== 'antler-king') throw new Error('Pine bake has no Antler King prewarm');
const kingSpecies = readSpecies({ ...bakeSpecies({ ...ELK, kind: king.kind, aggressive: true }, `pine.creature.${king.kind}`),
  variants: [{ id: king.variant, label: king.spec.label, weight: 1, rarity: king.spec.rarity, scale: [king.scale, king.scale] }] });
/** Compile the page's registration order and the native manager's original kind/variant table. */
export const PINE_SPECIES_PROGRAMS = { spawns: PINE_SPAWNS, hunt: PINE_NATIVE_HUNT,
  page: [...PINE_SPECIES, pineDeer(), pineElk()].map(row => bakeSpecies(row, row.id)),
  native: [...[DEER, { ...ELK, spawnOnly: [PINE_ELK_THRALL] }, PINE_BOAR, PINE_BEAR]
    .map(row => bakeSpecies(row, `pine.creature.${row.kind}`)), kingSpecies],
};
