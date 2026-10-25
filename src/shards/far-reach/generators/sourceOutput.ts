import { SKY_CLIENT_PLAN } from './clientPlan';
import { skyPaintedPresentation, SKY_PAINTED_ATTRIBUTE_SOURCES } from './paintedLook';
import { FAN_ID } from './rows/items';
import { SKY_SCENE_BLOBS, SKY_WORLD_SCENES } from './worldScenes';
import { emitNamedBlobs, nameBlob } from '@wildshard/sdk/blobs';
import STRINGS from '../data/strings.json' with { type: 'json' };
import { SKY_PAGE_PROGRAM } from './rows/population';
import { SKY_GUST_TARGETS } from './gustTargets';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import { ROC_DECISION, ROC_MOVES, ROC_WORLD_TARGETS } from './rows/rocDecision';
import { ROC_STRIKES } from './rows/brains';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { SKY_NATIVE_WORLD } from './rows/nativeWorld';
import { skyPhysics } from './physics';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { preparedModelProgram } from './preparedModelProgram';
import { skyHeroSource } from './sceneSources';

type SectionName = Parameters<Parameters<typeof emitPlatformSections>[0]['get']>[0];
/** Build-only declarations; the compiled client features own all presentation. */
const sources = emitNamedBlobs(SKY_SCENE_BLOBS);
// Match the retained writer's JSON transport, including omitted optional fields.
const physicsJson = JSON.stringify(skyPhysics());
const baked: unknown = JSON.parse(physicsJson);
export const output = { blobs:SKY_PAINTED_ATTRIBUTE_SOURCES,namedFiles: sources.files, assets: sources.assets,
  platform: emitPlatformSections(new Map<SectionName, unknown>([
    ['ui/strings', STRINGS],
    ['client/plan', SKY_CLIENT_PLAN],
    ['look/painted', skyPaintedPresentation()],
    ['explore/catalogue', {"version": 1, "entries": [{"kind": "held", "item": FAN_ID}, {"kind": "scene", "part": "specimen-mill.root"}, {"kind": "scene", "part": "specimen-bridge.root"}, {"kind": "scene", "part": "specimen-vane.root"}, {"kind": "rigs", "library": "sky"}, {"kind": "npc", "npc": "far.keeper"}]}],
    ['world/scenes', SKY_WORLD_SCENES],
    ['actors/species-programs', { page: SKY_PAGE_PROGRAM.species.page.map(({ body: _body, brain: _brain, ...row }) => row), native: [], program: SKY_PAGE_PROGRAM.species.program }],
    ['sim/runtime-plan', { kind: 'held-melee', recipe: SKY_NATIVE_WORLD, baked }],
    ['sim/scripts', ROC_DECISION], ['actors/moves', ROC_MOVES], ['actors/strikes', ROC_STRIKES], ['world/targets', { targets: SKY_GUST_TARGETS, spots: ROC_WORLD_TARGETS.spots }],
  ])),
} satisfies ProjectOutput;

/** Publish the original prepared geometry through normal named-file admission and native pool resolution. */
export async function prepareOutput(ctx: ProjectGenerationContext): Promise<typeof output> {
  const name = 'world/geometry/prepared-models.glb';
  const geometry = nameBlob(name, 'glb', await preparedModelProgram(ctx)), hero = skyHeroSource(name);
  const previous = output.namedFiles.find(file => file.name === hero.file.name);
  if (previous === undefined) throw new Error('Missing original hero library output');
  const assets = new Map(output.assets);
  assets.delete(previous.hash); assets.set(geometry.file.hash, geometry.bytes); assets.set(hero.file.hash, hero.bytes);
  return { ...output, namedFiles: [...output.namedFiles.map(file => file.name === hero.file.name ? hero.file : file), geometry.file], assets };
}
