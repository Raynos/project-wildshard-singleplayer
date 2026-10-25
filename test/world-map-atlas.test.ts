import { expect, test } from 'vitest';
import sharp from 'sharp';
import { build } from 'vite';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only this tiny atlas compiler fixture.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve files within the owned fixture.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Give the fixture the same measured hash checks as the product reader.
import { createHash } from 'node:crypto';
import { bakeWorldMapAtlas, productMapBytes, worldMapAtlasPlugin } from '../vite/worldMapAtlas';

test('one atlas includes every unique map with stable crops and an explicit nonblank plain-plot tile', async () => {
  const red = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ff0000' } }).png().toBuffer();
  const reads: string[] = [];
  const atlas = await bakeWorldMapAtlas(['red', 'empty', 'red'], slug => { reads.push(slug); return slug === 'red' ? red : null; });
  expect(reads).toEqual(['empty', 'red']); expect(atlas.slugs).toEqual(reads); expect(atlas.width).toBe(512); expect(atlas.height).toBe(256);
  const tile = await sharp(await sharp(atlas.bytes).extract({ left: 256, top: 0, width: 256, height: 256 }).png().toBuffer()).stats();
  expect(tile.channels[0]?.mean).toBeGreaterThan(245); expect(tile.channels[1]?.mean).toBeLessThan(5);
  const plot = await sharp(await sharp(atlas.bytes).extract({ left: 0, top: 0, width: 256, height: 256 }).png().toBuffer()).stats();
  expect(plot.channels[0]?.stdev).toBeGreaterThan(5); expect(atlas.bytes.length).toBeLessThan(100_000);
});
test('missing or corrupt declared map bytes fail instead of silently substituting a plain plot', async () => {
  await expect(bakeWorldMapAtlas(['broken'], () => { throw new Error('Missing admitted image'); })).rejects.toThrow('Missing admitted image');
  await expect(bakeWorldMapAtlas(['broken'], () => new Uint8Array([1, 2, 3]))).rejects.toThrow();
});

test('the app compiler emits one atlas with inlined geometry, verifies source hashes, and includes every override', async () => {
  const root = mkdtempSync(resolve('tmp', 'world-atlas-build-'));
  const digest = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
  try {
    mkdirSync(resolve(root, 'src/game/grid'), { recursive: true });
    writeFileSync(resolve(root, 'src/game/grid/singleplayer.json'), JSON.stringify({ grid: { cells: [{ slug: 'base' }], developer: [{ slug: 'override' }], devserver: [{ slug: 'override' }] } }));
    writeFileSync(resolve(root, 'entry.js'), 'export const atlas = __GRID_MAP_ATLAS__;');
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).webp().toBuffer();
    const map = JSON.stringify({ map: { image: digest(image) } });
    for (const slug of ['base', 'override']) {
      const out = resolve(root, 'out', slug); mkdirSync(out, { recursive: true });
      writeFileSync(resolve(out, 'map.json'), map); writeFileSync(resolve(out, 'map.webp'), image);
      writeFileSync(resolve(out, 'shard.json'), JSON.stringify({ format: 'wildshard.shardfile', formatVersion: 2, runtime: null, schemas: [],
        sections: [{ name: 'look/map', path: 'map.json', bytes: Buffer.byteLength(map), hash: digest(map) }],
        files: [{ path: 'map.webp', hash: digest(image), compressed: image.length }] }));
    }
    const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [worldMapAtlasPlugin()], build: { write: false, minify: false,
      lib: { entry: resolve(root, 'entry.js'), formats: ['es'] } } });
    const built = Array.isArray(result) ? result[0] : result;
    if (built === undefined || !('output' in built)) throw new Error('Missing atlas bundle');
    const assets = built.output.filter(row => row.type === 'asset'); expect(assets).toHaveLength(1);
    expect(assets[0]?.fileName).toMatch(/^assets\/world-map-[a-f0-9]{16}\.webp$/u);
    const code = built.output.find(row => row.type === 'chunk')?.code;
    expect(code).toContain(assets[0]?.fileName); expect(code).toContain('override'); expect(code).toContain('base');
    writeFileSync(resolve(root, 'out/base/map.webp'), 'corrupt'); expect(() => productMapBytes(root, 'base')).toThrow('image differs');
    writeFileSync(resolve(root, 'out/base/map.json'), '{}'); expect(() => productMapBytes(root, 'base')).toThrow('section differs');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
