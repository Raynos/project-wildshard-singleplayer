#!/usr/bin/env node
// bake-pine-coats.mjs — Pine Hollow's creature coats as KTX2 (G187 cut 2, E435). The coats are painted on the CPU from
// the hull's atlas (src/shards/pine-hollow/species/coats.ts pineCoatAtlas), which a KTX2 hull cannot give: its atlas is a
// compressed texture with no pixels. So the game paints them here, offline, and the KTX2 path loads the result.
//
// How: a served build of Pine Hollow on an IMAGES page per tier (the phone as "iPhone 16 Pro", the desktop at 1440×900),
// muted; once the world is up, the `harness.shard.pine-hollow` capture handle's `coats` (species/hulls.ts pineCoatSources) runs pineCoatAtlas for
// every hull variant whose coat repaints the atlas — the same function, rig, variant and joints the game uses — and hands
// back each canvas as a lossless PNG. Each is encoded with bake-ktx2.mjs's colour class (UASTC LDR 4×4 level 2, sRGB, full
// box-filtered mips, zstd 20), unflipped (glTF orientation, as the hull's own map), content-addressed under
// public/assets/gpu/pine-hollow/creatures/coats/. scripts/bake-pine-coats.json maps, per tier, the coat's table name
// (species/rigs.ts pineCoatUrl: `<hull>[.phone].<kind>.<variant>.coat.png` beside the rig, a name, not a
// file) to its KTX2; bake-ktx2.mjs merges it into Pine's KTX2 table (src/shards/pine-hollow/ktx2.generated.ts) and keeps
// the files. Rerun whenever a coat, a palette or a hull changes, then rerun bake-ktx2.mjs.
//
//   scripts/serve-build.sh --rev <sha>   →   scripts/browser-lane.sh node scripts/bake-pine-coats.mjs <preview-url> [--tiers=phone,desktop]
//   node --import ./scripts/bake-loader.mjs scripts/bake-ktx2.mjs
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { saveFixtureCode } from './debug-settings.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PUB = resolve(ROOT, 'public');
const OUT = resolve(PUB, 'assets/gpu/pine-hollow/creatures/coats');
const TABLE = resolve(ROOT, 'scripts/bake-pine-coats.json');
const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'))?.replace(/\/$/u, '');
const tiers = (argv.find((a) => a.startsWith('--tiers='))?.slice(8) ?? 'phone,desktop').split(',');
if (!url || tiers.some((t) => !['phone', 'desktop'].includes(t))) throw new Error('Usage: bake-pine-coats.mjs <preview-url> [--tiers=phone,desktop]');
const ENCODER = /v[\d.]+/.exec(execFileSync('basisu', ['-version']).toString())?.[0] ?? '?';
/** bake-ktx2.mjs COMMON + CLASS.color */
const FLAGS = ['-ktx2', '-mipmap', '-mip_filter', 'box', '-max_threads', '4', '-uastc', '-uastc_level', '2', '-srgb', '-ktx2_zstandard_level', '20'];
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const pub = (abs) => `/${relative(PUB, abs).split('\\').join('/')}`;

const prior = existsSync(TABLE) ? JSON.parse(readFileSync(TABLE, 'utf8')) : {};
const cache = prior.cache ?? {};
const table = { phone: prior.phone ?? {}, desktop: prior.desktop ?? {} };
const used = new Set();
const TMP = join(tmpdir(), `bake-pine-coats-${process.pid}`);
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
let encoded = 0, reused = 0;

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
    await page.goto(`${url}/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0`);
    await page.waitForFunction('Boolean(window.__wildshard?.world?.game) && !document.querySelector(".ws-load")', undefined, { timeout: 180000 });
    const tex = await page.evaluate(() => document.documentElement.dataset.tex ?? null);
    const sources = /** @type {{ url: string; png: string }[]} */ (await page.evaluate(() => window.__wildshard.world.game.app.debug.snapshot()['harness.shard.pine-hollow'].coats()));
    await context.close();
    if (sources.length === 0) throw new Error(`${tier}: no coats (texture mode ${tex}; errors: ${errors.join(' | ')})`);
    const next = {};
    for (const s of sources) {
      const png = Buffer.from(s.png.slice(s.png.indexOf(',') + 1), 'base64');
      const key = sha(`${sha(png)}|${ENCODER}|${FLAGS.join(' ')}`);
      used.add(key);
      let out = cache[key];
      if (out && existsSync(join(PUB, out))) reused++;
      else {
        const src = join(TMP, `${encoded}.png`), dst = join(TMP, `${encoded}.ktx2`);
        writeFileSync(src, png);
        execFileSync('basisu', [...FLAGS, src, '-output_file', dst], { stdio: ['ignore', 'ignore', 'pipe'] });
        const bytes = readFileSync(dst);
        const stem = s.url.slice(s.url.lastIndexOf('/') + 1).replace(/\.png$/u, '');
        const file = join(OUT, `${stem}-${sha(bytes).slice(0, 8)}.ktx2`);
        writeFileSync(file, bytes);
        out = pub(file); cache[key] = out; encoded++;
      }
      next[s.url] = out;
    }
    table[tier] = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
    console.log(`bake-pine-coats: ${tier} ${sources.length} coats (texture mode ${tex})`);
  }
} finally { await browser.close(); }

for (const k of Object.keys(cache)) if (!used.has(k) && !Object.values(table).some((t) => Object.values(t).includes(cache[k]))) delete cache[k];
const live = new Set([...Object.values(table.phone), ...Object.values(table.desktop)]);
for (const f of readdirSync(OUT)) if (!live.has(pub(join(OUT, f)))) rmSync(join(OUT, f));
writeFileSync(TABLE, `${JSON.stringify({ $doc: 'G187 cut 2: written by scripts/bake-pine-coats.mjs (per tier: coat table name -> KTX2; cache: PNG+settings hash -> KTX2); merged into Pine\'s KTX2 table by scripts/bake-ktx2.mjs', phone: table.phone, desktop: table.desktop, cache }, null, 1)}\n`);
rmSync(TMP, { recursive: true, force: true });
console.log(`bake-pine-coats: ${encoded} encoded, ${reused} reused · ${live.size} files`);
