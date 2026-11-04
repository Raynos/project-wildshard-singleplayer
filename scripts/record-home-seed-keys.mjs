// DL7 P3 + DL6: record the home build cache keys a cold grid entry wrote (its IndexedDB 'ws-built-home-v1' store) as the
// home's seed keys, src/shards/<slug>/home-seed-keys.json, origin-free (src/game/shardfile/homeSeed.ts homeSeedKey). The
// app build bakes one seed per listed tier from them (scripts/app-build/homeSeed.ts).
//
//   node --import ./scripts/bake-loader.mjs scripts/record-home-seed-keys.mjs --dump=<keys .json> [--dump=…] [--slug=<shard>] [--check]
// A dump is one cold grid entry's store, read after control: {tier: 'phone' | 'desktop', rows: [{key, bytes}]} (the
// 'identity' row is ignored). Keys must be whole: a dump that shortened them refuses. The slug comes from the owned
// keys' /shardfiles/<slug>/ paths, else --slug. A tier the dumps do not name keeps its recorded list.
// --check writes nothing and exits 1 when the recorded file differs from what the dumps give.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { homeSeedKey, readHomeSeedKeys } from '../src/game/shardfile/homeSeed.ts';

const { values } = parseArgs({ options: { dump: { type: 'string', multiple: true }, slug: { type: 'string' }, check: { type: 'boolean', default: false } } });
const dumps = values.dump ?? [];
if (dumps.length === 0) throw new Error('usage: --dump=<keys .json> [--dump=…] [--slug=<shard>] [--check]');

/** @type {Map<'phone' | 'desktop', Set<string>>} */
const tiers = new Map();
const slugs = new Set(values.slug === undefined ? [] : [values.slug]);
for (const path of dumps) {
  const dump = JSON.parse(readFileSync(path, 'utf8'));
  if (dump?.tier !== 'phone' && dump?.tier !== 'desktop') throw new Error(`${path}: the dump names no tier (phone or desktop)`);
  if (!Array.isArray(dump.rows)) throw new Error(`${path}: the dump has no rows`);
  const keys = tiers.get(dump.tier) ?? new Set(); tiers.set(dump.tier, keys);
  for (const row of dump.rows) {
    const key = row?.key;
    if (typeof key !== 'string') throw new Error(`${path}: a row has no key`);
    if (key === 'identity') continue;
    const colon = key.indexOf(':');
    let body;
    try { body = colon > 0 ? JSON.parse(key.slice(colon + 1)) : undefined; } catch { body = undefined; }
    if (!Array.isArray(body)) throw new Error(`${path}: key ${key.slice(0, 60)}… does not parse; dump the store's full keys (no shortening)`);
    const normal = homeSeedKey(key);
    const owner = /^owned:\["\/shardfiles\/([a-z0-9_-]+)\//u.exec(normal)?.[1];
    if (owner !== undefined) slugs.add(owner);
    keys.add(normal);
  }
}
if (slugs.size !== 1) throw new Error(`The dumps name ${slugs.size === 0 ? 'no shard (pass --slug)' : `several shards (${[...slugs].join(', ')})`}`);
const [slug] = slugs;
if (slug === undefined || !existsSync(join('src/shards', slug))) throw new Error(`No shard folder src/shards/${slug}`);
const file = join('src/shards', slug, 'home-seed-keys.json');
const prior = existsSync(file) ? readHomeSeedKeys(JSON.parse(readFileSync(file, 'utf8'))) : { version: 1, tiers: {} };
/** @type {{phone?: string[], desktop?: string[]}} */
const next = { ...prior.tiers };
for (const [tier, keys] of tiers) next[tier] = [...keys].sort();
const text = `${JSON.stringify(readHomeSeedKeys({ version: 1, tiers: next }), null, 2)}\n`;
if (values.check) {
  const same = existsSync(file) && readFileSync(file, 'utf8') === text;
  console.log(`${file}: ${same ? 'holds' : 'differs from the dumps'}`);
  process.exitCode = same ? 0 : 1;
} else {
  writeFileSync(file, text);
  console.log(`${file}: ${[...tiers].map(([tier, keys]) => `${tier} ${keys.size} keys`).join(', ')}`);
}
