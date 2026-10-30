import { nativeCompilers } from './nativeCompilers';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the fixture's existing native production cache root.
import { homedir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep the fixture's explicit production input roots.
import { resolve } from 'node:path';
import type { Shardfile } from '../../src/sdk/shardfile';
import { generate } from '../../src/shards/pine-hollow/generators/generate';
import { prepareOutput } from '../../src/shards/pine-hollow/generators/sourceOutput';
import { pineJournal } from '../../src/shards/pine-hollow/generators/journal';
import { pineKingKit } from '../../src/shards/pine-hollow/generators/publicInputs';
import { pineBirds } from '../../src/shards/pine-hollow/generators/birdInputs';
import { pineNpcSkins } from '../../src/shards/pine-hollow/generators/npcSkinInputs';
import { wildlifeDraw } from '../../src/shards/pine-hollow/generators/wildlifeDraw';
import { pineGeneration } from './pine-generation';
import { runSnapshot } from './runSnapshot';

// GR8: Pine's producers run in its program (generate(ctx), prepareOutput(ctx)), so tests read what the program
// admits, not the static rows the retired scheduler jobs used to fill. One run per CI run (CI7 snapshot), else per file.
const program = await runSnapshot('pine-program', async () => {
  const assets = new Map<string, Uint8Array>();
  const context = { ...pineGeneration('pine-program-fixture-v1', resolve(homedir(), '.cache/wildshard/gen'), assets), ...nativeCompilers };
  const shard = (await generate(context)).shard, handed = new Map(assets);
  return { shard, assets: handed, journal: await pineJournal(context), kingKit: await pineKingKit(context),
    wildlifeDraw: wildlifeDraw((await pineBirds(context)).ranges), npcSkins: (await pineNpcSkins(context)).rows,
    prepared: await prepareOutput(context) };
});
/** Pine's declaration as its source program admits it. */
export const PINE: Shardfile = program.shard;
/** The bytes Pine's program handed its product with `ctx.asset` (the splat ground's tiles and layers), by hash. */
export const PINE_ASSETS: ReadonlyMap<string, Uint8Array> = program.assets;
/** Pine's journal (its admitted row, files and named images), as the program computes it. */
export const PINE_JOURNAL: Awaited<ReturnType<typeof pineJournal>> = program.journal;
/** The Antler King's baked kit (its named pool and rows), as the program bakes it. */
export const PINE_KING_KIT: Awaited<ReturnType<typeof pineKingKit>> = program.kingKit;
/** The wildlife draw rows over the program's bird bake (its rest ranges). */
export const PINE_WILDLIFE_DRAW: ReturnType<typeof wildlifeDraw> = program.wildlifeDraw;
/** The people's baked skins by kind and tier (product names, source GLBs and their metadata), as the program bakes them. */
export const PINE_NPC_SKINS: Awaited<ReturnType<typeof pineNpcSkins>>['rows'] = program.npcSkins;
/** Pine's prepared output (sections, named files and their bytes). */
export const PINE_PREPARED_OUTPUT: Awaited<ReturnType<typeof prepareOutput>> = program.prepared;
