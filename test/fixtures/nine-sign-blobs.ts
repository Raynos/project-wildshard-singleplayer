// oxlint-disable-next-line import/no-nodejs-modules -- Fixture owns and removes only its isolated source cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the defining real author root.
import { resolve } from 'node:path';
import { type NamedBlob } from '../../src/sdk/blobs';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { nineSignsProgram } from '../../src/shards/nine-dragon-stack/generators/signsProgram';
import { nativeSignAtlas } from './nine-native-atlas';
/** Exercise the same owned source/cache operation as the product writer. */
export async function nineSignBlobs(): Promise<NamedBlob[]> {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-sign-blobs-'));
  try { return [...(await nineSignsProgram(createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'f'.repeat(64), new Map(), cache), nativeSignAtlas)).blobs]; }
  finally { rmSync(cache, { recursive: true, force: true }); }
}
