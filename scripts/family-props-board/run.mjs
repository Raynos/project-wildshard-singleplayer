#!/usr/bin/env node
// run.mjs: the SF9b / SF10a follow-up board (SHARD-PLATFORM, E435): declared props keep their material family's shader,
// and the PBR family's flat-shading option. Builds board.js (vite's API) into a scratch dir, serves it with the template
// shard's assets on one local port, opens one muted headless Chromium on Metal as the iPhone 16 Pro, draws each row
// BEFORE / AFTER / REFERENCE (board.js) and composes one portrait board (PIL, JPEG ≤ 500 KB).
//
//   scripts/browser-lane.sh node scripts/family-props-board/run.mjs [--out=<jpg>] [--scratch=<dir>]
//
// Prints one JSON line per row: AFTER vs REFERENCE and BEFORE vs REFERENCE pixel differences (mean / max per channel
// on 0–255, % of pixels off by > 8) and the SF10a precompile reading for AFTER (programs the first draw built: 0 = none).
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const OUT = resolvePath(ROOT, flag('out', 'progress/shard-platform/sf9b-props/board.jpg'));
const SCRATCH = resolvePath(flag('scratch', `/private/tmp/claude-501/sp-builders/sf9b-props/board-${process.pid}`));
const DIST = join(SCRATCH, 'dist'), ASSETS = join(ROOT, 'src/shards/_template/assets');
mkdirSync(SCRATCH, { recursive: true });

const { build } = await import('vite');
await build({
  configFile: false, root: join(ROOT, 'scripts/family-props-board'), publicDir: false, logLevel: 'warn',
  define: { __BUILD_ID__: JSON.stringify('family-props-board'), __SAVE_NAMESPACES__: JSON.stringify([]), __DEVSERVER__: 'false' },
  build: { outDir: DIST, emptyOutDir: true, target: 'esnext', minify: false, reportCompressedSize: false, chunkSizeWarningLimit: 100000 },
});

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
  const file = path.startsWith('/template-assets/') ? join(ASSETS, path.slice('/template-assets/'.length)) : join(DIST, path === '/' ? 'index.html' : path);
  if (!(file.startsWith(DIST) || file.startsWith(ASSETS)) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => { server.listen(0, '127.0.0.1', () => { resolve(undefined); }); });
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const rows = [];
try {
  for (const kind of ['toon', 'painterly', 'pool']) {
    const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => { errors.push(String(e)); });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/index.html`);
    await page.waitForFunction(() => typeof window.familyPropsBoard === 'function', undefined, { timeout: 60000 });
    const r = await page.evaluate((k) => window.familyPropsBoard(k), kind);
    for (const side of ['before', 'after', 'reference']) writeFileSync(join(SCRATCH, `${kind}-${side}.png`), Buffer.from(r[side].split(',')[1], 'base64'));
    const row = { kind, diff: r.diff, precompile: r.precompile, tiles: r.tiles, errors };
    rows.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

const PY = String.raw`
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
scratch, out, rows = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
CW, CH, G = 380, 507, 14
W = 3 * CW + 4 * G
def font(n, bold=False):
    for f in (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        try: return ImageFont.truetype(f, n)
        except OSError: pass
    return ImageFont.load_default()
meta = {
  'toon': ('Driftwood sailboat as declared props - toon family', ['BEFORE: per-mesh clone (plain)', 'AFTER: shared family variant', 'REFERENCE: toon family direct']),
  'painterly': ('Nalati camp still life as declared props - painterly family', ['BEFORE: per-mesh clone (plain)', 'AFTER: shared family variant', 'REFERENCE: painterly direct']),
  'pool': ('Template pool, shardfile terrain tiles - PBR family', ['BEFORE: smooth PBR (implicit)', 'AFTER: PBR faceted: true', 'REFERENCE: today, flat-shaded']),
}
RH = 44 + CH + 64
H = 140 + len(rows) * RH + 20
board = Image.new('RGB', (W, H), (24, 26, 30))
d = ImageDraw.Draw(board)
d.text((G, 24), 'Declared props keep their family shader', font=font(40, True), fill=(240, 240, 240))
d.text((G, 80), 'SF9b / SF10a follow-up - iPhone 16 Pro, same light and camera per row', font=font(22), fill=(170, 175, 185))
y = 140
for r in rows:
    title, labels = meta[r['kind']]
    d.text((G, y), title, font=font(25, True), fill=(235, 225, 200))
    for i, side in enumerate(['before', 'after', 'reference']):
        im = Image.open(f"{scratch}/{r['kind']}-{side}.png").convert('RGB').resize((CW, CH), Image.LANCZOS)
        x = G + i * (CW + G)
        board.paste(im, (x, y + 40))
        lf = font(17, True)
        d.rectangle([x, y + 40, x + 12 + int(d.textlength(labels[i], font=lf)), y + 66], fill=(0, 0, 0))
        d.text((x + 6, y + 43), labels[i], font=lf, fill=(255, 255, 255))
    a, b, pc = r['diff']['afterVsReference'], r['diff']['beforeVsReference'], r['precompile']
    d.text((G, y + 40 + CH + 8), f"after vs reference: mean {a['mean']}/255, {a['over8']}% px > 8   |   before vs reference: mean {b['mean']}/255, {b['over8']}% px > 8", font=font(18), fill=(190, 210, 190))
    d.text((G, y + 40 + CH + 34), f"precompile (after): {pc['familyJobs']} family jobs built {pc['built']} programs, {pc['firstDraw']} new at first draw", font=font(18), fill=(150, 155, 165))
    y += RH
q = 90
while True:
    board.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
    if os.path.getsize(out) <= 500_000 or q <= 40: break
    q -= 5
print(out, os.path.getsize(out), 'bytes, q', q)
`;
mkdirSync(resolvePath(OUT, '..'), { recursive: true });
execFileSync('python3', ['-c', PY, SCRATCH, OUT, JSON.stringify(rows)], { stdio: 'inherit' });
writeFileSync(resolvePath(OUT, '../evidence.json'), `${JSON.stringify({ rows, source: 'scripts/family-props-board: BEFORE = old installer clone / smooth PBR, AFTER = installDeclaredProps family variants / PBR faceted, REFERENCE = family material built directly / today\'s template terrainPainter; iPhone 16 Pro context, muted headless Chromium on Metal' }, null, 2)}\n`);
if (flag('scratch', '') === '') rmSync(SCRATCH, { recursive: true, force: true });
