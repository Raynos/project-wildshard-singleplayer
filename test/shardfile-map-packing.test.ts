// oxlint-disable-next-line import/no-nodejs-modules -- Exact retained rasters and disposable first-party build fixtures.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned fixture roots.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Exact project-relative fixture paths.
import { join } from 'node:path';
import * as v from 'valibot';
import { expect, it, vi } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { buildProject, canonicalJson, contentHash, validateProject } from '@wildshard/sdk/project';
import { packProjectMap } from '../src/sdk/projectMap';
import { parseStillImage } from '@wildshard/format/stillImage';
import { buildShardfiles } from '../scripts/build-shardfiles.mjs';
import { legacyInventory } from '../scripts/legacy-shards.mjs';
import { mapPixelHash, mapTilesHash } from '../scripts/map-hash.mjs';

const stampSchema = v.object({ image: v.string(), tilesHash: v.string(), pixelHash: v.string() });
const bytes = Uint8Array.from(atob('UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoCAAMAAUAmJYwCdAFAAAD++b4XAkrVm6WHJtcxAAA='), c => c.codePointAt(0) ?? 0);

it('packs every live first-party baked map unchanged into an independently charged immutable library', () => {
  const root = `${import.meta.dirname}/..`, frozen = legacyInventory(root); let count = 0;
  for (const slug of readdirSync(join(root, 'src/shards'))) {
    const project = join(root, 'src/shards', slug);
    if (Object.hasOwn(frozen.shards, slug) || !existsSync(join(project, 'shard.config.ts'))) continue;
    const stamp = v.parse(stampSchema, JSON.parse(readFileSync(join(project, 'look/map.baked.json'), 'utf8')));
    const original = Uint8Array.from(readFileSync(join(root, 'public', stamp.image))), dimensions = parseStillImage(original);
    const base = emptyShardfile({ slug: slug === '_template' ? 'template' : slug, name: slug, author: 'Fixture', revision: 1, seed: 1 });
    const packed = packProjectMap(base, { bytes: original, tilesHash: stamp.tilesHash });
    const admitted = validateProject(packed.shard, new Map([[packed.hash, original]]));
    expect(admitted.map).toEqual({ image: contentHash(original), tilesHash: stamp.tilesHash });
    expect(admitted.files).toEqual([{ hash: packed.hash, kind: 'image', compressed: original.length,
      decoded: dimensions.decoded, gpu: dimensions.gpu, triangles: 0, draws: 0, critical: false, dependencies: [] }]);
    expect(admitted.library).toContain(packed.hash);
    expect(admitted.budgets.library).toEqual({ compressed: original.length, resident: dimensions.decoded + dimensions.gpu });
    expect(packProjectMap(admitted, { bytes: original, tilesHash: stamp.tilesHash }).shard).toEqual(admitted);
    count++;
  }
  expect(count).toBeGreaterThanOrEqual(10);
});

it('the first-party builder emits exact map bytes, preserves no-map products and refuses stale world or raster stamps', async () => {
  const root = mkdtempSync(join(tmpdir(), 'first-party-map-')), warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const calls: string[][] = [];
  const build = async (args: string[]): Promise<void> => {
    calls.push(args);
    const project = args[1], output = args[2]; if (project === undefined || output === undefined) throw new Error('Missing project');
    const mapPath = args.find(flag => flag.startsWith('--map='))?.slice(6), tilesHash = args.find(flag => flag.startsWith('--map-tiles-hash='))?.slice(17);
    await buildProject(project, output, { client: null, ...(mapPath === undefined || tilesHash === undefined ? {} : { map: { bytes: Uint8Array.from(readFileSync(mapPath)), tilesHash } }) });
  };
  const source = emptyShardfile({ slug: 'mapped', name: 'Mapped', author: 'Fixture', revision: 1, seed: 1 });
  const project = join(root, 'src/shards/mapped'), stampPath = join(project, 'look/map.baked.json'), image = join(root, 'public/assets/mapped/map/top.webp');
  const plain = join(root, 'src/shards/plain'), plainSource = { ...source, identity: { ...source.identity, slug: 'plain' } };
  try {
    mkdirSync(join(project, 'look'), { recursive: true }); mkdirSync(join(root, 'public/assets/mapped/map'), { recursive: true });
    writeFileSync(join(project, 'shard.config.ts'), `export default ${JSON.stringify(source)};`); writeFileSync(image, bytes);
    const stamp = { version: 1, image: '/assets/mapped/map/top.webp', tilesHash: mapTilesHash(project), pixelHash: await mapPixelHash(image) };
    writeFileSync(stampPath, JSON.stringify(stamp));
    expect(await buildShardfiles(root, { strict: true, build })).toBe(1);
    expect(Uint8Array.from(readFileSync(join(root, 'public/shardfiles/mapped', contentHash(bytes))))).toEqual(bytes);
    const decoded: unknown = JSON.parse(readFileSync(join(root, 'public/shardfiles/mapped/shard.json'), 'utf8'));
    const emitted = v.parse(v.object({ map: v.object({ image: v.string(), tilesHash: v.string() }) }), decoded).map;
    expect(emitted.image).toBe(contentHash(bytes)); expect(emitted.tilesHash).toBe(stamp.tilesHash);
    mkdirSync(plain); writeFileSync(join(plain, 'shard.config.ts'), `export default ${JSON.stringify(plainSource)};`);
    expect(await buildShardfiles(root, { strict: false, build })).toBe(2);
    expect(readFileSync(join(root, 'public/shardfiles/plain/shard.json'), 'utf8')).toBe(canonicalJson(plainSource));
    expect(calls.at(-1)?.some(flag => flag.startsWith('--map'))).toBe(false);
    rmSync(plain, { recursive: true });
    writeFileSync(join(project, 'shard.config.ts'), `export default ${JSON.stringify({ ...source, identity: { ...source.identity, revision: 2 } })};`);
    await expect(buildShardfiles(root, { strict: true, build })).rejects.toThrow('does not match its world');
    writeFileSync(join(project, 'shard.config.ts'), `export default ${JSON.stringify(source)};`);
    writeFileSync(stampPath, JSON.stringify({ ...stamp, pixelHash: '0'.repeat(64) }));
    const before = calls.length;
    await expect(buildShardfiles(root, { strict: true, build })).rejects.toThrow('decoded pixels differ');
    expect(calls).toHaveLength(before);
    writeFileSync(stampPath, JSON.stringify({ ...stamp, image: '/assets/other/map/top.webp' }));
    await expect(buildShardfiles(root, { strict: true, build })).rejects.toThrow('Unexpected baked map path');
  } finally { warning.mockRestore(); rmSync(root, { recursive: true, force: true }); }
});
