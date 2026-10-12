// oxlint-disable-next-line import/no-nodejs-modules -- Exercise real immutable payload admission and exact content identities.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/format/shardSchema';
import { encodeTerrainTile, terrainTileCost } from '../src/format/terrainTileBytes';
import { preflightAssetGraph, performanceReport } from '../src/format/product';
import { preflightDeclaredCosts, validateShardfileAssets } from '../src/format/assetAdmission';
import { NEAR_PLACEHOLDER_LIMITS } from '../src/format/nearPlaceholder';
import { contentCost } from '../src/format/contentCost';

const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const base = () => emptyShardfile({ slug: 'near-fixture', name: 'Near', author: 'Fixture', seed: 1, revision: 1 });
function fixture() {
  const assets = new Map<string, Uint8Array>(), files = [], terrain = [];
  for (let z = 0; z < 4; z++) for (let x = 0; x < 4; x++) {
    const data = { resolution: 17, size: 125, x: -250 + x * 125, z: -250 + z * 125,
      heights: new Float32Array(17 ** 2), colours: new Float32Array(17 ** 2 * 3) };
    const bytes = encodeTerrainTile(data), ref = hash(bytes);
    files.push({ hash: ref, kind: 'binary' as const, compressed: bytes.length, ...terrainTileCost(data), dependencies: [], critical: false });
    assets.set(ref, bytes); terrain.push({ x, z, file: ref });
  }
  const source = parseShardfile({ ...base(), files, near: { version: 1, terrain, content: [] } });
  return { source, assets };
}

it('admits real coloured L1 bytes through a distinct charged render closure without simulation roots', () => {
  const { source, assets } = fixture();
  expect(() => preflightAssetGraph(source)).not.toThrow();
  const admitted = validateShardfileAssets(source, assets, hash);
  expect(admitted.near).toEqual(source.near);
  expect(admitted.sim).toEqual(base().sim); expect(admitted.critical).toEqual([]);
  expect(admitted.terrain).toBeNull(); expect(admitted.meshCollision).toBeNull(); expect(admitted.props).toBeNull();
  const report = performanceReport(source, { scripts: { p95Micros: 0, maxMicros: 0, samples: 60 }, fuel: { p95: 0, max: 0, samples: 60 } });
  const bytes = [...assets.values()].reduce((sum, value) => sum + value.length, 0);
  expect(report.download).toMatchObject({ near: bytes, total: bytes, playable: 0 });
  expect(preflightDeclaredCosts(source).worst.playing).toBeGreaterThan(preflightDeclaredCosts(base()).worst.playing);
});

it('refuses orphan/missing roots, false costs and a valid payload assigned to the wrong L1 address', () => {
  const { source, assets } = fixture();
  const orphan = structuredClone(source); delete orphan.near;
  expect(() => preflightAssetGraph(orphan)).toThrow('Orphan');
  expect(() => parseShardfile({ ...source, files: [] })).toThrow();
  const falseCosts = structuredClone(source);
  for (const row of falseCosts.files) { row.decoded = 0; row.gpu = 0; }
  expect(() => validateShardfileAssets(falseCosts, assets, hash)).toThrow('understated');
  const wrong = structuredClone(source), first = wrong.near?.terrain[0], second = wrong.near?.terrain[1];
  if (first === undefined || second === undefined) throw new Error('Missing near fixture');
  const ref = first.file; first.file = second.file; second.file = ref;
  expect(() => validateShardfileAssets(wrong, assets, hash)).toThrow('declared coloured L1');
});

it('keeps omitted tiers byte-equivalent and charges the explicit near line in the common playing envelope', () => {
  const source = base(); expect(Object.hasOwn(source, 'near')).toBe(false);
  const input = { l0: 0, l1: 0, far: 0, libraries: 0, sims: 0, commons: 0, overlap: 0 };
  expect(contentCost({ ...input, near: 0 })).toEqual(contentCost(input));
  const before = contentCost(input), after = contentCost({ ...input, near: NEAR_PLACEHOLDER_LIMITS.residentBytes });
  expect(after.accounted - before.accounted).toBe(NEAR_PLACEHOLDER_LIMITS.residentBytes);
  expect(after.playing).toBeGreaterThan(before.playing);
  expect(performanceReport(source, { scripts: { p95Micros: 0, maxMicros: 0, samples: 60 }, fuel: { p95: 0, max: 0, samples: 60 } }).download).not.toHaveProperty('near');
});
