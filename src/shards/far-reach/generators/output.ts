import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { SKY_NATIVE_WORLD } from '../data/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** Build-only native declarations; runtime/ contains client presentation only. */
export const output = {
  platform: emitPlatformSections(new Map([['sim/runtime-plan', { kind: 'held-melee', recipe: SKY_NATIVE_WORLD, baked }]])),
} satisfies ProjectOutput;
