import { SIGNAL_CLIENT_PLAN } from './clientPlan';
import { signalPaintedPresentation } from './paintedLook';
import { WHIP_ROW } from './rows/equipment';
import { SIGNAL_SCENE_BLOBS, SIGNAL_WORLD_SCENES, type signalWorldScenes } from './worldScenes';
import { emitNamedBlobs, type NamedBlob } from '@wildshard/sdk/blobs';
import STRINGS from '../data/strings.json' with { type: 'json' };
import { SIGNAL_PAGE_PROGRAM } from './rows/population';
import { emitPlatformSections } from '@wildshard/sdk/platformSections';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import { MATRIARCH_DECISION, MATRIARCH_MOVES } from './rows/matriarchDecision';
import { SIGNAL_NATIVE_WORLD } from './rows/nativeWorld';
import { SIGNAL_PHYSICS } from './physics';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { SIGNAL_STRIKES } from './rows/brains';
import { SIGNAL_LASH_TARGETS } from './lashTargets';
import { SKITTERER_DECISION, SKITTERER_MOVES } from './rows/skittererDecision';

type SectionName = Parameters<typeof emitPlatformSections>[0] extends ReadonlyMap<infer Name, unknown> ? Name : never;

// The retired JSON writer normalized signed zero before plain-data admission.
const baked: unknown = JSON.parse(encodeCanonicalJson(SIGNAL_PHYSICS));

const baseline = { blobs: SIGNAL_SCENE_BLOBS, worldScenes: SIGNAL_WORLD_SCENES };
/** The original required scene output fields, without optional project-output widening. */
export interface SignalSceneOutput { readonly namedFiles: ReturnType<typeof emitNamedBlobs>['files'];
  readonly assets: ReturnType<typeof emitNamedBlobs>['assets']; readonly platform: ReturnType<typeof emitPlatformSections> }
/** Both owners consume the same verified decisions and mechanics with explicit scene files and bindings. */
export function signalSceneOutput(scene: ReturnType<typeof signalWorldScenes>): SignalSceneOutput {
  const sources = emitNamedBlobs(scene.blobs);
  return { namedFiles: sources.files, assets: sources.assets, platform: emitPlatformSections(new Map<SectionName, unknown>([
    ['ui/strings', STRINGS],
    ['look/painted', signalPaintedPresentation()],
    ['client/plan', SIGNAL_CLIENT_PLAN],
      ['explore/catalogue', {"version": 1, "entries": [{"kind": "held", "item": WHIP_ROW.id}, {"kind": "rigs", "library": "models"}, {"kind": "npc", "npc": "sunscar.scout"}, {"kind": "scene", "part": "tower.root"}, {"kind": "scene", "part": "caravan.root"}, {"kind": "scene", "part": "well.root"}, {"kind": "scene", "part": "brazier.0.root"}]}],
      ['world/scenes', scene.worldScenes],
      ['actors/species-programs', { page: SIGNAL_PAGE_PROGRAM.species.page, native: [], program: SIGNAL_PAGE_PROGRAM.species.program }],
      ['sim/runtime-plan', { kind: 'held-melee', recipe: SIGNAL_NATIVE_WORLD, baked }],
    ['sim/scripts', [...MATRIARCH_DECISION, SKITTERER_DECISION]], ['actors/moves', [...MATRIARCH_MOVES, ...SKITTERER_MOVES]], ['actors/strikes', SIGNAL_STRIKES],
    ['world/targets', SIGNAL_LASH_TARGETS],
  ])) } satisfies ProjectOutput;
}
export const output = signalSceneOutput(baseline);

/** Preserve every original section and scene file while replacing owned model inputs. */
export function signalSourceOutput(models: NamedBlob, rigs: readonly NamedBlob[], scene = baseline): ProjectOutput {
  if (models.file.name !== 'world/sources/models.json') throw new Error('Invalid model source replacement');
  const owned = emitNamedBlobs([...scene.blobs.filter(blob => blob.file.name !== models.file.name), models, ...rigs]);
  return { ...(scene === baseline ? output : signalSceneOutput(scene)), namedFiles: owned.files, assets: owned.assets };
}
