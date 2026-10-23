import { ELITE_VIEW_FIELDS, eliteViewSource, eliteViewTell } from '@wildshard/format/eliteFeature';
import type { ViewProgramRows } from '@wildshard/format/viewProgram';

/**
 * Nalati zero R9 (G621): the external elites' lane tells as a view program (behaviour/eliteViews.as) over the values
 * each elite lends by its def id: the elite count, then per elite its ELITE_VIEW_FIELDS. Its channels: per elite its
 * lane tell's lane parameters, in the order the module writes them.
 */
export function nalatiEliteViews(elites: readonly string[]): ViewProgramRows {
  return { system: 'shard.nalati-grasslands.elite-views', before: [], budget: { pages: 1, ioBytes: 4096, fuel: 50_000, targetMs: .2 },
    pools: [],
    samples: [{ kind: 'constant', value: elites.length },
      ...elites.flatMap(elite => ELITE_VIEW_FIELDS.map(field => ({ kind: 'value' as const, source: eliteViewSource(elite), field })))],
    channels: elites.flatMap(elite => (['x', 'z', 'x1', 'z1', 'width', 'alpha'] as const).map(param => ({ kind: 'tell' as const, tell: eliteViewTell(elite), param }))),
    transforms: [], bounds: { translation: 0, scale: [1, 1], shear: 0 } };
}
