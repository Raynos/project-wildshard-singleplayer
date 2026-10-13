// SF66 (G246 / G247): every shard's map is baked from its world (scripts/bake-maps.mjs) and stamped with the hash of the
// files that place that world; a world change without a rebake fails here, in the push gate and CI, before it deploys.
import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the shipped stamps and images and owns a temporary fixture.
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture's temporary folder.
import { tmpdir } from 'node:os';
import { writeImagePixels } from '@wildshard/sdk/bake/image';
import { mapPixelHash, mapShards, mapTilesHash, verifyMapPixels, writeMapStamp } from '../scripts/map-hash.mjs';

const root = `${import.meta.dirname}/..`;
const join = (...parts: string[]): string => parts.join('/');
const REBAKE = 'rebake: node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=';
interface Stamp { version: number; tilesHash: string; pixelHash: string; image: string; size: number; metres: number }
const isStamp = (v: unknown): v is Stamp => typeof v === 'object' && v !== null && 'tilesHash' in v && 'image' in v && 'size' in v && 'metres' in v && 'pixelHash' in v && typeof v.pixelHash === 'string';

describe('baked maps (SF66)', () => {
  const shards = mapShards(root);
  it('finds every shard project', () => { expect(shards.length).toBeGreaterThanOrEqual(7); });
  for (const { slug, dir } of shards) {
    it(`${slug}: the shipped map matches its world and recorded pixels`, async () => {
      const path = join(dir, 'look', 'map.baked.json');
      expect(existsSync(path), `${slug} has no baked map; ${REBAKE}${slug}`).toBe(true);
      const stamp: unknown = JSON.parse(readFileSync(path, 'utf8'));
      if (!isStamp(stamp)) throw new Error(`${path}: not a map stamp`);
      expect(stamp.tilesHash, `${slug}'s map is stale (its world changed); ${REBAKE}${slug}`).toBe(mapTilesHash(dir));
      const image = join(root, 'public', stamp.image);
      expect(existsSync(image), `${slug}: ${stamp.image} is missing`).toBe(true);
      expect(statSync(image).size).toBeLessThan(1_200_000); // G246: about 1 MB compressed at most
      await verifyMapPixels(image, stamp.pixelHash);
      expect(stamp.metres).toBe(500);
    });
  }
  it('refuses a new bake stamp committed without its new image (fixture)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'map-pixels-'));
    try {
      const image = join(dir, 'top.webp'), next = join(dir, 'next.png');
      const oldPixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
      const newPixels = new Uint8ClampedArray([0, 0, 255, 255, 0, 255, 0, 255]);
      const oldBytes = await writeImagePixels({ width: 2, height: 1, pixels: oldPixels });
      const newBytes = await writeImagePixels({ width: 2, height: 1, pixels: newPixels });
      writeFileSync(image, oldBytes); writeFileSync(next, newBytes);
      const oldHash = await mapPixelHash(image), newHash = await mapPixelHash(next);
      await expect(verifyMapPixels(image, oldHash)).resolves.toBeUndefined();
      // Advancing only the producer's stamp leaves the old raster in the committed tree.
      await expect(verifyMapPixels(image, newHash)).rejects.toThrow('decoded pixels differ');
      await expect(verifyMapPixels(image, '')).rejects.toThrow('decoded pixels differ');
      writeFileSync(image, newBytes);
      await expect(verifyMapPixels(image, newHash)).resolves.toBeUndefined();
      // Identical bytes with different dimensions must not alias the same raster.
      writeFileSync(next, await writeImagePixels({ width: 1, height: 2, pixels: newPixels }));
      expect(await mapPixelHash(next)).not.toBe(newHash);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('a world file added without a rebake changes the hash; a non-input file does not (fixture)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'map-hash-'));
    try {
      mkdirSync(join(dir, 'world'));
      writeFileSync(join(dir, 'world', 'a.ts'), 'export const A = 1;');
      const before = mapTilesHash(dir);
      writeFileSync(join(dir, 'world', 'piece.ts'), 'export const PIECE = { x: 4, z: 9 };');
      const added = mapTilesHash(dir);
      expect(added).not.toBe(before);
      writeFileSync(join(dir, 'README.md'), 'not a world input');
      expect(mapTilesHash(dir)).toBe(added);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

it('publishes the official raster and authored map companion together, refusing stale evidence first', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'map-companion-'));
  try {
    mkdirSync(join(dir, 'data')); mkdirSync(join(dir, 'assets'));
    const companion = join(dir, 'data/productMap.json'), authored = join(dir, 'assets/map.webp');
    writeFileSync(companion, '{}\n'); writeFileSync(authored, 'old raster');
    const image = join(dir, 'official.png');
    writeFileSync(image, await writeImagePixels({ width: 1, height: 1, pixels: new Uint8ClampedArray([1, 2, 3, 255]) }));
    const stamp = { version: 1, tilesHash: mapTilesHash(dir), pixelHash: await mapPixelHash(image), image: '/assets/fixture/map/top.webp', size: 1, metres: 500, north: '+z', east: '-x', style: 'stylized:ground', bytes: statSync(image).size };
    await expect(writeMapStamp(dir, image, { ...stamp, tilesHash: '0'.repeat(64) })).rejects.toThrow('world inputs changed');
    await expect(writeMapStamp(dir, image, { ...stamp, pixelHash: '0'.repeat(64) })).rejects.toThrow('decoded pixels differ');
    expect(readFileSync(companion, 'utf8')).toBe('{}\n');
    expect(readFileSync(authored, 'utf8')).toBe('old raster');
    expect(existsSync(join(dir, 'look/map.baked.json'))).toBe(false);
    await writeMapStamp(dir, image, stamp);
    expect(readFileSync(companion)).toEqual(readFileSync(join(dir, 'look/map.baked.json')));
    expect(readFileSync(authored)).toEqual(readFileSync(image));
    rmSync(authored);
    await expect(writeMapStamp(dir, image, stamp)).rejects.toThrow('incomplete authored map companion');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
