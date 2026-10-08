// SHARD-PLATFORM G246 board: show each baked map look in the REAL game HUD — the round minimap and the Bag ▸ MAP screen.
// Loads the shard standalone (iPhone 16 Pro portrait, phone tier, muted), then swaps the map's terrain layer (the
// Minimap's 1000 × 1000 px / 500 m canvas, which the minimap and the full map both draw) for a baked image at draw time,
// so every real overlay stays: the POI pins ("?" / place names), the quest card, the player arrow, the rim, the zoom chips.
// The fog of war is drawn fully explored (its coverage canvas is swapped for an opaque one) so the look can be judged; the
// discovery state of the places ("?" vs names) is the real save's.
// Run: scripts/browser-lane.sh node capture.mjs --url=<served build> --shard=<slug> --maps=<dir with <slug>-A|B|C.png>
//        --out=<dir> --at=x,z,y,yawDeg [--dev=1]
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const URL0 = arg('url', 'http://127.0.0.1:4403'), SLUG = arg('shard', 'driftwood-isle'), MAPS = arg('maps', './maps'), OUT = arg('out', '.');
const [AX, AZ, AY, AYAW] = arg('at', '0,0,6,0').split(',').map(Number), DEV = arg('dev', '0') === '1';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const report = { shard: SLUG, at: [AX, AZ, AY, AYAW], shots: [], errors: [] };
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  page.on('pageerror', (e) => { report.errors.push(String(e).slice(0, 200)); });
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
  if (DEV) await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await ctx.addInitScript(() => {
    const orig = CanvasRenderingContext2D.prototype.drawImage;
    const full = document.createElement('canvas'); full.width = full.height = 250;
    const fx = full.getContext('2d'); fx.fillStyle = '#000'; fx.fillRect(0, 0, 250, 250);
    CanvasRenderingContext2D.prototype.drawImage = function patched(src, ...a) {
      const S = window.__mapSub;
      if (S && src instanceof HTMLCanvasElement && src !== S.img) {
        const k = S.img.width / 1000;
        if (src.width === 1000 && src.height === 1000) {        // the terrain layer (Minimap.layer)
          if (a.length === 8) return orig.call(this, S.img, a[0] * k, a[1] * k, a[2] * k, a[3] * k, a[4], a[5], a[6], a[7]);
          if (a.length === 4) { this.__terr = { ox: a[0], oy: a[1], side: a[2] }; return orig.call(this, S.img, a[0], a[1], a[2], a[3]); }
        }
        if (src.width === 250 && src.height === 250) return orig.call(this, full, ...a); // fog coverage → all explored
        if (src.width === 256 && src.height === 256 && this.__terr && a.length === 4) {    // the full map's sharp zoom tiles
          const t = this.__terr, s = S.img.width / t.side;
          return orig.call(this, S.img, (a[0] - t.ox) * s, (a[1] - t.oy) * s, a[2] * s, a[3] * s, a[0], a[1], a[2], a[3]);
        }
      }
      return orig.call(this, src, ...a);
    };
  });
  await page.goto(`${URL0}/?chunk=${SLUG}&tier=phone&touch=1&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world?.player !== undefined, undefined, { timeout: 300000, polling: 500 });
  await sleep(5000);
  const pose = async () => {
    await page.evaluate(([x, z, y, yaw]) => { const w = window.__wildshard.world; try { w.animals.calm = true; } catch { /* */ } const p = w.player; p.spawn(x, z, yaw, y); p.yaw = yaw; p.pitch = -0.08; }, [AX, AZ, AY, AYAW * Math.PI / 180]);
  };
  await pose(); await sleep(6000); await pose(); await sleep(1500);
  const shoot = async (name) => { const path = `${OUT}/${name}.png`; await page.screenshot({ path }); report.shots.push(path); };
  const variants = ['now', 'A', 'B', 'C'];
  for (const v of variants) {
    if (v === 'now') await page.evaluate(() => { window.__mapSub = null; });
    else {
      const b64 = readFileSync(`${MAPS}/${SLUG}-${v}.png`).toString('base64');
      await page.evaluate(async (data) => {
        const im = new Image(); im.src = `data:image/png;base64,${data}`; await im.decode();
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0);
        window.__mapSub = { img: c };
      }, b64);
    }
    await page.evaluate(([y]) => { const p = window.__wildshard.world.player; p.yaw = y; p.pitch = -0.08; }, [AYAW * Math.PI / 180]);
    await sleep(1200);
    await shoot(`${SLUG}-${v}-minimap`);
    await page.locator('.ws-minimap-canvas').click({ position: { x: 40, y: 60 } });
    await sleep(2500);
    await shoot(`${SLUG}-${v}-mapscreen`);
    const close = page.locator('.ws-gmenu-close');
    if (await close.isVisible()) await close.click(); else report.errors.push(`${v}: no close button`);
    await sleep(1200);
  }
  report.dom = await page.evaluate(() => { const r = document.querySelector('.ws-minimap')?.getBoundingClientRect(); return r ? [r.x, r.y, r.width, r.height] : null; });
  writeFileSync(`${OUT}/capture-${SLUG}.json`, `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ shots: report.shots.length, errors: report.errors, dom: report.dom }));
} finally { await browser.close(); }
