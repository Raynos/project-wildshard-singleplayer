// oxlint-disable-next-line import/no-nodejs-modules -- Each direct program fixture owns and removes its isolated cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The source program binds its defining author project explicitly.
import { resolve } from 'node:path';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { projectAssets } from '../../src/sdk/project';
import { generate } from '../../src/shards/sunscar-dunes/generators/generate';
import { signalProductRows as product } from '../../src/shards/sunscar-dunes/generators/product';
import { fireBookFile } from '../../src/shards/sunscar-dunes/generators/fireBookPixels';

mkdirSync('tmp', { recursive: true });
const cache = mkdtempSync(resolve('tmp', 'sunscar-program-fixture-')), assets = new Map<string, Uint8Array>();
const root = resolve('src/shards/sunscar-dunes');
/** Run the actual source program; no generated metadata stands in for its result. */
export const generated = await (async () => {
  try { return await generate(createProjectGeneration(root, 'a'.repeat(64), assets, cache)); }
  finally { rmSync(cache, { recursive: true, force: true }); }
})();
const fireBytes = [...assets.values()].find(bytes => bytes[0] === 0xab && bytes[1] === 0x4b && bytes[2] === 0x54 && bytes[3] === 0x58);
if (fireBytes === undefined || assets.size !== 13) throw new Error('Missing source-owned fire-book, rigs or world');
export const signalProductRows = () => product(fireBookFile(fireBytes));
export const source = generated.shard;
export const sourceAssets = projectAssets(root, source, 'project', assets);
