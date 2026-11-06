#!/usr/bin/env node
// C3 (D7): put a shard on an already built client, with no rebuild: what a flip does at the next deploy until E7.
//   node --import ./scripts/bake-loader.mjs scripts/bake-catalogue.mjs <dist> <shard.tar> <instance> <cellX> <cellY> [<packs folder> <packs origin>]
// With a packs folder the cook goes there for the store, and pages read it from that origin (J138); only the header stays.
// The tarball is cooked into <dist> and every table a page reads names it, in files the bundle doesn't hash. A deploy that
// takes its grid from api-server names that file with WILDSHARD_CATALOGUE at build time instead.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

const { prepareAssetDecoders } = await import('@wildshard/format/product');
const { validateShardfileProduct } = await import('@wildshard/format/productValidation');
const { readTar } = await import('@wildshard/format/tar');
const { addCookedShards, writeCatalogueDocument } = await import('./app-build/catalogue.ts');
const { cookShard, openShardfile, servedAsIs } = await import('../src/game/cook/shardCook.ts');
const { writeServiceWorker } = await import('./app-build/serviceWorker.ts');

const [dist, tar, instance, x, y, packs, origin] = process.argv.slice(2);
if (dist === undefined || tar === undefined || instance === undefined || x === undefined || y === undefined) throw new Error('usage: bake-catalogue <dist> <shard.tar> <instance> <cellX> <cellY>');
const out = resolve(dist), tarball = readFileSync(tar), shard = openShardfile(tarball), slug = shard.slug;
const cooked = mkdtempSync(join(tmpdir(), 'bake-catalogue-'));
try {
  const report = await cookShard(tarball, cooked, { now: () => performance.now(), wireBytes: (url, bytes) => servedAsIs(url, bytes) ? bytes.length : brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length });
  // `dereference`: a preview's dist symlinks its folders.
  cpSync(cooked, packs === undefined ? out : resolve(packs), { recursive: true, dereference: true, force: true });
  // A page trusts a verdict by its index hash, so the verdict is earned here: this build's format validator takes the tarball,
  // whichever validator stamped its receipt.
  await prepareAssetDecoders();
  const files = readTar(tarball);
  validateShardfileProduct({ read: (path, maximum) => { const bytes = files.get(path); if (bytes === undefined || bytes.length > maximum) throw new Error(`No ${path}`); return bytes; }, paths: () => files.keys() }, { hash: bytes => createHash('sha256').update(bytes).digest('hex') });
  const revision = /__WS_SHARDFILE_VALIDATOR__="([a-f0-9]{64})"/u.exec(readFileSync(join(out, 'index.html'), 'utf8'))?.[1];
  if (revision === undefined) throw new Error('No validator stamped on the build');
  const { sourceHash, indexHash, residentBytes, postCost, worst } = JSON.parse(new TextDecoder().decode(shard.read('validation.json')));
  const header = join(out, 'shardfiles', slug);
  mkdirSync(header, { recursive: true }); writeFileSync(join(header, 'shard.json'), shard.header);
  if (packs !== undefined) { mkdirSync(join(packs, 'shardfiles', slug), { recursive: true }); writeFileSync(join(packs, 'shardfiles', slug, 'shard.json'), shard.header); }
  const catalogue = JSON.parse(readFileSync(join(out, 'catalogue.json'), 'utf8'));
  const hash = createHash('sha256').update(tarball).digest('hex');
  catalogue.placements = [...catalogue.placements.filter(row => row.slug !== slug), { instance, slug, cell: [Number(x), Number(y)], size: [500, 500, 500], order: catalogue.placements.length + 1 }];
  catalogue.shards = [...catalogue.shards.filter(row => row.slug !== slug), { slug, name: shard.index.identity.name, revision: 1, hash }];
  writeCatalogueDocument(out, catalogue);
  addCookedShards(out, [{ slug, hash, header: '', manifests: report.manifests, verdict: { revision, sourceHash, indexHash, residentBytes, postCost, path: `/shardfiles/${slug}/shard.json`, ...(worst === undefined ? {} : { worst }) } }], cooked, packs === undefined || origin === undefined ? undefined : { base: origin, shards: [slug] });
  if (existsSync(join(out, 'sw.js'))) writeServiceWorker(out, process.cwd());
  console.log(JSON.stringify({ slug, hash, seconds: report.seconds, parts: report.parts }));
} finally { rmSync(cooked, { recursive: true, force: true }); }
