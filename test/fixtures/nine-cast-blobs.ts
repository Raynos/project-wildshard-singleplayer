// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only this fixture's empty byte cache.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind only the existing author/public roots.
import { resolve } from 'node:path';
import type { NamedBlob } from '../../src/sdk/blobs';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { nineCastsProgram } from '../../src/shards/nine-dragon-stack/generators/castsProgram';
import { CAST_BLOBS } from '../../src/shards/nine-dragon-stack/generators/castSources';

async function sourceCasts(): Promise<Awaited<ReturnType<typeof nineCastsProgram>>> {
  mkdirSync('tmp', { recursive: true }); const cache = mkdtempSync(resolve('tmp', 'nine-cast-fixture-'));
  try { return await nineCastsProgram(createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'd'.repeat(64), new Map(), cache,
    [{ prefix: '/assets/', directory: resolve('public/assets') }])); }
  finally { rmSync(cache, { recursive: true, force: true }); }
}
export const CASTS = await sourceCasts();
/** The same owned intake as the source program, prepared before timed host assertions. */
export function nineCastBlobs(): Promise<NamedBlob[]> { return Promise.resolve([...CASTS.blobs, ...CAST_BLOBS]); }
/** Original uncompressed predecessor GLB, without reading a retired generated path. */
export function rawCast(name: string): Uint8Array {
  const bytes = CASTS.raw.get(name); if (bytes === undefined) throw new Error(`Missing source cast ${name}`); return bytes;
}
