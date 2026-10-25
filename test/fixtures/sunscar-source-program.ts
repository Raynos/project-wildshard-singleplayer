// oxlint-disable-next-line import/no-nodejs-modules -- Each direct program fixture owns and removes its isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The source program binds its defining author project explicitly.
import { resolve } from 'node:path';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { projectAssets } from '../../src/sdk/project';
import { signalSand } from '../../src/shards/sunscar-dunes/generators/sandProgram';
import { signalWorldFiles } from '../../src/shards/sunscar-dunes/generators/worldProgram';
import { signalWorldMetadata } from '../../src/shards/sunscar-dunes/generators/worldMetadata';
import { signalSceneSources } from '../../src/shards/sunscar-dunes/generators/sceneSources';
import { signalWorldScenes } from '../../src/shards/sunscar-dunes/generators/worldScenes';
import { signalSceneOutput } from '../../src/shards/sunscar-dunes/generators/sourceOutput';
import { whipHeldRecipe } from '../../src/shards/sunscar-dunes/generators/rows/heldWeapon';
import { gearSceneRows } from '../../src/shards/sunscar-dunes/generators/rows/gearModels';
import { signalQuestMarkers } from '../../src/shards/sunscar-dunes/generators/questMarkers';
import { signalQuestPage } from '../../src/shards/sunscar-dunes/generators/questPage';
import { signalClientPlan } from '../../src/shards/sunscar-dunes/generators/clientPlan';
import { generate } from '../../src/shards/sunscar-dunes/generators/generate';
import { signalProductRows as product } from '../../src/shards/sunscar-dunes/generators/product';
import { fireBookFile } from '../../src/shards/sunscar-dunes/generators/fireBookPixels';

mkdirSync('tmp', { recursive: true });
const cache = mkdtempSync(resolve('tmp', 'sunscar-program-fixture-')), assets = new Map<string, Uint8Array>();
const root = resolve('src/shards/sunscar-dunes');
/** Run the actual source program; no generated metadata stands in for its result. */
const built = await (async () => {
  try {
    const ctx = createProjectGeneration(root, 'a'.repeat(64), assets, cache);
    return { generated: await generate(ctx), world: signalWorldMetadata(await signalWorldFiles(ctx)), sand: await signalSand(ctx) };
  }
  finally { rmSync(cache, { recursive: true, force: true }); }
})();
export const { generated, world, sand } = built;
/** Original public-name projection from the actual bake, for unchanged full-byte oracles. */
export const held = whipHeldRecipe(world.lash), gear = gearSceneRows(world, held);
export const markers = signalQuestMarkers(world), page = signalQuestPage(markers), client = signalClientPlan(page);
export const sourceBlobs = signalSceneSources(world), scene = signalWorldScenes(world, sourceBlobs);
export const originalOutput = signalSceneOutput(scene, client);
const fireBytes = [...assets.values()].find(bytes => bytes[0] === 0xab && bytes[1] === 0x4b && bytes[2] === 0x54 && bytes[3] === 0x58);
if (fireBytes === undefined || assets.size !== 16) throw new Error('Missing source-owned fire-book, rigs or world');
export const signalProductRows = () => product(fireBookFile(fireBytes), sand);
export const source = generated.shard;
export const sourceAssets = projectAssets(root, source, 'project', assets);
