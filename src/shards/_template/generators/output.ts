import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import boss from '../behaviour/boss.json' with { type: 'json' };
import { BOSS_MOVES, bossDecision } from '../data/bossDecision';

/** CLI-only named bytes and section emission. The Template remains runtime-free. */
export const output = {
  blobs: [{ name: 'ui/map', kind: 'image', source: 'assets/map.webp' },
    { name: 'behaviour/boss.wasm', kind: 'wasm', source: `assets/${boss.hash}`,
      options: { script: { abi: 1, pages: 1 }, critical: true } }],
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
    ['sim/scripts', [bossDecision(`blobs/wasm/${boss.hash}.wasm`)]], ['actors/moves', BOSS_MOVES],
  ])),
} satisfies ProjectOutput;
