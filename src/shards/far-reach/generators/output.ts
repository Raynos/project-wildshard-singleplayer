import { SKY_GUST_TARGETS } from './gustTargets';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { ROC_DECISION, ROC_MOVES, ROC_WORLD_TARGETS } from './rows/rocDecision';
import { ROC_STRIKES } from '../data/brains';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { SKY_NATIVE_WORLD } from '../data/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** Build-only native declarations; runtime/ contains client presentation only. */
export const output = {
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
    ['sim/runtime-plan', { kind: 'held-melee', recipe: SKY_NATIVE_WORLD, baked }],
    ['sim/scripts', ROC_DECISION], ['actors/moves', ROC_MOVES], ['actors/strikes', ROC_STRIKES], ['world/targets', { targets: SKY_GUST_TARGETS, spots: ROC_WORLD_TARGETS.spots }],
  ])),
} satisfies ProjectOutput;
