// oxlint-disable-next-line import/no-nodejs-modules -- The packer writes its parts into an owned ./tmp folder.
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Paths for the owned fixture folder.
import { join, resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { PART_BYTES, packable, spawnPartGroups, writeSpawnParts, type SpawnPartInput } from '../scripts/app-build/spawnParts';
import { readSpawnManifest, type SpawnFile } from '../src/format/spawnManifest';

mkdirSync('tmp', { recursive: true });
const out = mkdtempSync(resolve('tmp/spawn-parts-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));
const body = (url: string, bytes: number): Uint8Array => Uint8Array.from({ length: bytes }, (_, at) => (url.length * 31 + at) % 251);
const file = (url: string, bytes: number): SpawnFile => ({ url, bytes, hash: 'a'.repeat(64) });
const manifest = (rows: SpawnFile[], open = true): SpawnPartInput => ({ rows, public: open });

test('every manifest file is one aligned member of a shared part, with its exact bytes', () => {
  const shared = file('/assets/code-aaaaaaaa.js', 1001), a = file('/shardfiles/a/blobs/glb/1.glb', 333), b = file('/shardfiles/b/blobs/glb/2.glb', 77);
  const inputs = [manifest([shared, a]), manifest([shared, b]), manifest([a, b], false)];
  const tables = writeSpawnParts(out, inputs, url => body(url, [shared, a, b].find(row => row.url === url)?.bytes ?? 0));
  const packedAt = new Map<string, string>();
  tables.forEach((parts, index) => {
    const rows = inputs[index]?.rows ?? [];
    // The manifest grammar accepts the table as written.
    expect(readSpawnManifest({ version: 1, shard: 'a', tier: 'phone', flow: 'grid', files: rows, totalBytes: rows.reduce((sum, row) => sum + row.bytes, 0), parts }).parts).toEqual(parts);
    // Fetched files are members; JS modules stay loose (DL14).
    expect(parts.flatMap(part => part.members.map(([member]) => member)).sort((left, right) => left - right))
      .toEqual(rows.flatMap((row, at) => row.url.endsWith('.js') ? [] : [at]));
    for (const part of parts) {
      const bytes = readFileSync(join(out, part.url.slice(1)));
      expect(bytes.length).toBe(part.bytes);
      for (const [member, offset] of part.members) {
        const row = rows[member]; if (row === undefined) throw new Error('Missing member row');
        expect(offset % 16).toBe(0);
        expect(new Uint8Array(bytes.subarray(offset, offset + row.bytes))).toEqual(body(row.url, row.bytes));
        // A file lives in exactly one part, whichever manifest names it.
        expect(packedAt.get(row.url) ?? part.url).toBe(part.url); packedAt.set(row.url, part.url);
      }
    }
  });
});

test('public entries steer the merge within the over-fetch cap; the grammar refuses broken tables', () => {
  // Entry 0 needs a shared core and twelve small files; entry i needs the core and small file i. That is 13 groups
  // for entry 0, so small groups merge while each entry's added bytes stay within 10 % of its own.
  const rows = Array.from({ length: 12 }, (_, at) => file(`/shardfiles/s/blobs/bin/${at}.bin`, 1000));
  const setOf = (core: SpawnFile): SpawnPartInput[] => [manifest([core, ...rows]), ...rows.map(row => manifest([core, row]))];
  const parts = (groups: ReturnType<typeof spawnPartGroups>): number => groups.filter(group => group.members.has(0)).length;
  const roomy = spawnPartGroups(setOf(file('/shardfiles/s/blobs/bin/core.bin', 1_000_000)));
  expect(parts(roomy)).toBeLessThanOrEqual(10);
  expect(roomy.reduce((sum, group) => sum + group.bytes, 0)).toBe(1_012_000); // every file once, nothing copied
  // With a 5 KB core, any merge adds 1 KB to an entry of 6 KB (17 %): the cap holds and nothing merges.
  expect(parts(spawnPartGroups(setOf(file('/shardfiles/s/blobs/bin/core.bin', 5000))))).toBe(13);
  // A file larger than a part is refused: every part stays within 12 MB.
  const big = file('/shardfiles/s/blobs/bin/big.bin', PART_BYTES + 1);
  expect(() => writeSpawnParts(out, [manifest([big])], () => new Uint8Array(PART_BYTES + 1))).toThrow('Spawn file larger than a part');
  // Shard images are fetched, so they pack; the shell's /assets/ images and code stay loose.
  expect(packable('/shardfiles/s/blobs/png/a.png')).toBe(true);
  expect(packable('/assets/title/hero-0123abcd.webp')).toBe(false); expect(packable('/assets/code-0123abcd.js')).toBe(false);
  const base = { version: 1, shard: 's', tier: 'phone', flow: 'grid', files: [rows[0], rows[1]], totalBytes: 2000 } as const;
  const part = (members: [number, number][]) => ({ url: `/assets/spawn/parts/${'b'.repeat(16)}.pack`, bytes: 4096, hash: 'b'.repeat(64), members });
  expect(() => readSpawnManifest({ ...base, parts: [part([[0, 0], [1, 1000]])] })).toThrow('Invalid spawn part member'); // overlap + misaligned
  expect(() => readSpawnManifest({ ...base, parts: [part([[0, 0]]), part([[0, 1008]])] })).toThrow('Invalid spawn part member'); // packed twice
  expect(() => readSpawnManifest({ ...base, parts: [part([[0, 0], [1, 3200]])] })).toThrow('Invalid spawn part member'); // past the end
  expect(readSpawnManifest({ ...base, parts: [part([[0, 0], [1, 1008]])] }).parts?.[0]?.members).toEqual([[0, 0], [1, 1008]]);
});
