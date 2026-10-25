import { expect, test } from 'vitest';
import sharp from 'sharp';
import { build } from 'vite';
// oxlint-disable-next-line import/no-nodejs-modules -- Own only this tiny atlas compiler fixture.
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve files within the owned fixture.
import { resolve, delimiter } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual native command in a cold, owned compiler fixture.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Give the fixture the same measured hash checks as the product reader.
import { createHash } from 'node:crypto';
import { bakeWorldMapAtlas, productMapBytes, worldMapAtlasPlugin } from '../vite/worldMapAtlas';
import packageJson from '../package.json';

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
    writeFileSync(resolve(root, 'src/game/grid/singleplayer.json'), JSON.stringify({ grid: { cells: [{ slug: 'base' }, { slug: 'plain' }], developer: [{ slug: 'override' }], devserver: [{ slug: 'override' }] } }));
    writeFileSync(resolve(root, 'entry.js'), 'export const atlas = __GRID_MAP_ATLAS__;');
    const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).webp().toBuffer();
    for (const slug of ['base', 'override', 'plain']) {
      const map = JSON.stringify(slug === 'plain' ? {} : { map: { image: digest(image) } });
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
    expect(code).toContain(assets[0]?.fileName); expect(code).toContain('override'); expect(code).toContain('base'); expect(code).toContain('plain');
    writeFileSync(resolve(root, 'out/base/map.webp'), 'corrupt'); expect(() => productMapBytes(root, 'base')).toThrow('image differs');
    writeFileSync(resolve(root, 'out/base/map.json'), '{}'); expect(() => productMapBytes(root, 'base')).toThrow('section differs');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the native command prepares products before a cold atlas and stops on producer refusal', async () => {
  const root = mkdtempSync(resolve('tmp', 'world-atlas-native-'));
  const prefix = 'python3 scripts/heavy-lane.py build -- ';
  const command = packageJson.scripts['build:native'];
  expect(command.startsWith(prefix)).toBe(true);
  const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
  try {
    mkdirSync(resolve(root, 'src/game/grid'), { recursive: true }); mkdirSync(resolve(root, 'scripts'));
    writeFileSync(resolve(root, 'src/game/grid/singleplayer.json'), JSON.stringify({ grid: {
      cells: [{ slug: '_template' }], developer: [{ slug: 'override' }], devserver: [{ slug: 'plain' }],
    } }));
    writeFileSync(resolve(root, 'entry.js'), 'console.log(__GRID_MAP_ATLAS__);');
    writeFileSync(resolve(root, 'index.html'), '<script type="module" src="/entry.js"></script>');
    // The real atlas compiler must still refuse an unbuilt declared product.
    await expect(build({ root, configFile: false, logLevel: 'silent', plugins: [worldMapAtlasPlugin()],
      build: { write: false } })).rejects.toThrow(/ENOENT.*_template/u);

    // A tiny producer fixture emits the same validated product wire consumed by the plugin.
    // Execute the package's actual inner command, retaining its sequencing and failure semantics.
    writeFileSync(resolve(root, 'scripts/build-shardfiles.mjs'), `
      import {mkdirSync,writeFileSync} from 'node:fs';
      if (process.argv.slice(2).join(' ') !== '--reuse') throw new Error('Expected verified reuse');
      for (const slug of ['_template','override','plain']) {
        mkdirSync('out/'+slug,{recursive:true});writeFileSync('out/'+slug+'/map.json','{}');
        writeFileSync('out/'+slug+'/shard.json',JSON.stringify({
          format:'wildshard.shardfile',formatVersion:2,runtime:null,schemas:[],files:[],
          sections:[{name:'look/map',path:'map.json',bytes:2,hash:'${digest('{}')}'}]
        }));
      }
    `);
    writeFileSync(resolve(root, 'vite.config.mts'), `
      import {worldMapAtlasPlugin} from ${JSON.stringify(resolve('vite/worldMapAtlas.ts'))};
      export default {plugins:[worldMapAtlasPlugin()],logLevel:'silent'};
    `);
    const { PATH: path = '' } = process.env;
    const run = (): ReturnType<typeof spawnSync> => spawnSync('bash', ['-c', command.slice(prefix.length)], {
      cwd: root, encoding: 'utf8', env: { ...process.env, PATH: `${resolve('node_modules/.bin')}${delimiter}${path}` },
    });
    const prepared = run();
    expect(prepared.status, `${String(prepared.stdout)}${String(prepared.stderr)}`).toBe(0);
    expect(readFileSync(resolve(root, 'dist/index.html'), 'utf8')).toContain('assets/');
    for (const slug of ['_template', 'override', 'plain']) expect(() => productMapBytes(root, slug)).not.toThrow();
    rmSync(resolve(root, 'out'), { recursive: true }); rmSync(resolve(root, 'dist'), { recursive: true });
    writeFileSync(resolve(root, 'scripts/build-shardfiles.mjs'), 'process.exit(7);');
    const refused = run();
    expect(refused.status).toBe(7); expect(existsSync(resolve(root, 'dist'))).toBe(false);
    expect(existsSync(resolve(root, 'out'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
