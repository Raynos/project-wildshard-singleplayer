// oxlint-disable-next-line import/no-nodejs-modules -- Own a bounded map output tree and compare original immutable bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the synthetic output tree to repository scratch.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Avoid dumping image data on an equality failure.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Report only measured fixture phase timings.
import process from 'node:process';
import { expect, test } from 'vitest';
import { paintDataMap } from '../scripts/bake-data-maps.mjs';
import { mapTilesHash } from '../scripts/map-hash.mjs';
import { templateMapInputs } from '../src/shards/_template/generators/mapInputs';
import settings from '../src/shards/_template/data/map.json' with { type: 'json' };

test('the Template map uses producer bytes with no restored world metadata or assets', async () => {
  const started = performance.now(), sources = templateMapInputs();
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp', 'template-map-'));
  try {
    const dir = resolve(root, 'src/shards/fixture'); mkdirSync(resolve(dir, 'data'), { recursive: true });
    writeFileSync(resolve(dir, 'source.txt'), 'authored source identity');
    writeFileSync(resolve(dir, 'data/map.json'), JSON.stringify({ ...settings, inputs: ['source.txt'] }));
    const result = await paintDataMap(root, 'fixture', { sources });
    expect(result.raster.triangles).toBe(143742);
    const actual = readFileSync(resolve(root, 'public/assets/fixture/map/top.webp'));
    expect(Buffer.compare(actual, readFileSync('public/assets/_template/map/top.webp'))).toBe(0);
    expect(result.stamp.tilesHash).toBe(mapTilesHash(dir));
    const directMs = performance.now() - started;
    const diskAt = performance.now(), diskSources = templateMapInputs(), disk = resolve(root, 'src/shards/disk');
    mkdirSync(resolve(disk, 'data'), { recursive: true }); mkdirSync(resolve(disk, 'assets'), { recursive: true });
    writeFileSync(resolve(disk, 'data/map.json'), JSON.stringify({ ...settings, inputs: ['world-terrain', 'world-props', 'assets'] }));
    for (const [name, bytes] of diskSources) writeFileSync(resolve(disk, name), bytes);
    const original = await paintDataMap(root, 'disk');
    expect(original.raster.triangles).toBe(result.raster.triangles);
    expect(Buffer.compare(readFileSync(resolve(root, 'public/assets/disk/map/top.webp')), actual)).toBe(0);
    const diskMs = performance.now() - diskAt;
    const before = result.stamp.tilesHash; writeFileSync(resolve(dir, 'source.txt'), 'changed authored source');
    expect(mapTilesHash(dir)).not.toBe(before);
    const missing = new Map(sources); missing.delete('world-terrain');
    await expect(paintDataMap(root, 'fixture', { sources: missing })).rejects.toThrow(/undeclared map input/u);
    process.stdout.write(`${JSON.stringify({ directMapMs: directMs, diskPipelineMs: diskMs, triangles: result.raster.triangles, bytes: actual.length })}\n`);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
