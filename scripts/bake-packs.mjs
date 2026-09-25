#!/usr/bin/env node
// bake-packs.mjs — one boot pack per shard × tier (project/archive/2026-09-22-load-perf.md, "requests, first launch ≤ 20").
//
// A shard's boot reads 4–80 files (texture sets, glTF triplets, LODs, baked terrain / sky / cards). Each is a
// request: cheap over HTTP/2 on Wi-Fi, but ~80 of them are the whole "requests" budget four times over, and each
// one pays the service worker's per-request cost on the phone. The pack is those same files — exactly the list
// `bootFetches(def, chunkFiles(def))` returns for that tier, the bytes the boot would have fetched one by one —
// concatenated in step order into one file the boot streams (src/boot/pack.ts): each file is handed to its step
// the moment its last byte lands, so download ∥ build overlaps as it did with the per-file prefetch, in one request.
//
//   public/assets/packs/<slug>.<tier>-<hash8>.bin   content-addressed (a changed file makes a new name), cache-first
//                                                   in the SW; gitignored and left out of the byte table — every
//                                                   build regenerates it from the committed files
//   src/boot/packs.generated.ts                     slug → tier → { parts: { url, bytes, files: [path, offset, size, type][] }[] }
//
// PARTS (E160, the user: "don't invalidate those as much"): one pack per shard meant any edit to any of its files named a
// new pack — Pine Hollow's phone players re-downloaded 18 MB for one repainted texture. A pack is now a few parts, each
// content-addressed on its own, so an edit costs its part. The cuts depend on the files' paths, not their bytes, so an
// edit does not move them: once a part holds PART_MIN it ends after a file whose path hashes to 0 mod 4 (or at PART_MAX
// whatever the path), never between a glTF's textures and the .gltf that follows them (Safari reads those textures
// through <img>: they must land first). A resized file can move at most the cut after it; the next hash cut re-aligns.
// Pine Hollow's 18 MB phone boot is ~8 parts; the requests row (bench.budget.json) has the room.
//
// glTF textures go before their .gltf: Safari's GLTFLoader loads textures through <img>, which the pack's fetch
// interception cannot see — src/boot/pack.ts hands those loaders a blob: URL instead, which only works when the
// texture has already landed by the time the .gltf asks for it.
//
// Run after the byte table is written (vite.config.ts): the tier's file names come from src/boot/bytes.generated.ts.
//   node --import ./scripts/bake-loader.mjs scripts/bake-packs.mjs [--check]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const PUBLIC = resolve(ROOT, 'public');
const PACK_DIR = resolve(PUBLIC, 'assets/packs');
const OUT_TS = resolve(ROOT, 'src/boot/packs.generated.ts');
const CHECK = process.argv.includes('--check');
const TIERS = ['phone'];

// the modules read the tier / chunk from the page's URL at import time: stand in for a phone page (Node has `navigator`)
globalThis.location = { search: `?tier=${TIERS[0]}`, href: 'http://bake.invalid/', pathname: '/' };

const imp = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { CHUNKS } = await imp('src/chunks/registry.ts');
const { chunkFiles } = await imp('src/boot/manifest.ts');
const { bootFetches } = await imp('src/boot/prefetch.ts');

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', glb: 'model/gltf-binary', gltf: 'model/gltf+json', bin: 'application/octet-stream', json: 'application/json' };
const typeOf = (p) => TYPES[/\.(\w+)$/.exec(p)?.[1] ?? ''] ?? 'application/octet-stream';

/** glTF textures ahead of their .gltf, everything else in the boot's own order */
function packOrder(paths) {
  const out = [];
  const placed = new Set();
  for (const p of paths) {
    if (placed.has(p)) continue;
    const m = /^(\/assets\/models\/[^/]+\/)[^/]+\.gltf$/.exec(p);
    if (m) for (const q of paths) if (!placed.has(q) && q.startsWith(`${m[1]}textures/`)) { out.push(q); placed.add(q); }
    out.push(p); placed.add(p);
  }
  return out;
}

/** one line per packed file — a diff of the generated module reads as "which files moved in or out of which part" */
function pretty(packs) {
  const part = (d) => [
    '      {',
    `        url: ${JSON.stringify(d.url)},`,
    `        bytes: ${d.bytes},`,
    '        files: [',
    ...d.files.map((f) => `          ${JSON.stringify(f)},`),
    '        ],',
    '      },',
  ].join('\n');
  const tier = (name, d) => [`    ${JSON.stringify(name)}: pack([`, ...d.parts.map(part), '    ]),'].join('\n');
  const shard = (slug, tiers) => [`  ${JSON.stringify(slug)}: {`, ...Object.entries(tiers).map(([n, d]) => tier(n, d)), '  },'].join('\n');
  return ['{', ...Object.entries(packs).map(([slug, tiers]) => shard(slug, tiers)), '}'].join('\n');
}

const PART_MIN = 1.5 * (1 << 20), PART_MAX = 4 << 20;
const pathHash = (p) => createHash('sha256').update(p).digest()[0];

/** the boot's files, in boot order, cut into parts by the path rule above */
function partsOf(paths) {
  const parts = [];
  let cur = [], bytes = 0;
  paths.forEach((p, i) => {
    cur.push(p);
    bytes += readFileSync(resolve(PUBLIC, `.${p}`)).length;
    const next = paths[i + 1];
    const texture = /\/textures\/[^/]+$/.test(p);
    const cut = next === undefined || (!texture && (bytes >= PART_MAX || (bytes >= PART_MIN && pathHash(p) % 4 === 0)));
    if (cut) { parts.push(cur); cur = []; bytes = 0; }
  });
  return parts;
}

if (!CHECK) mkdirSync(PACK_DIR, { recursive: true });
const packs = {};
const keep = new Set();
for (const def of CHUNKS) {
  for (const tierName of TIERS) {
    const files = chunkFiles(def);
    const paths = packOrder(bootFetches(def, files));
    if (paths.length < 2) continue;
    for (const p of paths) if (!existsSync(resolve(PUBLIC, `.${p}`))) throw new Error(`bake-packs: ${def.slug} boots ${p} but public has no such file`);
    const parts = partsOf(paths).map((group) => {
      const bodies = group.map((p) => readFileSync(resolve(PUBLIC, `.${p}`)));
      const blob = Buffer.concat(bodies);
      const name = `${def.slug}.${tierName}-${createHash('sha256').update(blob).digest('hex').slice(0, 8)}.bin`;
      keep.add(name);
      let o = 0;
      const rows = group.map((p, i) => { const n = bodies[i].length; const row = [p, o, n, typeOf(p)]; o += n; return row; });
      const out = resolve(PACK_DIR, name);
      if (!CHECK && !existsSync(out)) writeFileSync(out, blob);
      return { url: `/assets/packs/${name}`, bytes: blob.length, files: rows };
    });
    packs[def.slug] = { ...packs[def.slug], [tierName]: { parts } };
    const total = parts.reduce((s, x) => s + x.bytes, 0);
    console.log(`[pack] ${def.slug}.${tierName}: ${paths.length} files, ${(total / 1e6).toFixed(2)} MB in ${parts.length} parts (${parts.map((x) => (x.bytes / 1e6).toFixed(1)).join(' + ')} MB)`);
  }
}

const ts = `// generated by scripts/bake-packs.mjs from public/assets — do not edit. Regenerated by every vite build / dev.
// slug → tier → the boot pack, in content-addressed parts: each part's URL, size and [path, offset in the part, size,
// content-type] per packed file (src/boot/pack.ts). \`files\` / \`bytes\` are the whole pack's.
export type PackFile = readonly [path: string, offset: number, size: number, type: string];
export interface PackPart { readonly url: string; readonly bytes: number; readonly files: readonly PackFile[] }
export interface PackDef { readonly parts: readonly PackPart[]; readonly bytes: number; readonly files: readonly PackFile[] }
const pack = (parts: readonly PackPart[]): PackDef => ({ parts, bytes: parts.reduce((s, p) => s + p.bytes, 0), files: parts.flatMap((p) => p.files) });
export const PACKS: Readonly<Record<string, Readonly<Record<string, PackDef>>>> = ${pretty(packs)};
`;
const prev = existsSync(OUT_TS) ? readFileSync(OUT_TS, 'utf8') : '';
if (CHECK) {
  if (prev !== ts) { console.error('[pack] src/boot/packs.generated.ts is stale — run the build'); process.exit(1); }
} else {
  if (prev !== ts) writeFileSync(OUT_TS, ts);
  for (const f of readdirSync(PACK_DIR)) if (!keep.has(f)) unlinkSync(resolve(PACK_DIR, f)); // a changed file made a new hash
}
