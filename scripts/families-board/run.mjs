#!/usr/bin/env node
// run.mjs: SF10a's material-family board (SHARD-PLATFORM §4 F1 SF10a). Builds the harness (board.js, vite's API) into a scratch
// dir, serves it with the repo's public/ on one local port, opens one muted headless Chromium on Metal (iPhone 16 Pro
// descriptor), draws each reference prop TODAY vs FAMILY (board.js) and composes the portrait board (PIL, JPEG ≤ 500 KB).
//
//   scripts/browser-lane.sh node scripts/families-board/run.mjs [--set=part1|part2] [--out=<jpg>] [--scratch=<dir>]
//   part1 (default): toon + PBR → progress/families/sf10a-toon-pbr.jpg
//   part2: painterly (Nalati), emissive (Nine Dragon's neon); Signal Dunes' sky and sand rows retired with their old shaders (SF50, G112)
//          → progress/families/sf10a-painterly-emissive.jpg
//
// Prints one JSON line per panel: the pixel difference (mean / max per channel on 0–255, % of pixels off by > 8, PSNR)
// and the precompile reading (family jobs, programs they built, programs the first family draw still built: 0 = none).
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const SET = flag('set', 'part1');
const OUT = resolvePath(ROOT, flag('out', SET === 'part2' ? 'progress/families/sf10a-painterly-emissive.jpg' : 'progress/families/sf10a-toon-pbr.jpg'));
const KINDS = flag('kinds', '') !== '' ? flag('kinds', '').split(',') : SET === 'part2' ? ['painterly', 'neon'] : ['toon-midday', 'toon-golden', 'pbr'];
const SCRATCH = resolvePath(flag('scratch', join(tmpdir(), `families-board-${process.pid}`)));
const DIST = join(SCRATCH, 'dist');
mkdirSync(SCRATCH, { recursive: true });

const { build } = await import('vite');
await build({
  configFile: false, root: join(ROOT, 'scripts/families-board'), publicDir: false, logLevel: 'warn',
  define: { __BUILD_ID__: JSON.stringify('families-board'), __SAVE_NAMESPACES__: JSON.stringify([]), __DEVSERVER__: 'false' },
  build: { outDir: DIST, emptyOutDir: true, target: 'es2022', minify: false, reportCompressedSize: false, chunkSizeWarningLimit: 100000 },
});

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
  const file = [join(DIST, path === '/' ? 'index.html' : path), join(ROOT, 'public', path)].find((f) => f.startsWith(DIST) || f.startsWith(join(ROOT, 'public')) ? existsSync(f) && statSync(f).isFile() : false);
  if (file === undefined) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => { server.listen(0, '127.0.0.1', () => { resolve(undefined); }); });
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const panels = [];
try {
  for (const kind of KINDS) {
    // a fresh page per panel: the toon side installs the shard's page-wide chunk patch, which must not reach the PBR panel
    const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => { errors.push(String(e)); });
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    await page.goto(`${base}/index.html`);
    await page.waitForFunction(() => typeof window.familiesBoard === 'function', undefined, { timeout: 60000 });
    const r = await page.evaluate((k) => window.familiesBoard(k), kind);
    if (errors.length > 0) console.error(kind, errors.slice(0, 5));
    for (const side of ['today', 'family']) writeFileSync(join(SCRATCH, `${kind}-${side}.png`), Buffer.from(r[side].split(',')[1], 'base64'));
    panels.push({ kind, diff: r.diff, precompile: r.precompile, notes: r.notes, errors });
    console.log(JSON.stringify({ kind, diff: r.diff, precompile: r.precompile, notes: r.notes, errors }));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

const PY = String.raw`
import json, sys
from PIL import Image, ImageDraw, ImageFont, ImageChops
scratch, out, panels, part = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), sys.argv[4]
W, P, G = 1206, 573, 20
def font(n, bold=False):
    for f in (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        try: return ImageFont.truetype(f, n)
        except OSError: pass
    return ImageFont.load_default()
rows = [('toon-midday', 'Driftwood Isle - sailboat - midday', 'toon family'), ('toon-golden', 'Driftwood Isle - sailboat - golden hour (look set by the adapter)', 'toon family'), ('pbr', 'Pine Hollow - wine barrel (Poly Haven scan)', 'PBR family')]
title, sub = 'Material families v1: today vs family', 'SF10a part 1 - same light, camera and ground; only the prop material changes'
if part == 'part2':
    P = 440
    rows = [('painterly', 'Nalati Grasslands - camp still life (today: material + grade pass)', 'painterly + grade'), ('neon', 'Nine Dragon Stack - neon calligraphy sign (tubes)', 'emissive tube')]
    title, sub = 'Material families v1 part 2: today vs family', 'SF10a part 2 - painterly, emissive and the PBR ground layer; same light, camera and display per row'
H = 150 + len(rows) * (P + 140) + 30
board = Image.new('RGB', (W, H), (24, 26, 30))
d = ImageDraw.Draw(board)
d.text((G, 30), title, font=font(44, True), fill=(240, 240, 240))
d.text((G, 90), sub, font=font(24), fill=(170, 175, 185))
y = 150
for kind, title, fam in rows:
    p = next(x for x in panels if x['kind'] == kind)
    d.text((G, y), title, font=font(28, True), fill=(235, 225, 200))
    for i, (side, label) in enumerate([('today', 'TODAY (shard material)'), ('family', 'FAMILY (' + fam + ' + params)')]):
        im = Image.open(f'{scratch}/{kind}-{side}.png').convert('RGB').resize((P, P), Image.LANCZOS)
        x = G + i * (P + G)
        board.paste(im, (x, y + 42))
        d.rectangle([x, y + 42, x + 16 + int(d.textlength(label, font=font(22, True))), y + 76], fill=(0, 0, 0))
        d.text((x + 8, y + 46), label, font=font(22, True), fill=(255, 255, 255))
    df, pc = p['diff'], p['precompile']
    same = 'IDENTICAL (max 0 / 255)' if df['max'] == 0 else f"mean {df['mean']} / 255, max {df['max']}, {df['over8']}% px > 8, PSNR {df['psnr']} dB"
    built = f"{pc['built']} new programs" if pc['built'] > 0 else "0 new programs (shares today's program)"
    ctl = next((n for n in p['notes'] if n.startswith('control')), '')
    d.text((G, y + 42 + P + 8), f"pixels: {same}  -  precompile: {built}, {pc['firstDraw']} at first draw", font=font(21), fill=(190, 210, 190))
    d.text((G, y + 42 + P + 38), ctl, font=font(19), fill=(150, 155, 165))
    y += P + 140
q = 90
while True:
    board.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
    import os
    if os.path.getsize(out) <= 500_000 or q <= 40: break
    q -= 5
print(out, os.path.getsize(out), 'bytes, q', q)
`;
mkdirSync(resolvePath(OUT, '..'), { recursive: true });
execFileSync('python3', ['-c', PY, SCRATCH, OUT, JSON.stringify(panels), SET], { stdio: 'inherit' });
if (flag('scratch', '') === '') rmSync(SCRATCH, { recursive: true, force: true });
