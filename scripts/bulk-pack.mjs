#!/usr/bin/env node
// bulk-pack.mjs: pack one shard's boot files into a handful of WSPK parts (E525 bulk-download spike,
// docs/plans/bulk-download-mini-spike.md). A standalone prototype: nothing in the build or the game calls it yet.
//
//   node scripts/bulk-pack.mjs --dist <built tree> [--shard driftwood-isle] [--flow grid] [--tier phone]
//        [--out tmp/bulk-download/packs] [--part-mb 12] [--brotli <quality 0-11>]
//
// The boot list is the build's own spawn manifest (dist/assets/spawn/<shard>-<flow>-<tier>-<hash>.json, written by
// scripts/app-build/entryTotals.ts): the files the title downloads before control, today one request each. They are
// grouped by how they change and how they compress:
//   code    /b/<build>/*.js|css                   (changes with every app build)
//   engine  every other /assets/* and /basis/*    (shared by every shard)
//   shard   /shardfiles/<shard>/*, cut into parts of at most --part-mb raw MB, never inside a file
//   tex     images and KTX2 (already compressed: the server must not spend brotli on them)
// Each part is content-addressed (<kind>-<n>-<sha256 16>.wspk), so a deploy re-downloads only the parts whose bytes
// changed. Every member is checked against the manifest's sha256 and length before it is packed, and every part is
// read back through scripts/bulk-pack-reader.mjs and re-checked after it is written.
// --brotli also writes <part>.br and prints loose (one file at a time) against packed brotli bytes.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';
import { ALIGN, MAGIC, member, readPackIndex } from './bulk-pack-reader.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/u, ''), process.argv[i + 1]);
const dist = args.get('dist');
if (dist === undefined) { console.error('usage: node scripts/bulk-pack.mjs --dist <built tree> [--shard s] [--flow grid|client] [--tier phone|desktop] [--out dir] [--part-mb n] [--brotli q]'); process.exit(64); }
const shard = args.get('shard') ?? 'driftwood-isle', flow = args.get('flow') ?? 'grid', tier = args.get('tier') ?? 'phone';
const out = join(args.get('out') ?? 'tmp/bulk-download/packs', `${shard}-${flow}-${tier}`);
const partBytes = Number(args.get('part-mb') ?? 12) * 1_000_000;
const quality = args.has('brotli') ? Number(args.get('brotli')) : null;

const spawnDir = join(dist, 'assets/spawn');
const manifestName = readdirSync(spawnDir).find(name => name.startsWith(`${shard}-${flow}-${tier}-`) && name.endsWith('.json'));
if (manifestName === undefined) throw new Error(`No spawn manifest for ${shard}-${flow}-${tier} in ${spawnDir}`);
const manifest = JSON.parse(readFileSync(join(spawnDir, manifestName), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

const kindOf = path => {
  if (/\.(webp|png|jpe?g|ktx2|avif)$/u.test(path)) return 'tex';
  if (/^\/(?:assets|b\/[\w.-]+)\/[^/]+\.(js|css)$/u.test(path)) return 'code';
  if (path.startsWith(`/shardfiles/${shard}/`)) return 'shard';
  return 'engine';
};
const groups = { code: [], engine: [], shard: [], tex: [] };
for (const file of manifest.files) {
  const path = file.url.split('?')[0];
  const bytes = readFileSync(realpathSync(join(dist, path)));
  if (bytes.length !== file.bytes || sha(bytes) !== file.hash) throw new Error(`${path} differs from the spawn manifest (stale tree?)`);
  groups[kindOf(path)].push({ url: file.url, path, bytes, hash: file.hash });
}

// The shard group is cut into parts in manifest (demand) order, so the first part holds what the boot asks for first.
const parts = [];
for (const [kind, files] of Object.entries(groups)) {
  let current = [];
  let size = 0;
  for (const file of files) {
    if (kind === 'shard' && current.length > 0 && size + file.bytes.length > partBytes) { parts.push({ kind, files: current }); current = []; size = 0; }
    current.push(file); size += file.bytes.length;
  }
  if (current.length > 0) parts.push({ kind, files: current });
}

const pad = n => (ALIGN - (n % ALIGN)) % ALIGN;
function encode(files) {
  // The header holds the offsets and the offsets depend on the header's length: settle it in two passes.
  let headerLength = 0;
  for (;;) {
    let offset = 12 + headerLength; offset += pad(offset);
    const rows = files.map(file => { const row = [file.url, offset, file.bytes.length, file.hash]; offset += file.bytes.length; offset += pad(offset); return row; });
    const header = Buffer.from(JSON.stringify({ v: 1, files: rows }));
    if (header.length === headerLength) {
      const body = Buffer.alloc(offset);
      Buffer.from(MAGIC).copy(body, 0); body.writeUInt32LE(header.length, 8); header.copy(body, 12);
      files.forEach((file, i) => file.bytes.copy(body, rows[i][1]));
      return body;
    }
    headerLength = header.length;
  }
}

const brotli = promisify(brotliCompress);
const squeeze = (bytes, mode) => brotli(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: quality, [constants.BROTLI_PARAM_MODE]: mode,
  [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length, [constants.BROTLI_PARAM_LGWIN]: 24 } });
mkdirSync(out, { recursive: true });
const index = { v: 1, shard, flow, tier, manifest: manifestName, files: manifest.files.length, parts: [] };
const kindCounters = {};
let looseBrotli = 0, packedBrotli = 0;
for (const part of parts) {
  const body = encode(part.files);
  const n = kindCounters[part.kind] = (kindCounters[part.kind] ?? 0) + 1;
  const name = `${part.kind}-${n}-${sha(body).slice(0, 16)}.wspk`;
  writeFileSync(join(out, name), body);
  const back = readPackIndex(new Uint8Array(body));
  for (const file of part.files) {
    const entry = back.files.get(file.url);
    if (entry === undefined || sha(member(body, entry)) !== file.hash) throw new Error(`${name}: ${file.path} did not read back`);
  }
  const row = { url: name, kind: part.kind, files: part.files.length, bytes: body.length, raw: part.files.reduce((s, f) => s + f.bytes.length, 0) };
  if (quality !== null && part.kind !== 'tex') {
    const packed = await squeeze(body, constants.BROTLI_MODE_GENERIC);
    writeFileSync(join(out, `${name}.br`), packed);
    let loose = 0;
    for (const file of part.files) loose += (await squeeze(file.bytes, constants.BROTLI_MODE_GENERIC)).length;
    Object.assign(row, { brotli: packed.length, looseBrotli: loose });
    packedBrotli += packed.length; looseBrotli += loose;
  } else if (quality !== null) { packedBrotli += body.length; looseBrotli += row.raw; Object.assign(row, { brotli: body.length, looseBrotli: row.raw }); }
  index.parts.push(row);
}
writeFileSync(join(out, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);

const mb = n => (n / 1e6).toFixed(2).padStart(7);
console.log(`${manifestName}: ${manifest.files.length} files, ${mb(manifest.totalBytes)} MB raw → ${index.parts.length} parts in ${out}`);
for (const row of index.parts) console.log(`  ${row.url.padEnd(34)} ${String(row.files).padStart(4)} files ${mb(row.bytes)} MB${row.brotli === undefined ? '' : `  br ${mb(row.brotli)} MB (loose ${mb(row.looseBrotli)} MB)`}`);
if (quality !== null) console.log(`brotli q${quality}: loose ${mb(looseBrotli)} MB, packed ${mb(packedBrotli)} MB (${(100 * (packedBrotli - looseBrotli) / looseBrotli).toFixed(1)} %); manifest wireBytes ${mb(manifest.wireBytes)} MB`);
