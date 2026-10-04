#!/usr/bin/env node
// run.mjs: SF9c's playback video and board (SHARD-PLATFORM §4 F1 SF9c, the playback half). Builds the harness (page.js,
// vite's API) into a scratch dir, serves it with the repo's public/ on one local port, opens one muted headless Chromium on
// Metal as an iPhone 16 Pro, plays every clip of the three exported skins next to today's procedural original (page.js)
// and writes:
//   progress/shard-platform/sf9c/playback.mp4   540 × 960 portrait, 30 fps, H.264 (≤ 4 MB)
//   progress/shard-platform/sf9c/board.jpg      three still pairs with their pixel difference (≤ 500 KB)
//
//   scripts/browser-lane.sh node scripts/skin-playback/run.mjs [--scratch=<dir>] [--no-video]
//
// Prints one JSON line per clip: the largest vertex gap between the two sides over the clip's first pass, and for a
// looping clip after it wraps (today's closure keeps evolving; the sampled window repeats).
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const SCRATCH = resolvePath(flag('scratch', join(tmpdir(), `skin-playback-${process.pid}`)));
const DIST = join(SCRATCH, 'dist'), FRAMES = join(SCRATCH, 'frames'), OUT = join(ROOT, 'progress/shard-platform/sf9c');
mkdirSync(FRAMES, { recursive: true }); mkdirSync(OUT, { recursive: true });

const { build } = await import('vite');
await build({
  configFile: false, root: join(ROOT, 'scripts/skin-playback'), publicDir: false, logLevel: 'warn',
  define: { __BUILD_ID__: JSON.stringify('skin-playback'), __SAVE_NAMESPACES__: JSON.stringify([]), __DEVSERVER__: 'false', 'process.cwd': '(() => "")' },
  build: { outDir: DIST, emptyOutDir: true, target: 'es2022', minify: false, reportCompressedSize: false, chunkSizeWarningLimit: 100000 },
});

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
  const file = [join(DIST, path === '/' ? 'index.html' : path), join(ROOT, 'public', path)].find((f) => (f.startsWith(DIST) || f.startsWith(join(ROOT, 'public'))) && existsSync(f) && statSync(f).isFile());
  if (file === undefined) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => { server.listen(0, '127.0.0.1', () => { resolve(undefined); }); });
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const clips = [], stills = [];
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => { errors.push(String(e)); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/index.html`);
  await page.waitForFunction(() => typeof window.skinPlayback === 'object', undefined, { timeout: 60000 });
  console.log(JSON.stringify({ init: await page.evaluate(() => window.skinPlayback.init()) }));
  const segments = await page.evaluate(() => window.skinPlayback.segments());
  const total = segments.reduce((n, s) => n + s.frames, 0);
  if (!argv.includes('--no-video')) {
    let at = 0;
    for (const s of segments) {
      let worst = 0, afterWrap = 0;
      for (let f = 0; f < s.frames; f++, at++) {
        const r = await page.evaluate((i) => window.skinPlayback.frame(i), at);
        writeFileSync(join(FRAMES, `${String(at).padStart(5, '0')}.jpg`), Buffer.from(r.jpeg.split(',')[1], 'base64'));
        // a looping clip's wrap (its end frame and the repeat after it) is where today's closure runs on past the window
        if (s.loop && r.t >= s.duration - 1e-6) afterWrap = Math.max(afterWrap, r.err); else worst = Math.max(worst, r.err);
      }
      clips.push({ ...s, worst, afterWrap });
      console.log(JSON.stringify(clips.at(-1)));
    }
    if (errors.length > 0) console.error(errors.slice(0, 5));
    const mp4 = join(OUT, 'playback.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(FRAMES, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-b:v', '700k', '-maxrate', '900k', '-bufsize', '1800k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    console.log(JSON.stringify({ video: mp4, frames: total, bytes: statSync(mp4).size }));
  }
  for (const [kind, clip, t] of [['grey-blob', 'walk', 0.5], ['boar', 'attack', 0.45], ['pine-ranger', 'idle.point', 1.5]]) {
    const r = await page.evaluate(([k, c, tt]) => window.skinPlayback.still(k, c, tt, 720), [kind, clip, t]);
    for (const side of ['today', 'exported']) writeFileSync(join(SCRATCH, `${kind}-${side}.png`), Buffer.from(r[side].split(',')[1], 'base64'));
    stills.push({ kind, clip, t, err: r.err, diff: r.diff });
    console.log(JSON.stringify(stills.at(-1)));
  }
  if (errors.length > 0) console.error(errors.slice(0, 5));
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

const PY = String.raw`
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
scratch, out, stills = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
W, P, G = 1080, 510, 20
def font(n, bold=False):
    for f in (['/System/Library/Fonts/Supplemental/Arial Bold.ttf'] if bold else []) + ['/System/Library/Fonts/Supplemental/Arial.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        try: return ImageFont.truetype(f, n)
        except OSError: pass
    return ImageFont.load_default()
names = {'grey-blob': 'Template grey blob', 'boar': 'Kit boar', 'pine-ranger': 'Pine Hollow ranger (atlas + normal map, KTX2)'}
H = 170 + len(stills) * (P + 120) + 20
board = Image.new('RGB', (W, H), (22, 24, 28)); d = ImageDraw.Draw(board)
d.text((G, 28), 'Exported skins in the client: today vs GLB', font=font(42, True), fill=(240, 240, 240))
d.text((G, 86), 'SF9c playback - same light and camera; left the procedural closure, right the exported GLB', font=font(23), fill=(170, 175, 185))
d.text((G, 118), 'through skinPlayback (GLTFLoader, bindRig, AnimMachine) and its family material binding', font=font(23), fill=(170, 175, 185))
y = 170
for s in stills:
    d.text((G, y), names[s['kind']] + '  -  ' + s['clip'] + ' at ' + str(s['t']) + ' s', font=font(27, True), fill=(235, 225, 200))
    for i, (side, label) in enumerate([('today', 'TODAY'), ('exported', 'EXPORTED')]):
        im = Image.open(f"{scratch}/{s['kind']}-{side}.png").convert('RGB').resize((P, P), Image.LANCZOS)
        x = G + i * (P + G); board.paste(im, (x, y + 40))
        d.rectangle([x, y + 40, x + 16 + int(d.textlength(label, font=font(22, True))), y + 74], fill=(0, 0, 0))
        d.text((x + 8, y + 44), label, font=font(22, True), fill=(255, 255, 255))
    df = s['diff']; gap = '< 0.1 mm' if s['err'] < 1e-4 else f"{s['err'] * 1000:.2f} mm"
    d.text((G, y + 40 + P + 10), f"pixels: mean {df['mean']} / 255, max {df['max']}, {df['over8']}% of channels > 8   -   max vertex gap {gap}", font=font(21), fill=(190, 210, 190))
    y += P + 120
q = 90
while True:
    board.save(out, 'JPEG', quality=q, optimize=True, progressive=True)
    if os.path.getsize(out) <= 500_000 or q <= 40: break
    q -= 5
print(out, os.path.getsize(out), 'bytes, q', q)
`;
execFileSync('python3', ['-c', PY, SCRATCH, join(OUT, 'board.jpg'), JSON.stringify(stills)], { stdio: 'inherit' });
writeFileSync(join(OUT, 'playback.json'), `${JSON.stringify({ clips, stills }, null, 1)}\n`);
if (flag('scratch', '') === '') rmSync(SCRATCH, { recursive: true, force: true });
