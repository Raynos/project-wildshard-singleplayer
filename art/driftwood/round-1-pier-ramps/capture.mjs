// capture.mjs <base> <out dir> (through scripts/browser-lane.sh, a served build): Driftwood's four sea ramps from the
// road, iPhone 16 Pro portrait, muted, once per Debug pick (pause ▸ Settings ▸ Debug ▸ Driftwood pier ramps: straight =
// before, flared = after). The player stands on each entry's asphalt socket 6 m in from the cell edge, facing in, so the
// follow camera looks up the landing and the ramp; each shot is written as <pick>-<edge>.png (the README's JPEGs are
// converted from them).
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';

const BASE = process.argv[2], OUT = process.argv[3];
if (!BASE || !OUT) throw new Error('usage: capture.mjs <base> <out dir>');
const EDGES = [
  { edge: 'south', x: 0, z: -244, yaw: Math.PI },
  { edge: 'north', x: 0, z: 244, yaw: 0 },
  { edge: 'east', x: 244, z: 0, yaw: Math.PI / 2 },
  { edge: 'west', x: -244, z: 0, yaw: -Math.PI / 2 },
];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const report = {};
try {
  for (const pick of ['straight', 'flared']) {
    const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage(), errors = [];
    await saveFixture(ctx, { scope: 'device', key: 'debug.plugin.driftwood-isle.pierRamps', data: pick });
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`${BASE}/?chunk=driftwood-isle&tier=phone&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world !== undefined, null, { timeout: 240000, polling: 250 });
    await page.evaluate(() => { window.__wildshard.world.hud.enterNow?.(); });
    await page.waitForTimeout(2500);
    const floors = [];
    for (const shot of EDGES) {
      await page.evaluate(({ x, z, yaw }) => {
        const w = window.__wildshard.world;
        for (const a of w.animals.animals) a.harnessHold = true;
        w.player.spawn(x, z, yaw);
      }, shot);
      await page.waitForTimeout(2500);
      // the deck's floor 6 m across at the ramp's foot (15.5 m in) and half way up (19.5 m in): flared reads a floor at
      // ±3.5 m, straight none past the deck's edge
      floors.push(await page.evaluate(({ edge }) => {
        const shard = window.__wildshard.shard, objs = shard['harness.shard.driftwood-isle'] ?? shard.driftwood?.objects ?? null;
        const decks = objs ? [objs.pier, ...objs.jetties] : [];
        const at = (a, c) => edge === 'south' ? [c, -250 + a] : edge === 'north' ? [c, 250 - a] : edge === 'east' ? [250 - a, c] : [-250 + a, c];
        const read = (a, c) => { for (const d of decks) { const y = d?.floorHeightAt(...at(a, c)); if (y !== undefined) return +y.toFixed(3); } return null; };
        return { edge, foot: [-3.5, 0, 3.5].map((c) => read(15.5, c)), mid: [-2.5, 0, 2.5].map((c) => read(19.5, c)) };
      }, shot));
      await page.screenshot({ path: `${OUT}/${pick}-${shot.edge}.png` });
    }
    report[pick] = { floors, errors };
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(report, null, 1));
