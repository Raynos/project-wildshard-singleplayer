import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import boss from '../behaviour/boss.json' with { type: 'json' };
import decision from '../data/bossDecision.json' with { type: 'json' };
import moves from '../data/moves.json' with { type: 'json' };

/** CLI-only named bytes and section emission. The Template remains runtime-free. */
export const output = {
  blobs: [{ name: 'ui/map', kind: 'image', source: 'assets/map.webp' },
    { name: 'behaviour/boss.wasm', kind: 'wasm', source: `assets/${boss.hash}`,
      options: { script: { abi: 1, pages: 1 }, critical: true } }],
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
    ['ui/completion', { doneFlag: 'template.complete', seenFlag: 'template.complete-card', trigger: 'quest', system: 'game.completion', before: ['main.world'], after: [],
      title: 'Template shard', card: { kicker: 'A first adventure · complete', flavour: [] },
      menuSubtitle: 'Your first adventure', toastSuffix: ' complete', safeRadius: 25, pollSeconds: 1, maximumTodo: 7, more: 'more', coveredEvents: [], groups: [], stats: [] }],
    ['sim/scripts', [{ ...decision, module: `blobs/wasm/${boss.hash}.wasm` }]], ['actors/moves', moves],
  ])),
} satisfies ProjectOutput;
