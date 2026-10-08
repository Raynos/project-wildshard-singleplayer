// SF63 gaps (SHARD-PLATFORM, E435): the post chain a boot runs, as data: every composer pass and its effects (name, blend
// opacity) plus the knobs that differ between chains (bloom intensity / threshold / smoothing, vignette darkness, rays).
// scripts/browser-lane.sh node progress/shard-platform/sf63-gaps/probe.mjs <preview url> <grid | Card name>
import { chromium, devices } from 'playwright';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
const [base, mode = 'grid'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext(devices['iPhone 16 Pro']);
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(() => { window.__wildshardHarness = { seed: 357, capture: null }; });
  const page = await context.newPage();
  await page.goto(`${base}/?tier=phone&mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 300_000 });
  if (mode === 'grid') {
    await page.locator('.ws-main-grid').click({ timeout: 300_000 });
    await page.waitForFunction(() => window.__wildshard?.shard?.grid?.state().live?.live && !document.querySelector('.ws-load'), null, { timeout: 300_000 });
  } else {
    await page.waitForSelector('.ws-main-select', { timeout: 300_000 }); await page.locator('.ws-main-select').click();
    await page.evaluate(name => { const card = [...document.querySelectorAll('.ws-menu-card')].find(e => e.querySelector('b')?.textContent === name); if (!card) throw new Error('Missing shard card'); document.querySelector(`.ws-menu-dots i[data-i="${card.dataset.i}"]`)?.click(); }, mode);
    await page.locator('.ws-menu-play').click();
    await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game) && !document.querySelector('.ws-load'), undefined, { timeout: 300_000 });
  }
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const g = window.__wildshard.world.game, r4 = n => (typeof n === 'number' ? Math.round(n * 1e4) / 1e4 : n);
    const knob = e => {
      if (e.name === 'BloomEffect') return { intensity: r4(e.intensity), threshold: r4(e.luminanceMaterial?.threshold), smoothing: r4(e.luminanceMaterial?.smoothing) };
      if (e.name === 'VignetteEffect') return { darkness: r4(e.darkness), offset: r4(e.offset) };
      if (e.name === 'VolumetricsEffect') return { strength: r4(e.marchUniforms?.uStrength?.value) };
      return undefined;
    };
    const passes = g.composer.passes.map(p => ({ name: p.name, effects: (p.effects ?? []).map(e => ({ name: e.name, opacity: r4(e.blendMode?.opacity?.value), knob: knob(e) })) }));
    return { level: g.level?.id, passes };
  });
  console.log(JSON.stringify(r));
} finally { await browser.close(); }
