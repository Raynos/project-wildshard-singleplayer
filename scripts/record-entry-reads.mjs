#!/usr/bin/env node
// T7.14 runtime slice: one real entry's reads as the region's committed entry read set (`public/assets/<slug>/entry-reads.json`,
// read by game/grid/entryReadPrefetch.ts while a verified approach drives in). The bake-time crawl (sdk/entryReads.ts)
// replaces this file; until then it is re-recorded from a crawl.
//
//   node --experimental-transform-types --import ./scripts/shard-platform-format.mjs scripts/record-entry-reads.mjs \
//     --dump=<post.json> --slug=<slug> --base=<served preview URL> [--tier=phone] [--at=x,z]
//
// <post.json>: a pair probe's page dump of `performance.getEntriesByType('resource')` and the entry's
// `wildshard.prepare:<slug>:*` measures ({ res: [{ url, start }], spans: [{ name, start, end }] }). The reads kept are the
// region's product blobs and immutable `/assets` data (no code chunks) first read inside the entry's held create span, in
// first-demand order; each is fetched from the preview for its exact bytes and hash.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { parseEntryReadSet } from '../src/format/entryReads.ts';

const arg = (name, fallback) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dumpPath = arg('dump'), slug = arg('slug'), base = arg('base'), tier = arg('tier', 'phone'), at = arg('at', '0,0').split(',').map(Number);
if (dumpPath === undefined || slug === undefined || base === undefined) throw new Error('--dump, --slug and --base are required');
const dump = JSON.parse(readFileSync(dumpPath, 'utf8'));
const hold = dump.spans.find(span => span.name === `grid.prepare:${slug}.create`);
if (hold === undefined) throw new Error(`No held create span for ${slug} in the dump`);
const blobs = `/shardfiles/${slug}/blobs/`, kept = new Map();
for (const row of [...dump.res].sort((a, b) => a.start - b.start)) {
  if (row.start < hold.start || row.start > hold.end || kept.has(row.url)) continue;
  const path = row.url.split('?')[0];
  if (path.startsWith(blobs) || path.startsWith('/assets/') && !/\.(?:js|css|wasm)$/u.test(path)) kept.set(row.url, row);
}
const reads = [];
for (const url of kept.keys()) {
  const response = await fetch(new URL(url, base));
  if (!response.ok) { console.warn(`skipped ${url}: ${response.status}`); continue; }
  const bytes = new Uint8Array(await response.arrayBuffer());
  reads.push({ url, hash: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength });
}
const set = parseEntryReadSet([{ region: slug, tier, at: [at[0] ?? 0, at[1] ?? 0], reads }]);
const out = `public/assets/${slug}/entry-reads.json`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(set, null, 1)}\n`);
console.log(`${out}: ${reads.length} reads, ${(reads.reduce((sum, read) => sum + read.bytes, 0) / 1e6).toFixed(1)} MB (${tier})`);
