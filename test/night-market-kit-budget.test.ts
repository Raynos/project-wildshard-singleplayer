// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated product wire fixtures, never generation or a shared product.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the actual two shared payloads in this transport-only fixture.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- All writes are confined to the owned fixture root.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The real Node reader must work without Vite masking its TS import boundary.
import { execFileSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import * as v from 'valibot';
import type { Shardfile } from '../src/format/shardSchema';
import { emptyShardfile } from '../src/sdk/author';
import { writeOutputProduct } from '../src/sdk/outputProduct';
import { readNightMarketKitBudget } from '../scripts/night-market-kit-budget.mjs';

const owned: string[] = [];
afterEach(() => { for (const folder of owned.splice(0)) rmSync(folder, { recursive: true }); });

function fixture(): { source: Shardfile; folder: string; payload: string; build: () => void } {
  mkdirSync('tmp', { recursive: true });
  const folder = resolve(mkdtempSync('tmp/night-market-kit-budget-')); owned.push(folder);
  const source = emptyShardfile({ slug: 'open-plot-night-market', name: 'Night Market', author: 'Test', revision: 1, seed: 1 });
  const bytes = Uint8Array.of(1, 2, 3), dependency = Uint8Array.of(4, 5);
  const digest = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
  const payload = digest(bytes), shared = digest(dependency);
  source.files = [{ hash: payload, kind: 'binary', compressed: 3, decoded: 4, gpu: 8, triangles: 3, draws: 1, dependencies: [shared], critical: false },
    { hash: shared, kind: 'binary', compressed: 2, decoded: 6, gpu: 10, triangles: 0, draws: 0, dependencies: [], critical: false }];
  source.tiles = ([0, 1] as const).flatMap(lod => Array.from({ length: lod === 0 ? 64 : 16 }, (_, i): Shardfile['tiles'][number] => {
    const count = lod === 0 ? 8 : 4, size = 500 / count, x = i % count, z = Math.floor(i / count);
    return { lod, x, z, files: [payload], bounds: { min: [-250 + x * size, 0, -250 + z * size], max: [-250 + (x + 1) * size, 0, -250 + (z + 1) * size] },
      geometricError: 0, compressed: 5, decoded: 10, gpu: 18, triangles: 3, draws: 1 };
  }));
  const build = (): void => { writeOutputProduct(source, new Map([[payload, bytes], [shared, dependency]]), folder); };
  build(); return { source, folder, payload, build };
}

test('report all 80 tile declarations and shared wire bytes once without inventing live memory', () => {
  const f = fixture(), report = readNightMarketKitBudget(f.folder);
  expect(report.rows).toHaveLength(80);
  expect(report.rows[0]).toEqual({ lod: 0, x: 0, z: 0, compressed: 5, resident: 28, triangles: 3, draws: 1, rm8Target: true });
  expect(report.rows[79]).toEqual({ lod: 1, x: 3, z: 3, compressed: 5, resident: 28, triangles: 3, draws: 1, rm8Target: null });
  expect(report.uniqueTileClosure).toEqual({ compressed: 5, resident: 28, triangles: 3, draws: 1 });
  expect(report.uniqueTileFiles).toBe(2); expect(report.existingCapDebt).toEqual({});
  expect(report.basis).toContain('not live memory');
  expect(readNightMarketKitBudget(f.folder)).toEqual(report);
  const module = new URL('../scripts/night-market-kit-budget.mjs', import.meta.url).href;
  const program = `import {readNightMarketKitBudget} from ${JSON.stringify(module)};console.log(readNightMarketKitBudget(${JSON.stringify(f.folder)}).rows.length);`;
  expect(execFileSync(process.execPath, ['--input-type=module', '-e', program], { encoding: 'utf8' }).trim()).toBe('80');
});

test('RM8 target overruns remain visible report rows without changing the existing admission caps', () => {
  const f = fixture(), tile = f.source.tiles[0];
  if (tile === undefined) throw new Error('Missing fixture tile');
  tile.triangles = 15001; tile.compressed = 300001; f.build();
  const report = readNightMarketKitBudget(f.folder);
  expect(report.rows[0]?.rm8Target).toBe(false);
  expect(report.rm8Targets.reportOnly).toBe(true);
});

test('missing tiles, wrong identity and corrupt receipts/sections refuse rather than supply zeros', () => {
  const f = fixture();
  f.source.tiles.pop(); f.build(); expect(() => readNightMarketKitBudget(f.folder)).toThrow('all 64 L0 and 16 L1');
  f.source.identity.slug = 'other'; f.build(); expect(() => readNightMarketKitBudget(f.folder)).toThrow('identity or index receipt');
  const g = fixture(), section = resolve(g.folder, 'sections/world/tiles.json');
  writeFileSync(section, `${readFileSync(section, 'utf8')} `);
  expect(() => readNightMarketKitBudget(g.folder)).toThrow('tile section differs');
  g.build(); writeFileSync(resolve(g.folder, 'validation.json'), JSON.stringify({ indexHash: '0'.repeat(64) }));
  expect(() => readNightMarketKitBudget(g.folder)).toThrow('identity or index receipt');
});

test('a changed dependency payload refuses even while its envelope and tile section are intact', () => {
  const f = fixture(), index = v.parse(v.object({ files: v.array(v.object({ hash: v.string(), path: v.string() })) }),
    JSON.parse(readFileSync(resolve(f.folder, 'shard.json'), 'utf8')));
  const file = index.files.find(row => row.hash !== f.payload);
  if (file === undefined) throw new Error('Missing fixture dependency');
  writeFileSync(resolve(f.folder, file.path), Uint8Array.of(5, 4));
  expect(() => readNightMarketKitBudget(f.folder)).toThrow('tile payload differs');
});
