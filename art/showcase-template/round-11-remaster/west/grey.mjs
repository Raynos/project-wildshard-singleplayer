// Grey inputs for the round-11 remaster (west + map shots): one clean frame of the round-4 blockout per shot.
//   scripts/browser-lane.sh node art/showcase-template/round-11-remaster/west/grey.mjs [id,id...]
// Serves the repo root on a loopback port, opens round-4-blockout/index.html muted as an "iPhone 16 Pro", and for each
// shot in shots.json calls lab.cam({pos, look, fov}) or lab.topdown(x0, x1, z0, z1). The viewport is 402 x 603 CSS px
// (2:3 portrait): image_gen edits come back 1024 x 1536, so a 2:3 input keeps every block where the blockout put it.
// Writes <id>-grey.jpg here (<= 150 KB) and tmp/ks-remaster-west/in/<id>.jpg (the codex input, ~1200 px wide).
import { createServer } from 'node:http';
import { readFile, mkdir, stat, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const scratch = join(root, 'tmp/ks-remaster-west');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const shots = JSON.parse(await readFile(join(here, 'shots.json'), 'utf8')).shots;
const only = process.argv[2]?.split(',');
await mkdir(join(scratch, 'raw'), { recursive: true }); await mkdir(join(scratch, 'in'), { recursive: true });
const jpeg = async (src, out, edge, q, cap) => {
  for (;;) {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), '-Z', String(edge), src, '--out', out], { stdio: 'ignore' });
    const { size } = await stat(out);
    if (size <= cap || q <= 30) return [size, q];
    q -= 6;
  }
};
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 603 } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${port}/art/showcase-template/round-4-blockout/index.html`);
  await page.waitForFunction(() => window.labReady === true, null, { timeout: 120_000 });
  for (const s of shots) {
    if (only && !only.includes(s.id)) continue;
    const c = s.camera;
    if (c.topdown) await page.evaluate(t => window.lab.topdown(...t), c.topdown);
    else await page.evaluate(o => window.lab.cam(o), { pos: c.pos, look: c.look, fov: c.fov ?? 70, signs: false });
    const raw = join(scratch, 'raw', s.id + '.png');
    await page.screenshot({ path: raw });
    const g = await jpeg(raw, join(here, s.id + '-grey.jpg'), 1100, 72, 150_000);
    const i = await jpeg(raw, join(scratch, 'in', s.id + '.jpg'), 1206, 86, 420_000);
    console.log(s.id, 'grey', g.join(' q'), 'in', i.join(' q'));
  }
} finally {
  await browser.close(); server.close();
  await rm(join(scratch, 'raw'), { recursive: true, force: true });
}
