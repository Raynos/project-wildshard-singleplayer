#!/usr/bin/env node
// bake-coats.mjs — a shard's creature coats, painted offline (G187 cut 2 for Pine Hollow; SHARD-PLATFORM G226 for Nalati,
// E435). The coats are painted on the CPU from each rigged hull's atlas by the shard's own coat painter, which costs the
// entry hundreds of milliseconds to seconds (and which a KTX2 hull cannot do at all: its atlas has no pixels). So the game
// paints them here, offline, and the runtime loads the result.
//
// How, Pine Hollow (SF87, G320): no game page. scripts/bake/pineCoatsPage.ts (Pine's data/hulls.ts row, its species rows
// and looks, the game's rigged-hull coat painter; no runtime/ or legacy code) is bundled alone and run per tier (the phone
// as "iPhone 16 Pro", the desktop at 1440×900, muted) on a page served from public/ only (the committed rig GLBs).
// How, Nalati: a served build of the shard per tier, as above, booted through `?chunk=` on an IMAGES page; once the world
// is up, the shard's `harness.shard.<slug>` capture handle's `coats()` paints them (its rewrite is still open, SF87).
// Either way every hull variant whose coat repaints the atlas is painted by the same function, rig, variant and joints the
// game uses and handed back as a lossless PNG keyed by its table name. Each is encoded with bake-ktx2.mjs's colour class
// (UASTC LDR 4×4 level 2, sRGB, full box-filtered mips, zstd 20), unflipped (glTF orientation, as the hull's own map),
// content-addressed under the shard's `ktx2` folder. The shard's table (`table`) maps, per tier, each coat's table name to
// its KTX2; bake-ktx2.mjs merges it into the shard's KTX2 table and keeps the files.
//   pine-hollow        the table name is a name, not a file (species/rigs.ts pineCoatUrl): only the KTX2 path reads coats;
//   nalati-grasslands  the table name is a real file (species/rigs.ts nalatiCoatUrl): the coat stored LOSSLESS (WebP,
//                      the canvas's exact pixels, unflipped) for the images path, its KTX2 stand-in for the KTX2 path.
// Rerun whenever a coat, a palette or a hull changes, then rerun bake-ktx2.mjs.
//
//   scripts/browser-lane.sh node scripts/bake-coats.mjs --shard=pine-hollow [--tiers=phone,desktop]
//   scripts/serve-build.sh --rev <sha>   →   scripts/browser-lane.sh node scripts/bake-coats.mjs <preview-url> --shard=nalati-grasslands
//   node --import ./scripts/bake-loader.mjs scripts/bake-ktx2.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { chromium, devices } from 'playwright';
import { build } from 'vite';
import { saveFixtureCode } from './debug-settings.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PUB = resolve(ROOT, 'public');
/** per shard: the KTX2 folder, the table, and (Nalati) the folder of the lossless images the table names */
const SHARDS = {
  'pine-hollow': { ktx2: 'assets/gpu/pine-hollow/creatures/coats', table: 'src/shards/pine-hollow/generators/bake-pine-coats.json', images: null, doc: 'G187 cut 2', page: { entry: 'scripts/bake/pineCoatsPage.ts', fn: 'bakePineCoats' } },
  'nalati-grasslands': { ktx2: 'assets/gpu/nalati/models/coats', table: 'src/shards/nalati-grasslands/generators/bake-nalati-coats.json', images: 'assets/nalati/models/coats', doc: 'SHARD-PLATFORM G226', page: null },
};
const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'))?.replace(/\/$/u, '');
const slug = argv.find((a) => a.startsWith('--shard='))?.slice(8) ?? '';
const tiers = (argv.find((a) => a.startsWith('--tiers='))?.slice(8) ?? 'phone,desktop').split(',');
const shard = Object.hasOwn(SHARDS, slug) ? SHARDS[/** @type {keyof typeof SHARDS} */ (slug)] : undefined;
if (!shard || (shard.page === null && !url) || tiers.some((t) => !['phone', 'desktop'].includes(t))) throw new Error(`Usage: bake-coats.mjs [<preview-url> (nalati-grasslands)] --shard=<${Object.keys(SHARDS).join('|')}> [--tiers=phone,desktop]`);
const OUT = resolve(PUB, shard.ktx2);
const IMAGES = shard.images === null ? null : resolve(PUB, shard.images);
const TABLE = resolve(ROOT, shard.table);
const ENCODER = /v[\d.]+/.exec(execFileSync('basisu', ['-version']).toString())?.[0] ?? '?';
/** bake-ktx2.mjs COMMON + CLASS.color */
const FLAGS = ['-ktx2', '-mipmap', '-mip_filter', 'box', '-max_threads', '4', '-uastc', '-uastc_level', '2', '-srgb', '-ktx2_zstandard_level', '20'];
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const pub = (abs) => `/${relative(PUB, abs).split('\\').join('/')}`;

const prior = existsSync(TABLE) ? JSON.parse(readFileSync(TABLE, 'utf8')) : {};
const cache = prior.cache ?? {};
const table = { phone: prior.phone ?? {}, desktop: prior.desktop ?? {} };
const used = new Set();
const TMP = join(tmpdir(), `bake-coats-${process.pid}`);
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
if (IMAGES !== null) mkdirSync(IMAGES, { recursive: true });
let encoded = 0, reused = 0;

/**
 * A shard's bake page (SF87, G320): its entry bundled alone (ES modules, every chunk in memory) and served with public/
 * from a local server that serves nothing else; `close` stops it.
 * @param {{ entry: string; fn: string }} page
 */
async function bakePage(page) {
  const out = await build({ configFile: false, logLevel: 'error', publicDir: false, root: ROOT,
    build: { write: false, target: 'esnext', minify: false, lib: { entry: resolve(ROOT, page.entry), formats: ['es'], fileName: 'bake' } } });
  /** @type {Map<string, string>} */ const chunks = new Map();
  for (const bundle of Array.isArray(out) ? out : [out]) if ('output' in bundle) for (const c of bundle.output) if (c.type === 'chunk') chunks.set(`/${c.fileName}`, c.code);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://bake').pathname);
    const code = chunks.get(path);
    if (path === '/') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>coat bake</title>'); return; }
    if (code !== undefined) { res.setHeader('content-type', 'text/javascript'); res.end(code); return; }
    const file = join(PUB, path);
    if (!file.startsWith(PUB + sep) || !existsSync(file) || !statSync(file).isFile()) { res.statusCode = 404; res.end(); return; }
    res.setHeader('content-type', file.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream'); res.end(readFileSync(file));
  });
  await new Promise((_resolve) => { server.listen(0, '127.0.0.1', () => { _resolve(undefined); }); });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('bake-coats: no bake page port');
  return { url: `http://127.0.0.1:${address.port}`, close: () => { server.close(); } };
}

const served = shard.page === null ? null : await bakePage(shard.page);
const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const tier of tiers) {
    const context = await browser.newContext(tier === 'phone'
      ? { ...devices['iPhone 16 Pro'], serviceWorkers: 'block' }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await context.addInitScript(saveFixtureCode({ scope: 'global', key: 'settings', data: { tier, fps: 'auto', tex: 'img' }, merge: true }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    /** @type {{ url: string; png: string }[]} */ let sources;
    /** @type {string | null} */ let tex = 'img';
    if (served !== null && shard.page !== null) {
      await page.goto(`${served.url}/`);
      await page.addScriptTag({ url: '/bake.js', type: 'module' });
      const fn = shard.page.fn;
      await page.waitForFunction((name) => typeof Reflect.get(window, name) === 'function', fn, { timeout: 60000 });
      sources = await page.evaluate(({ name, t }) => Reflect.get(window, name)(t), { name: fn, t: tier });
    } else {
      await page.goto(`${url}/?chunk=${slug}&mute=1&skipintro=1&nolock=1&sw=0`);
      await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 180000 });
      tex = await page.evaluate(() => document.documentElement.dataset.tex ?? null);
      sources = await page.evaluate((s) => window.__wildshard.world.game.app.debug.snapshot()[`harness.shard.${s}`].coats(), slug);
    }
    await context.close();
    if (sources.length === 0) throw new Error(`${tier}: no coats (texture mode ${tex}; errors: ${errors.join(' | ')})`);
    const next = {};
    for (const s of sources) {
      const png = Buffer.from(s.png.slice(s.png.indexOf(',') + 1), 'base64');
      if (IMAGES !== null) {
        // the images path's file: the canvas's exact pixels (lossless, -exact keeps every RGB)
        const file = join(PUB, s.url);
        if (!file.startsWith(`${IMAGES}/`)) throw new Error(`${s.url}: not under /${shard.images}`);
        const src = join(TMP, 'lossless.png');
        writeFileSync(src, png);
        mkdirSync(dirname(file), { recursive: true });
        execFileSync('cwebp', ['-quiet', '-lossless', '-exact', '-z', '9', '-metadata', 'none', src, '-o', file]);
      }
      const key = sha(`${sha(png)}|${ENCODER}|${FLAGS.join(' ')}`);
      used.add(key);
      let out = cache[key];
      if (out && existsSync(join(PUB, out))) reused++;
      else {
        const src = join(TMP, `${encoded}.png`), dst = join(TMP, `${encoded}.ktx2`);
        writeFileSync(src, png);
        execFileSync('basisu', [...FLAGS, src, '-output_file', dst], { stdio: ['ignore', 'ignore', 'pipe'] });
        const bytes = readFileSync(dst);
        const stem = s.url.slice(s.url.lastIndexOf('/') + 1).replace(/\.(png|webp)$/u, '');
        const file = join(OUT, `${stem}-${sha(bytes).slice(0, 8)}.ktx2`);
        writeFileSync(file, bytes);
        out = pub(file); cache[key] = out; encoded++;
      }
      next[s.url] = out;
    }
    table[tier] = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    console.log(`bake-coats: ${slug} ${tier} ${sources.length} coats (texture mode ${tex})`);
  }
} finally { await browser.close(); served?.close(); }

for (const k of Object.keys(cache)) if (!used.has(k) && !Object.values(table).some((t) => Object.values(t).includes(cache[k]))) delete cache[k];
const live = new Set([...Object.values(table.phone), ...Object.values(table.desktop)]);
for (const f of readdirSync(OUT)) if (!live.has(pub(join(OUT, f)))) rmSync(join(OUT, f));
if (IMAGES !== null) {
  const named = new Set([...Object.keys(table.phone), ...Object.keys(table.desktop)]);
  for (const f of readdirSync(IMAGES)) if (!named.has(pub(join(IMAGES, f)))) rmSync(join(IMAGES, f));
}
writeFileSync(TABLE, `${JSON.stringify({ $doc: `${shard.doc}: written by scripts/bake-coats.mjs --shard=${slug} (per tier: coat table name -> KTX2; cache: PNG+settings hash -> KTX2); merged into the shard's KTX2 table by scripts/bake-ktx2.mjs`, phone: table.phone, desktop: table.desktop, cache }, null, 1)}\n`);
rmSync(TMP, { recursive: true, force: true });
console.log(`bake-coats: ${encoded} encoded, ${reused} reused · ${live.size} files`);
