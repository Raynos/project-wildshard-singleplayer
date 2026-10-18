import { SKY_CLIENT_PLAN } from './clientPlan';
import { skyPaintedPresentation } from './paintedLook';
import { FAN_ID } from './rows/items';
import { parseExplorerCatalogue } from '@wildshard/format/explorerCatalogue';
import { SKY_SCENE_BLOBS, SKY_WORLD_SCENES } from './worldScenes';
import { emitNamedBlobs } from '@wildshard/sdk/blobs';
import STRINGS from '../data/strings.json' with { type: 'json' };
import { SKY_PAGE_PROGRAM } from './rows/population';
import { SKY_GUST_TARGETS } from './gustTargets';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { PlatformDataSectionName } from '@wildshard/format/platformDataSections';
import { ROC_DECISION, ROC_MOVES, ROC_WORLD_TARGETS } from './rows/rocDecision';
import { ROC_STRIKES } from './rows/brains';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { SKY_NATIVE_WORLD } from './rows/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** Build-only declarations; the compiled client features own all presentation. */
const sources = emitNamedBlobs(SKY_SCENE_BLOBS);
export const output = { namedFiles: sources.files, assets: sources.assets,
  platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
    ['ui/strings', STRINGS],
    ['client/plan', SKY_CLIENT_PLAN],
    ['look/painted', skyPaintedPresentation()],
    ['explore/catalogue', parseExplorerCatalogue({"version": 1, "entries": [{"kind": "held", "item": FAN_ID}, {"kind": "scene", "part": "specimen-mill.root"}, {"kind": "scene", "part": "specimen-bridge.root"}, {"kind": "scene", "part": "specimen-vane.root"}, {"kind": "rigs", "library": "sky"}, {"kind": "npc", "npc": "far.keeper"}]})],
    ['world/scenes', SKY_WORLD_SCENES],
    ['actors/species-programs', { page: SKY_PAGE_PROGRAM.species.page.map(({ body: _body, brain: _brain, ...row }) => row), native: [], program: SKY_PAGE_PROGRAM.species.program }],
    ['sim/runtime-plan', { kind: 'held-melee', recipe: SKY_NATIVE_WORLD, baked }],
    ['sim/scripts', ROC_DECISION], ['actors/moves', ROC_MOVES], ['actors/strikes', ROC_STRIKES], ['world/targets', { targets: SKY_GUST_TARGETS, spots: ROC_WORLD_TARGETS.spots }],
  ])),
} satisfies ProjectOutput;
