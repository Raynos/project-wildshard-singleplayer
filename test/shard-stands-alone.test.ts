// oxlint-disable-next-line import/no-nodejs-modules -- This test reads real products and runs the cook in a folder of its own.
import {spawnSync} from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- This test reads real products and runs the cook in a folder of its own.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- This test reads real products and runs the cook in a folder of its own.
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- This test reads real products and runs the cook in a folder of its own.
import {tmpdir} from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- This test reads real products and runs the cook in a folder of its own.
import {dirname, join, resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {prepareAssetDecoders} from '@wildshard/format/product';
import {validateShardfileProduct} from '@wildshard/format/productValidation';
import {readTar} from '@wildshard/format/tar';
import {productTarball} from '../src/game/cook/productTarball';
import {openShardfile} from '../src/game/cook/shardCook';
import {loadHeadlessProduct} from '@wildshard/sdk/headlessProduct';

/** C0 (J137): a shardfile stands alone. Each real product packs to a tarball the format's own validator takes; everything
 *  its sections name by a public URL it either carries or leaves to the engine, because other shards read it too; and
 *  `cook` runs on the tarball from an empty folder, so no bundle, `src/shards` or `public/` can be doing the work. */
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const products = readdirSync('out', {withFileTypes: true}).filter(row => row.isDirectory() && existsSync(join('out', row.name, 'shard.json'))).map(row => row.name);
const everyMount = (): Map<string, Set<string>> => {
  const users = new Map<string, Set<string>>();
  for (const name of readdirSync('src/shards')) {
    const file = join('src/shards', name, 'mounts.json');
    if (!existsSync(file)) continue;
    const {outputs} = JSON.parse(readFileSync(file, 'utf8')) as {outputs: Record<string, string[]>};
    for (const url of Object.values(outputs).flat()) { const set = users.get(url) ?? new Set(); set.add(name); users.set(url, set); }
  }
  return users;
};

describe('a shardfile stands alone', () => {
  it('names no public file twice across shard folders', () => {
    expect([...everyMount()].filter(([, users]) => users.size > 1)).toEqual([]);
  });

  it.each(products)('%s validates as a tarball and carries its own files', async slug => {
    await prepareAssetDecoders();
    const tarball = productTarball(join('out', slug)), files = readTar(tarball);
    const product = validateShardfileProduct({read: (path, max) => {
      const bytes = files.get(path); if (bytes === undefined || bytes.length > max) throw new Error(`No ${path}`); return bytes;
    }, paths: () => files.keys()}, {hash: sha256});
    expect(product.index.identity.slug).toBe(slug === '_template' ? 'template' : slug);
    const shard = openShardfile(tarball), mounted = new Set(shard.cook?.mounts.map(row => row.url));
    // A discovery document is written with its product (C3), so only an `/assets` mount has a public twin to match.
    for (const row of shard.cook?.mounts ?? []) if (row.url.startsWith('/assets/')) expect(sha256(readFileSync(join('public', row.url.slice(1))))).toBe(row.hash);
    const engine = everyMount();
    const named = [...JSON.stringify([...shard.sections.values()]).matchAll(/"(\/assets\/[^"]+\.[a-z0-9]+)"/gu)].map(match => match[1] ?? '');
    const missing = named.filter(url => !mounted.has(url) && existsSync(join('public', url.slice(1))) && !engine.has(url));
    // A file no mounts.json lists is either the engine's (read by two shard folders) or this list is stale.
    expect(missing.filter(url => readers(url) < 2)).toEqual([]);
  }, 60_000);

  it.each(['driftwood-isle', 'nalati-grasslands', 'pine-hollow'])('%s loads headless from its unpacked tarball', async slug => {
    const scratch = mkdtempSync(join(tmpdir(), 'stands-alone-'));
    try {
      for (const [path, bytes] of readTar(productTarball(join('out', slug)))) {
        mkdirSync(dirname(join(scratch, path)), {recursive: true}); writeFileSync(join(scratch, path), bytes);
      }
      const product = await loadHeadlessProduct(scratch);
      expect(product.shardfile.identity.slug).toBe(slug);
    } finally { rmSync(scratch, {recursive: true, force: true}); }
  }, 60_000);

  it('cooks from a tarball in an empty folder', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'cook-')), root = resolve('.');
    try {
      const tar = join(scratch, 'shard.tar'), slug = products.includes('pastel-plain') ? 'pastel-plain' : '_template';
      writeFileSync(tar, productTarball(join('out', slug)));
      const run = spawnSync(process.execPath, ['--import', join(root, 'scripts/bake-loader.mjs'), join(root, 'scripts/cook.mjs'), tar, join(scratch, 'packs')], {cwd: scratch, encoding: 'utf8'});
      expect(run.status, run.stderr).toBe(0);
      const report = JSON.parse(run.stdout.trim().split('\n').at(-1) ?? '{}') as {slug: string; manifests: unknown[]; parts: {count: number}};
      expect(report.slug).toBe(slug);
      expect(report.manifests).toHaveLength(4);
      expect(readdirSync(join(scratch, 'packs/assets/spawn/parts')).length).toBe(report.parts.count);
    } finally { rmSync(scratch, {recursive: true, force: true}); }
  }, 120_000);
});

/** How many shard folders' sections name a URL. */
function readers(url: string): number {
  const folders = new Set<string>();
  for (const slug of products) {
    const section = join('out', slug, 'sections');
    for (const row of readdirSync(section, {recursive: true, withFileTypes: true})) {
      if (row.isFile() && readFileSync(join(row.parentPath, row.name), 'utf8').includes(`"${url}"`)) folders.add(slug.startsWith('open-plot-') ? 'open-plots' : slug);
    }
  }
  return folders.size;
}
