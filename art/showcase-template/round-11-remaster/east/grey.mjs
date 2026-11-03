// Grey frames for the round-11 east remaster: clean eye-height shots of the round-4 blockout, no captions or signs.
//   scripts/browser-lane.sh node art/showcase-template/round-11-remaster/east/grey.mjs [id,id...]
// Serves the repo root on a loopback port (three comes from node_modules), opens round-4-blockout/index.html muted as an
// "iPhone 16 Pro" (402 x 874 CSS px), aims window.lab.cam at each shot in shots.json, writes <id>-grey.jpg (<= 150 KB).
// A shot with "blockout": "round-5-blockout" is shot on that blockout instead; "hidden": true frames its hidden layer.
import { createServer } from 'node:http';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const scratch = process.env.SCRATCH ?? join(root, 'tmp/ks-remaster-east/raw');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const shots = JSON.parse(await readFile(process.env.SHOTS ?? join(here, 'shots.json'), 'utf8'));
const outDir = process.env.OUT ?? here;
const only = process.argv[2]?.split(',');
await mkdir(scratch, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  let loaded = '';
  for (const s of shots) {
    if (only && !only.includes(s.id)) continue;
    const blockout = s.blockout ?? 'round-4-blockout';
    if (blockout !== loaded) {
      await page.goto(`http://127.0.0.1:${port}/art/showcase-template/${blockout}/index.html`);
      await page.waitForFunction(() => window.labReady === true, null, { timeout: 120_000 });
      loaded = blockout;
    }
    const c = s.camera;
    if (c.topdown) await page.evaluate(t => window.lab.topdown(...t), c.topdown);
    else await page.evaluate(o => window.lab.cam(o), { pos: c.pos, look: c.look, fov: c.fov ?? 70, signs: false, hidden: s.hidden === true });
    const raw = join(scratch, s.id + '.png');
    await page.screenshot({ path: raw });
    const out = join(outDir, s.id + '-grey.jpg');
    for (let q = 74; ; q -= 6) {
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), '-Z', '1600', raw, '--out', out], { stdio: 'ignore' });
      const { size } = await stat(out);
      if (size <= 150_000 || q <= 38) { console.log(s.id, size, 'q' + q); break; }
    }
  }
} finally {
  await browser.close(); server.close();
}
