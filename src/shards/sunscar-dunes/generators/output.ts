import STRINGS from '../data/strings.json' with { type: 'json' };
import { SIGNAL_PAGE_PROGRAM } from './rows/population';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { MATRIARCH_DECISION, MATRIARCH_MOVES } from './rows/matriarchDecision';
import { SIGNAL_NATIVE_WORLD } from './rows/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };
import { SIGNAL_STRIKES } from './rows/brains';
import { SIGNAL_LASH_TARGETS } from './lashTargets';

/** Both page and native owners consume the same verified decision and mechanics. */
export const output = { platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
  ['ui/strings', STRINGS],
    ['actors/species-programs', { page: SIGNAL_PAGE_PROGRAM.species.page, native: [], program: SIGNAL_PAGE_PROGRAM.species.program }],
    ['sim/runtime-plan', { kind: 'held-melee', recipe: SIGNAL_NATIVE_WORLD, baked }],
  ['sim/scripts', MATRIARCH_DECISION], ['actors/moves', MATRIARCH_MOVES], ['actors/strikes', SIGNAL_STRIKES],
  ['world/targets', SIGNAL_LASH_TARGETS],
])) } satisfies ProjectOutput;
