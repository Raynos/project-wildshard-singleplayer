import type { ViewProgramRows } from '@wildshard/format/viewProgram';

/** Live balbals (the night's warriors and the golden king's adds) and golden eagles the module presents at once. */
const BALBALS = 16, EAGLES = 2;

/**
 * G600 L8: the balbals' crack glow and height and the golden eagle's flight height as a view program
 * (behaviour/creatureViews.as) over the species pools: the slot counts, then each pool's block. Its channels: per balbal
 * slot the crack mesh's colour gain (the original ember times the glow) and its height offset, then per eagle slot its
 * height offset. A field `has:<key>` reads whether the actor's memory holds `key` (game/population/speciesViewSlots).
 */
export function nalatiCreatureViews(): ViewProgramRows {
  const slots = (count: number): number[] => Array.from({ length: count }, (_, slot) => slot);
  return { system: 'shard.nalati-grasslands.creature-views', before: [], budget: { pages: 1, ioBytes: 8192, fuel: 200_000, targetMs: .5 },
    pools: [{ id: 'balbal', group: 'species:balbal', count: BALBALS, fields: ['field', 'has:rise', 'rise', 'attackPhase', 'seed', 'scale', 'has:floorY', 'floorY'] },
      { id: 'eagle', group: 'species:eagle', count: EAGLES, fields: ['seed', 'has:altY', 'altY', 'altS'] }],
    samples: [{ kind: 'constant', value: BALBALS }, { kind: 'constant', value: EAGLES }, { kind: 'pool', pool: 'balbal' }, { kind: 'pool', pool: 'eagle' }],
    channels: [...slots(BALBALS).flatMap(slot => [{ kind: 'color' as const, object: { pool: 'balbal', slot, part: 'balbal-cracks' }, color: [1, .46, .1] as [number, number, number] },
      { kind: 'field' as const, pool: 'balbal', slot, field: 'yOffset' }]),
    ...slots(EAGLES).map(slot => ({ kind: 'field' as const, pool: 'eagle', slot, field: 'yOffset' }))],
    transforms: [], bounds: { translation: 0, scale: [1, 1], shear: 0 } };
}
