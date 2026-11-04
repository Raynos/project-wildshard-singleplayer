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

test('a resized named file changes only its own part', () => {
  // Twelve 1 MB models in one group: more than one part. Model 3 is re-exported larger under a new content name.
  const named = (at: number, bytes: number, edit = ''): SpawnFile => file(`/shardfiles/s/blobs/glb/${at}${edit}.glb`, bytes);
  const before = Array.from({ length: 12 }, (_, at) => named(at, 1_000_000));
  const after = before.map((row, at) => at === 3 ? named(3, 1_400_000, '-edited') : row);
  const keyOf = (url: string): string => `models/${/\/(\d+)(?:-edited)?\.glb$/u.exec(url)?.[1] ?? url}.glb`;
  // Bodies differ per file (the shared helper only varies with URL length, which would make equal parts collide).
  const seed = (url: string): number => Array.from(url, char => char.codePointAt(0) ?? 0).reduce((sum, code) => sum + code, 0);
  const read = (rows: SpawnFile[]) => (url: string): Uint8Array =>
    Uint8Array.from({ length: rows.find(row => row.url === url)?.bytes ?? 0 }, (_, at) => (seed(url) + at) % 251);
  const pack = (rows: SpawnFile[]): Map<string, string> => {
    const [parts] = writeSpawnParts(out, [manifest(rows)], read(rows), keyOf);
    return new Map((parts ?? []).flatMap(part => part.members.map(([member]) => [rows[member]?.url ?? '', part.url] as const)));
  };
  const first = pack(before), second = pack(after);
  expect(new Set(first.values()).size).toBeGreaterThan(1);
  const changed = new Set<string>();
  for (const [url, part] of second) if (first.get(url) !== part) changed.add(part);
  // Only the edited model's part has new bytes; every other part keeps its exact name.
  expect([...changed]).toEqual([second.get(named(3, 0, '-edited').url)]);
});

test('two builds that differ only in shard.json stamps keep every part name', () => {
  // DL18: the product header (shard.json) carries the build's validator stamp; it stays loose, so parts depend only on
  // their content-named members.
  const members = Array.from({ length: 6 }, (_, at) => file(`/shardfiles/s/blobs/glb/${at}.glb`, 2_000_000));
  const header = (stamp: string): SpawnFile => file(`/shardfiles/s/shard.json?v=${stamp}`, 400);
  const parts = (stamp: string): string[] => {
    const rows = [header(stamp), ...members];
    const [table] = writeSpawnParts(out, [manifest(rows)], url => url.includes('shard.json') ? body(`${url}${stamp}`, 400) : body(url, 2_000_000));
    expect((table ?? []).some(part => part.members.some(([member]) => member === 0))).toBe(false);
    return (table ?? []).map(part => part.url).sort();
  };
  expect(packable('/shardfiles/s/shard.json?v=aaaaaaaa')).toBe(false);
  expect(parts('aaaaaaaa')).toEqual(parts('bbbbbbbb'));
});
