#!/usr/bin/env node
// run.mjs: SF59 step 1, the TSL spike (SHARD-PLATFORM SF59, G156). Builds the bench page (spike.js, vite's API) into a
// scratch dir, serves it on one local port and opens it once per variant, then writes
// progress/shard-platform/sf59/tsl-spike-<surface>.json (+ the parity diffs and a portrait contact sheet).
//
//   scripts/browser-lane.sh node scripts/tsl-spike/run.mjs                 desktop: one muted headless Chromium on Metal,
//                                                                          the "iPhone 16 Pro" descriptor, render scale 2×
//   scripts/sim-lane.sh run --max 20 frame-floor-iphone-17-pro node scripts/tsl-spike/run.mjs --surface=sim
//                                                                          the iOS Simulator's Safari (the page POSTs back)
//   node scripts/tsl-spike/run.mjs --bundle                                tree-shaken production bytes the TSL path adds
//
// Variants: family · tsl · tsl-raw · tsl-post · tsl-sway · plain · tsl-plain · tsl-pcf · family-csm · tsl-csm ·
// family-fade · tsl-fade · graph · family-roles · graph-roles · family-labels · graph-labels · family-emit · graph-emit ·
// family-tube · graph-tube · family-sf · graph-sf (spike.js's header says what each
// draws). SF59 step 2: the TSL variants run the engine's back-end (src/engine/render/nodes/).
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { extname, join, resolve as resolvePath } from 'node:path';
import { gzipSync } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = resolvePath(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const SURFACE = flag('surface', 'desktop');
const VARIANTS = flag('variants', 'family,tsl,tsl-raw,tsl-post,tsl-sway,plain,tsl-plain,tsl-pcf,family-csm,tsl-csm,family-fade,tsl-fade,graph,family-roles,graph-roles,family-labels,graph-labels,family-emit,graph-emit,family-tube,graph-tube,family-sf,graph-sf').split(',');
const SCRATCH = resolvePath(flag('scratch', `/private/tmp/claude-501/sp-builders/sf59-tsl/run-${process.pid}`));
const OUT_DIR = join(ROOT, 'progress/shard-platform/sf59');
const TAG = flag('tag', ''); // --tag=graph writes tsl-spike-<surface>-graph.{json,jpg}, beside the spike's own results
mkdirSync(SCRATCH, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });
const { build } = await import('vite');

if (argv.includes('--bundle')) {
  // the bytes a production build adds: the same minified, tree-shaken vite build of three entries
  const entries = {
    base: "import { WebGLRenderer, MeshStandardMaterial, InstancedMesh, BoxGeometry, Scene } from 'three';\nconst r = new WebGLRenderer(); const s = new Scene(); s.add(new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 9)); r.render(s, null);",
    spike: "import { WebGLRenderer, MeshStandardMaterial, InstancedMesh, BoxGeometry, Scene } from 'three';\nimport { WebGLNodesHandler } from 'three/examples/jsm/tsl/WebGLNodesHandler.js';\nimport { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';\nimport { Fn, float, vec2, vec3, vec4, uniform, reference, positionLocal, positionWorld, normalWorldGeometry, cameraPosition, uv, fwidth, abs, fract, floor, smoothstep, max, min, mix, exp, clamp, pow, dot, length, select, sin, time, instanceIndex, texture, luminance, workingToColorSpace, hash } from 'three/tsl';\nconst r = new WebGLRenderer(); r.setNodesHandler(new WebGLNodesHandler()); const s = new Scene(); const m = new MeshStandardNodeMaterial(); m.colorNode = mix(vec3(1), vec3(fwidth(uv()), 0), smoothstep(0, 1, length(positionWorld.sub(cameraPosition)))); s.add(new InstancedMesh(new BoxGeometry(), m, 9), new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 9)); globalThis.k = [Fn, float, vec2, vec4, uniform, reference, positionLocal, normalWorldGeometry, abs, fract, floor, max, min, exp, clamp, pow, dot, select, sin, time, instanceIndex, texture, luminance, workingToColorSpace, hash, MeshBasicNodeMaterial]; r.render(s, null);",
    full: "import { WebGLRenderer, MeshStandardMaterial, InstancedMesh, BoxGeometry, Scene } from 'three';\nimport { WebGLNodesHandler } from 'three/examples/jsm/tsl/WebGLNodesHandler.js';\nimport * as WEBGPU from 'three/webgpu';\nimport * as TSL from 'three/tsl';\nconst r = new WebGLRenderer(); r.setNodesHandler(new WebGLNodesHandler()); const s = new Scene(); s.add(new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 9)); globalThis.k = [WEBGPU, TSL]; r.render(s, null);",
  };
  // the entries live in the scratch dir, outside the repo: give it the one package they import (three), by its own link
  mkdirSync(join(SCRATCH, 'node_modules'), { recursive: true });
  symlinkSync(join(ROOT, 'node_modules/three'), join(SCRATCH, 'node_modules/three'));
  const sizes = {};
  for (const [name, code] of Object.entries(entries)) {
    const dir = join(SCRATCH, `bundle-${name}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'entry.js'), code);
    writeFileSync(join(dir, 'index.html'), '<!doctype html><script type="module" src="./entry.js"></script>');
    await build({ configFile: false, root: dir, publicDir: false, logLevel: 'warn', build: { outDir: join(dir, 'dist'), emptyOutDir: true, target: 'es2022', minify: true, reportCompressedSize: false, chunkSizeWarningLimit: 100000 } });
    const js = execFileSync('find', [join(dir, 'dist'), '-name', '*.js'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const buf = Buffer.concat(js.map((f) => readFileSync(f)));
    sizes[name] = { minBytes: buf.length, gzipBytes: gzipSync(buf).length };
  }
  const result = { sizes, spikeAdds: { minBytes: sizes.spike.minBytes - sizes.base.minBytes, gzipBytes: sizes.spike.gzipBytes - sizes.base.gzipBytes }, fullTslAdds: { minBytes: sizes.full.minBytes - sizes.base.minBytes, gzipBytes: sizes.full.gzipBytes - sizes.base.gzipBytes } };
  writeFileSync(join(OUT_DIR, 'tsl-spike-bundle.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
  rmSync(SCRATCH, { recursive: true, force: true });
  process.exit(0);
}

const DIST = join(SCRATCH, 'dist');
await build({
  configFile: false, root: join(ROOT, 'scripts/tsl-spike'), publicDir: false, logLevel: 'warn',
  define: { __BUILD_ID__: JSON.stringify('tsl-spike'), __SAVE_NAMESPACES__: JSON.stringify([]), __DEVSERVER__: 'false' },
  build: { outDir: DIST, emptyOutDir: true, target: 'es2022', minify: true, reportCompressedSize: false, chunkSizeWarningLimit: 100000 },
});

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const results = new Map();
const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/result') {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => { try { const r = JSON.parse(body); results.set(r.variant, r); } catch { /* ignore */ } res.writeHead(204); res.end(); });
    return;
  }
  const path = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
  const file = join(DIST, path === '/' ? 'index.html' : path);
  if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => { server.listen(0, '127.0.0.1', () => { resolve(undefined); }); });
const address = server.address();
const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

async function waitFor(variant, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (results.has(variant)) return results.get(variant); await sleep(250); }
  return { variant, failed: 'timed out' };
}

try {
  if (SURFACE === 'desktop') {
    const { chromium, devices } = await import('playwright');
    const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
    try {
      for (const v of ['warmup', ...VARIANTS]) {
        const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] });
        const page = await ctx.newPage();
        await page.goto(`${base}/index.html#${v}`);
        await page.waitForFunction(() => window.tslSpikeResult !== undefined, undefined, { timeout: 120000 });
        results.set(v, await page.evaluate(() => window.tslSpikeResult));
        await ctx.close();
      }
    } finally { await browser.close(); }
  } else {
    const udid = process.env.SIM_UDID;
    if (!udid) throw new Error('--surface=sim must run inside scripts/sim-lane.sh run');
    const xcrun = (tail) => execFileSync('xcrun', ['simctl', ...tail], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    for (const v of ['warmup', ...VARIANTS]) {
      try { xcrun(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* not running */ }
      await sleep(1000);
      xcrun(['openurl', udid, `${base}/index.html#${v}`]);
      await waitFor(v, 180000);
    }
    try { xcrun(['terminate', udid, 'com.apple.mobilesafari']); } catch { /* not running */ }
  }
} finally { server.close(); }

// shots → scratch PNGs; parity diffs and a contact sheet (PIL)
const rows = [];
for (const v of VARIANTS) {
  const r = results.get(v) ?? { variant: v, failed: 'no result' };
  if (typeof r.shot === 'string') { writeFileSync(join(SCRATCH, `${v}.png`), Buffer.from(r.shot.split(',')[1], 'base64')); delete r.shot; }
  rows.push(r);
}
const PY = String.raw`
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
scratch, out_json, out_jpg, surface = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
rows = json.load(open(out_json))
have = {r['variant']: f'{scratch}/{r["variant"]}.png' for r in rows if os.path.exists(f'{scratch}/{r["variant"]}.png')}
def diff(a, b):
    A = np.asarray(Image.open(have[a]).convert('RGB')).astype(np.int16); B = np.asarray(Image.open(have[b]).convert('RGB')).astype(np.int16)
    d = np.abs(A - B); px = d.max(axis=2); mse = float((d.astype(np.float64) ** 2).mean())
    return {'pair': f'{a} vs {b}', 'mean': round(float(d.mean()), 3), 'max': int(d.max()), 'over8pct': round(float((px > 8).mean() * 100), 2), 'psnr': None if mse == 0 else round(10 * np.log10(255 * 255 / mse), 1)}
pairs = [p for p in [('family', 'tsl'), ('family', 'tsl-raw'), ('tsl', 'tsl-post'), ('family', 'tsl-post'), ('plain', 'tsl-plain'), ('family', 'tsl-pcf'), ('family-csm', 'tsl-csm'), ('family-fade', 'tsl-fade'), ('family-csm', 'family-fade'), ('family', 'graph'), ('tsl', 'graph'), ('family-roles', 'graph-roles'), ('family', 'family-roles'), ('family-labels', 'graph-labels'), ('family-roles', 'family-labels'), ('family-emit', 'graph-emit'), ('family-tube', 'graph-tube'), ('family-sf', 'graph-sf')] if p[0] in have and p[1] in have]
parity = [diff(a, b) for a, b in pairs]
json.dump({'surface': surface, 'parity': parity, 'rows': rows}, open(out_json, 'w'), indent=2)
def font(n):
    for f in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        try: return ImageFont.truetype(f, n)
        except OSError: pass
    return ImageFont.load_default()
names = [r['variant'] for r in rows if r['variant'] in have]
if names:
    tw = 380; ims = [Image.open(have[n]).convert('RGB') for n in names]; th = int(ims[0].height * tw / ims[0].width)
    sheet = Image.new('RGB', (tw * len(ims) + 10 * (len(ims) + 1), th + 70), (20, 22, 26)); d = ImageDraw.Draw(sheet)
    for i, (n, im) in enumerate(zip(names, ims)):
        x = 10 + i * (tw + 10); sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, 60)); d.text((x, 18), n, font=font(26), fill=(240, 240, 240))
    sheet.save(out_jpg, 'JPEG', quality=80, optimize=True)
print(json.dumps(parity))
`;
const outJson = join(OUT_DIR, `tsl-spike-${SURFACE}${TAG ? `-${TAG}` : ''}.json`);
writeFileSync(outJson, JSON.stringify(rows));
execFileSync('python3', ['-c', PY, SCRATCH, outJson, join(OUT_DIR, `tsl-spike-${SURFACE}${TAG ? `-${TAG}` : ''}.jpg`), SURFACE], { stdio: 'inherit' });
for (const r of rows) console.log(JSON.stringify({ variant: r.variant, failed: r.failed, engineRenders: r.engineRenders, threeFrame: r.threeFrame, nodeBuilds: r.nodeBuilds, fps: r.fps, rafMs: r.rafMs, workMs: r.workMs, syncedMs: r.syncedMs, stallMs: r.stallMs, nodeBuildMs: r.nodeBuildMs, programs: r.programs, errors: r.errors?.slice(0, 3) }));
if (flag('scratch', '') === '') rmSync(SCRATCH, { recursive: true, force: true });
