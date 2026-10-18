import { SIGNAL_WEATHER_FIELDS } from './weatherFields';
import { SIGNAL_EMITTERS } from './lightEmitters';
import { WHIP_HELD_RECIPE } from './rows/heldWeapon';
import { parseExplorerCatalogue } from '@wildshard/format/explorerCatalogue';
import { SIGNAL_SCENE_BLOBS, SIGNAL_WORLD_SCENES } from './worldScenes';
import { emitNamedBlobs } from '@wildshard/sdk/blobs';
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
import { SKITTERER_DECISION, SKITTERER_MOVES } from './rows/skittererDecision';

/** Both page and native owners consume the same verified decision and mechanics. */
const sources = emitNamedBlobs(SIGNAL_SCENE_BLOBS);
export const output = { namedFiles: sources.files, assets: sources.assets, platform: emitPlatformSections(new Map<PlatformDataSectionName, unknown>([
  ['ui/strings', STRINGS],
  ['client/plan', { version: 1, features: [{ kind: 'world.scenes' }, { kind: 'light.emitters', rows: SIGNAL_EMITTERS }, { kind: 'weather.fields', rows: SIGNAL_WEATHER_FIELDS, quest: 'sunscar.signal' }] }],
    ['explore/catalogue', parseExplorerCatalogue({"version": 1, "entries": [{"kind": "held", "item": WHIP_HELD_RECIPE.equipment.id}, {"kind": "rigs", "library": "models"}, {"kind": "npc", "npc": "sunscar.scout"}, {"kind": "scene", "part": "tower.root"}, {"kind": "scene", "part": "caravan.root"}, {"kind": "scene", "part": "well.root"}, {"kind": "scene", "part": "brazier.0.root"}]})],
    ['world/scenes', SIGNAL_WORLD_SCENES],
    ['actors/species-programs', { page: SIGNAL_PAGE_PROGRAM.species.page, native: [], program: SIGNAL_PAGE_PROGRAM.species.program }],
    ['sim/runtime-plan', { kind: 'held-melee', recipe: SIGNAL_NATIVE_WORLD, baked }],
  ['sim/scripts', [...MATRIARCH_DECISION, SKITTERER_DECISION]], ['actors/moves', [...MATRIARCH_MOVES, ...SKITTERER_MOVES]], ['actors/strikes', SIGNAL_STRIKES],
  ['world/targets', SIGNAL_LASH_TARGETS],
])) } satisfies ProjectOutput;
