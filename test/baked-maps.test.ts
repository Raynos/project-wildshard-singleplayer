// SF66 (G246 / G247): every shard's map is baked from its world (scripts/bake-maps.mjs) and stamped with the hash of the
// files that place that world; a world change without a rebake fails here, in the push gate and CI, before it deploys.
import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the shipped stamps and images and owns a temporary fixture.
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture's temporary folder.
import { tmpdir } from 'node:os';
import { mapShards, mapTilesHash } from '../scripts/map-hash.mjs';

const root = `${import.meta.dirname}/..`;
const join = (...parts: string[]): string => parts.join('/');
const REBAKE = 'rebake: node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> --shards=';
interface Stamp { version: number; tilesHash: string; image: string; size: number; metres: number }
const isStamp = (v: unknown): v is Stamp => typeof v === 'object' && v !== null && 'tilesHash' in v && 'image' in v && 'size' in v && 'metres' in v;

describe('baked maps (SF66)', () => {
  const shards = mapShards(root);
  it('finds every shard project', () => { expect(shards.length).toBeGreaterThanOrEqual(7); });
  for (const { slug, dir } of shards) {
    it(`${slug}: the shipped map matches its world`, () => {
      const path = join(dir, 'look', 'map.baked.json');
      expect(existsSync(path), `${slug} has no baked map; ${REBAKE}${slug}`).toBe(true);
      const stamp: unknown = JSON.parse(readFileSync(path, 'utf8'));
      if (!isStamp(stamp)) throw new Error(`${path}: not a map stamp`);
      expect(stamp.tilesHash, `${slug}'s map is stale (its world changed); ${REBAKE}${slug}`).toBe(mapTilesHash(dir));
      const image = join(root, 'public', stamp.image);
      expect(existsSync(image), `${slug}: ${stamp.image} is missing`).toBe(true);
      expect(statSync(image).size).toBeLessThan(1_200_000); // G246: about 1 MB compressed at most
      expect(stamp.metres).toBe(500);
    });
  }
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
