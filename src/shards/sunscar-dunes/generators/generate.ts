import type { GeneratedProject, ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { signalProductRows } from './product';
import { signalFireBook } from './fireBookProgram';
import { signalSourceOutput } from './sourceOutput';
import { signalRigs } from './rigProgram';
import { signalSceneSources } from './sceneSources';
import { signalWorld } from './worldProgram';
import { signalWorldScenes } from './worldScenes';
import { signalQuestMarkers } from './questMarkers';
import { signalQuestPage } from './questPage';
import { signalClientPlan } from './clientPlan';
import { signalSand } from './sandProgram';
import { signalNavigation } from './navigationProgram';
import { SIGNAL_DUNES_MAP } from './minimap';
import { placeBindings } from './restScene';
import { signalMap } from './mapProgram';
import { BUDGETS } from './rows/budgets';
import { SIGNAL_DEV_POSES } from './rows/devPoses';
import cues from '../data/cues.json' with { type: 'json' };
import { LATE_READS, signalOwnedBoot } from './rows/boot';
import { signalRestFire, signalRestWell, signalRestOil } from './restPoolProgram';
import { REST_URLS } from './rows/restFiles';

/** Build the original declaration and output together from their defining source functions. */
export async function generate(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  const navigation = await signalNavigation(ctx), fire = await signalFireBook(ctx), rigs = await signalRigs(ctx), world = await signalWorld(ctx), restFire = await signalRestFire(ctx), restWell = await signalRestWell(ctx), restOil = await signalRestOil(ctx), boot = signalOwnedBoot(REST_URLS), sand = await signalSand(ctx);
  const scene = signalWorldScenes(world.world, signalSceneSources(world.world, rigs.library, [restWell.pool, restOil.pool, restFire.pool], world.files), placeBindings());
  const models = scene.blobs.find(blob => blob.file.name === 'world/sources/models.json');
  if (models === undefined) throw new Error('Missing world model descriptor');
  return { shard: signalProductRows(fire.file, sand, navigation), output: signalSourceOutput(models, [...rigs.blobs, ...world.blobs, restFire.blob, restWell.blob, restOil.blob], scene, signalClientPlan(signalQuestPage(signalQuestMarkers(world.world)))),
    map: { pixels: await signalMap(ctx), name: 'ui/map' },
    discovery: { navigation, mapPalette: SIGNAL_DUNES_MAP, budgets: BUDGETS, poses: SIGNAL_DEV_POSES, audioCues: cues, 'boot.lateReads': LATE_READS, 'boot.files': boot.files, 'boot.sources': boot.sources } };
}
