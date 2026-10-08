#!/usr/bin/env node
// bake-viewmodel-sets.mjs — a level's weapon viewmodel texture sets as KTX2 (G187 cut 3, E435). The crossbow's and the
// rifle's walnut, steel, leather, bolt and gunmetal sets are drawn at every boot (src/engine/player/viewmodelTextures.ts
// makePixels, in a worker) and uploaded as RGBA8 DataTextures: ~18 MB of Pine Hollow's phone GL. Their pixels never change
// (seeded), so they are drawn here, offline, and the KTX2 path loads them compressed (src/engine/combat/view/ranged.ts
// startViewmodelTextures adopts a set whose three planes the level's KTX2 table holds).
//
// How: vite bundles viewmodelTextures.ts as it stands (the game's own makePixels) into a muted Chromium page, which draws
// each set (the steel sets' scratches need its 2D canvas) and hands back the raw RGBA planes. Each plane is written as a
// lossless PNG, row 0 = v 0 (the DataTexture's order), and encoded with bake-ktx2.mjs's classes — colour (UASTC 4×4
// level 2, sRGB), normal (UASTC, -normal_map), ARM as `linear` (UASTC, linear) — full box-filtered mips, zstd 20,
// unflipped (a DataTexture is not flipped either), content-addressed under public/assets/gpu/baked/<slug>/viewmodel/.
// The sets are a fixed size on every tier, so one file serves both: scripts/bake-viewmodel-sets.json maps, per tier, the
// plane's table name (viewmodelTextures.ts viewmodelBakeUrl: `/assets/baked/<slug>/viewmodel/<set>.<col|nrm|arm>.png`, a
// name, not a file) to its KTX2; bake-ktx2.mjs merges it into the level's KTX2 table and keeps the files. Rerun whenever
// a set's drawing changes, then rerun bake-ktx2.mjs.
//
//   node scripts/bake-viewmodel-sets.mjs [--slug=pine-hollow] [--sets=brushed-steel,leather,bolt,gunmetal]
//   node --import ./scripts/bake-loader.mjs scripts/bake-ktx2.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { chromium } from 'playwright';
import { build } from 'vite';

const ROOT = resolve(import.meta.dirname, '..');
const PUB = resolve(ROOT, 'public');
const TABLE = resolve(ROOT, 'scripts/bake-viewmodel-sets.json');
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const slug = flag('slug', 'pine-hollow');
/**
 * the sets the level's weapons wear on the GPU (Pine Hollow: the crossbow's brushed-steel / leather / bolt, the
 * lever-action's gunmetal). The cord stays drawn (64², no ARM plane), and so does the walnut: the crossbow stock fills the
 * bottom of every phone shot, magnified, and its UASTC grain held the gate pose at SSIM 0.99961 against Pine's 0.99959
 * floor (drawn: 0.99974)
 */
const sets = flag('sets', 'brushed-steel,leather,bolt,gunmetal').split(',');
const OUT = resolve(PUB, `assets/gpu/baked/${slug}/viewmodel`);
const ENCODER = /v[\d.]+/.exec(execFileSync('basisu', ['-version']).toString())?.[0] ?? '?';
/** bake-ktx2.mjs COMMON + CLASS (color / normal / linear: the ARM plane is UASTC, not bake-ktx2's ETC1S `data` class — its
 *  roughness / metalness blocks moved the held weapon's highlights past Pine's parity floor on the phone) */
const COMMON = ['-ktx2', '-mipmap', '-mip_filter', 'box', '-max_threads', '4'];
const CLASS = {
  col: ['-uastc', '-uastc_level', '2', '-srgb', '-ktx2_zstandard_level', '20'],
  nrm: ['-uastc', '-uastc_level', '2', '-normal_map', '-ktx2_zstandard_level', '20'],
  arm: ['-uastc', '-uastc_level', '2', '-linear', '-ktx2_zstandard_level', '20'],
};
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const pub = (abs) => `/${relative(PUB, abs).split('\\').join('/')}`;
const bakeUrl = (set, plane) => `procedural:/assets/baked/${slug}/viewmodel/${set}.${plane}.png`; // viewmodelTextures.ts viewmodelBakeUrl

/** a minimal RGBA8 PNG (filter 0 rows, zlib): lossless, so the planes reach basisu exactly as makePixels drew them */
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// the game's makePixels, bundled as an IIFE for the page
const bundle = await build({
  configFile: false, logLevel: 'warn', root: ROOT,
  build: { write: false, minify: false, lib: { entry: resolve(ROOT, 'src/engine/player/viewmodelTextures.ts'), formats: ['iife'], name: 'ViewmodelTextures', fileName: () => 'vt.js' } },
});
const output = (Array.isArray(bundle) ? bundle[0] : bundle).output.find((o) => o.type === 'chunk');
if (!output) throw new Error('bake-viewmodel-sets: vite produced no chunk');

const prior = existsSync(TABLE) ? JSON.parse(readFileSync(TABLE, 'utf8')) : {};
const cache = prior.cache ?? {};
const mine = (url) => url.replace(/^procedural:/u, '').startsWith(`/assets/baked/${slug}/viewmodel/`);
const next = Object.fromEntries(Object.entries(prior.phone ?? {}).filter(([url]) => !mine(url)));
const used = new Set();
const TMP = join(tmpdir(), `bake-viewmodel-sets-${process.pid}`);
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
let encoded = 0, reused = 0;

const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio'] });
try {
  const page = await (await browser.newContext()).newPage();
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: output.code });
  for (const set of sets) {
    const drawn = await page.evaluate((name) => {
      const canvas2d = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); if (g === null) throw new Error('no 2d context'); return g; };
      const p = window.ViewmodelTextures.makePixels(name, canvas2d);
      const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCodePoint(...u8.subarray(i, i + 0x8000)); return btoa(s); };
      return { w: p.w, h: p.h, col: b64(p.col), nrm: b64(p.nrm), arm: p.arm ? b64(p.arm) : null };
    }, set);
    for (const plane of /** @type {const} */ (['col', 'nrm', 'arm'])) {
      const b64 = drawn[plane];
      if (b64 === null) throw new Error(`bake-viewmodel-sets: ${set} has no ${plane} plane`);
      const image = png(drawn.w, drawn.h, new Uint8Array(Buffer.from(b64, 'base64')));
      const key = sha(`${sha(image)}|${ENCODER}|${[...COMMON, ...CLASS[plane]].join(' ')}`);
      used.add(key);
      let out = cache[key];
      if (out && existsSync(join(PUB, out))) reused++;
      else {
        const src = join(TMP, `${encoded}.png`), dst = join(TMP, `${encoded}.ktx2`);
        writeFileSync(src, image);
        execFileSync('basisu', [...COMMON, ...CLASS[plane], src, '-output_file', dst], { stdio: ['ignore', 'ignore', 'pipe'] });
        const bytes = readFileSync(dst);
        const file = join(OUT, `${set}.${plane}-${sha(bytes).slice(0, 8)}.ktx2`);
        writeFileSync(file, bytes);
        out = pub(file); cache[key] = out; encoded++;
      }
      next[bakeUrl(set, plane)] = out;
    }
    console.log(`bake-viewmodel-sets: ${slug} ${set} ${drawn.w}×${drawn.h}`);
  }
} finally { await browser.close(); }

const table = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
const live = new Set(Object.values(table));
for (const k of Object.keys(cache)) if (!used.has(k) && !live.has(cache[k])) delete cache[k];
for (const f of readdirSync(OUT)) if (!live.has(pub(join(OUT, f)))) rmSync(join(OUT, f));
// one size on every tier: both tiers name the same files
writeFileSync(TABLE, `${JSON.stringify({ $doc: 'G187 cut 3: written by scripts/bake-viewmodel-sets.mjs (per tier: viewmodel set plane table name -> KTX2; cache: PNG+settings hash -> KTX2); merged into the level\'s KTX2 table by scripts/bake-ktx2.mjs', phone: table, desktop: table, cache }, null, 1)}\n`);
rmSync(TMP, { recursive: true, force: true });
console.log(`bake-viewmodel-sets: ${encoded} encoded, ${reused} reused · ${live.size} files`);
