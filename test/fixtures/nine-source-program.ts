// oxlint-disable-next-line import/no-nodejs-modules -- Each direct program fixture owns and removes its isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind only the same explicit project/public roots as the author CLI.
import { resolve } from 'node:path';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { prepareAssetDecoders } from '../../src/format/product';
import { generate, type NineGeneratedProject } from '../../src/shards/nine-dragon-stack/generators/generate';

/** Run the real program, never a static metadata imitation of its result. */
export async function nineSourceProgram(): Promise<NineGeneratedProject> {
  await prepareAssetDecoders();
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-program-fixture-'));
  try {
    return await generate(createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/assets/', directory: resolve('public/assets') }]));
  } finally { rmSync(cache, { recursive: true, force: true }); }
}

export const generated = await nineSourceProgram();
export const output = generated.output;

export const source = generated.shard;
