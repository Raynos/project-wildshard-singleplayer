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
import { signalMap } from './mapProgram';
import { signalOwnedBoot } from './rows/boot';
import { signalRestFire } from './restFireProgram';
import { REST_URLS } from './rows/restFiles';

/** Build the original declaration and output together from their defining source functions. */
export async function generate(ctx: ProjectGenerationContext): Promise<GeneratedProject> {
  const fire = await signalFireBook(ctx), rigs = await signalRigs(ctx), world = await signalWorld(ctx), restFire = await signalRestFire(ctx), boot = signalOwnedBoot([REST_URLS[2]]), sand = await signalSand(ctx);
  const scene = signalWorldScenes(world.world, signalSceneSources(world.world, rigs.library, world.files, restFire.pool));
  const models = scene.blobs.find(blob => blob.file.name === 'world/sources/models.json');
  if (models === undefined) throw new Error('Missing world model descriptor');
  return { shard: signalProductRows(fire.file, sand), output: signalSourceOutput(models, [...rigs.blobs, ...world.blobs, restFire.blob], scene, signalClientPlan(signalQuestPage(signalQuestMarkers(world.world)))),
    map: { pixels: await signalMap(ctx), name: 'ui/map' },
    discovery: { 'boot.files': boot.files, 'boot.sources': boot.sources } };
}
