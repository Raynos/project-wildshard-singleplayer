import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Shardfile } from '../../src/sdk/shardfile';
import { generate } from '../../src/shards/pine-hollow/generators/generate';
import { prepareOutput } from '../../src/shards/pine-hollow/generators/output';
import { pineJournal } from '../../src/shards/pine-hollow/generators/journal';
import { pineKingKit } from '../../src/shards/pine-hollow/generators/publicInputs';
import { pineGeneration } from './pine-generation';

// GR8: Pine's producers run in its program (generate(ctx), prepareOutput(ctx)), so tests read what the program
// admits, not the static rows the retired scheduler jobs used to fill. One run per test worker, over the shared cache.
const context = pineGeneration('pine-program-fixture-v1', resolve(homedir(), '.cache/wildshard/gen'));
/** Pine's declaration as its source program admits it. */
export const PINE: Shardfile = await generate(context);
/** Pine's journal (its admitted row, files and named images), as the program computes it. */
export const PINE_JOURNAL: Awaited<ReturnType<typeof pineJournal>> = await pineJournal(context);
/** The Antler King's baked kit (its named pool and rows), as the program bakes it. */
export const PINE_KING_KIT: Awaited<ReturnType<typeof pineKingKit>> = await pineKingKit(context);
/** Pine's prepared output (sections, named files and their bytes). */
export const PINE_PREPARED_OUTPUT: Awaited<ReturnType<typeof prepareOutput>> = await prepareOutput(context);
