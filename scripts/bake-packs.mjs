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
//   src/boot/packs.generated.ts                     slug → tier → { url, bytes, files: [path, offset, size, type][] }
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

/** one line per packed file — a diff of the generated module reads as "which files moved in or out of which pack" */
function pretty(packs) {
  const tier = (name, d) => [
    `    ${JSON.stringify(name)}: {`,
    `      url: ${JSON.stringify(d.url)},`,
    `      bytes: ${d.bytes},`,
    '      files: [',
    ...d.files.map((f) => `        ${JSON.stringify(f)},`),
    '      ],',
    '    },',
  ].join('\n');
  const shard = (slug, tiers) => [`  ${JSON.stringify(slug)}: {`, ...Object.entries(tiers).map(([n, d]) => tier(n, d)), '  },'].join('\n');
  return ['{', ...Object.entries(packs).map(([slug, tiers]) => shard(slug, tiers)), '}'].join('\n');
}

if (!CHECK) mkdirSync(PACK_DIR, { recursive: true });
const packs = {};
const keep = new Set();
for (const def of CHUNKS) {
  for (const tierName of TIERS) {
    const paths = packOrder(bootFetches(def, chunkFiles(def)));
    if (paths.length < 2) continue;
    const bodies = paths.map((p) => {
      const f = resolve(PUBLIC, `.${p}`);
      if (!existsSync(f)) throw new Error(`bake-packs: ${def.slug} boots ${p} but public has no such file`);
      return readFileSync(f);
    });
    const blob = Buffer.concat(bodies);
    const name = `${def.slug}.${tierName}-${createHash('sha256').update(blob).digest('hex').slice(0, 8)}.bin`;
    keep.add(name);
    let o = 0;
    const files = paths.map((p, i) => { const n = bodies[i].length; const row = [p, o, n, typeOf(p)]; o += n; return row; });
    packs[def.slug] = { ...packs[def.slug], [tierName]: { url: `/assets/packs/${name}`, bytes: blob.length, files } };
    const out = resolve(PACK_DIR, name);
    if (!CHECK && !existsSync(out)) writeFileSync(out, blob);
    console.log(`[pack] ${def.slug}.${tierName}: ${files.length} files, ${(blob.length / 1e6).toFixed(2)} MB → /assets/packs/${name}`);
  }
}

const ts = `// generated by scripts/bake-packs.mjs from public/assets — do not edit. Regenerated by every vite build / dev.
// slug → tier → the boot pack: its URL, size and [path, offset, size, content-type] per packed file (src/boot/pack.ts).
export type PackFile = readonly [path: string, offset: number, size: number, type: string];
export interface PackDef { readonly url: string; readonly bytes: number; readonly files: readonly PackFile[] }
export const PACKS: Readonly<Record<string, Readonly<Record<string, PackDef>>>> = ${pretty(packs)};
`;
const prev = existsSync(OUT_TS) ? readFileSync(OUT_TS, 'utf8') : '';
if (CHECK) {
  if (prev !== ts) { console.error('[pack] src/boot/packs.generated.ts is stale — run the build'); process.exit(1); }
} else {
  if (prev !== ts) writeFileSync(OUT_TS, ts);
  for (const f of readdirSync(PACK_DIR)) if (!keep.has(f)) unlinkSync(resolve(PACK_DIR, f)); // a changed file made a new hash
}
