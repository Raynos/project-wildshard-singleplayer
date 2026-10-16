import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { MATRIARCH_DECISION, MATRIARCH_MOVES } from '../data/matriarchDecision';
import { SIGNAL_NATIVE_WORLD } from '../data/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };
import { SIGNAL_STRIKES } from '../data/brains';

/** Both page and native owners consume the same verified decision and mechanics. */
export const output = { platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
  ['sim/runtime-plan', { kind: 'held-melee', recipe: SIGNAL_NATIVE_WORLD, baked }],
  ['sim/scripts', MATRIARCH_DECISION], ['actors/moves', MATRIARCH_MOVES], ['actors/strikes', SIGNAL_STRIKES],
])) } satisfies ProjectOutput;
