// G226 neutral-look: boot each hybrid home (Driftwood, Pine Hollow, Nalati) as a Developer-ON owned-shell grid page and
// count shader compile failures. Per home: the title's one-shot grid intent, Developer on, iPhone 16 Pro portrait, muted;
// wait for the live grid, force-compile the whole root scene (`renderer.compile`, so off-screen materials count too), then
// read every live program's diagnostics and every console error, and take two portrait frames.
// scripts/browser-lane.sh node progress/shard-platform/g226/neutral-look/neutral-look.mjs --url=<served build> --out=<dir> [--slugs=a,b]
import { mkdirSync, writeFileSync } from 'node:fs';
const ROOT = new URL('../../../..', import.meta.url).pathname.replace(/\/$/u, '');
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const flag = (n, d) => process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = flag('url', ''), OUT = flag('out', '.');
const SLUGS = flag('slugs', 'driftwood-isle,pine-hollow,nalati-grasslands').split(',');
mkdirSync(OUT, { recursive: true });
// one open view per home besides its spawn (Driftwood: the parity 'beach' pose, the sea and the island in one frame)
const POSES = { 'driftwood-isle': { x: -10, z: -150, yaw: 4.3, pitch: -0.04 } };
const shaderError = (text) => /Shader Error|ERROR: \d+:\d+|VALIDATE_STATUS false|Program Info Log|undeclared identifier/u.test(text);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
try {
  for (const slug of SLUGS) {
    const r = { slug, console: [], pageErrors: [], shaderErrors: [], programs: null, failedPrograms: [], shell: null, shots: [] };
    const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
    page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || shaderError(t)) { r.console.push(t.slice(0, 600)); if (shaderError(t)) r.shaderErrors.push(t.slice(0, 1200)); } });
    page.on('pageerror', (e) => { r.pageErrors.push(e.message.slice(0, 400)); });
    await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
    await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
    await ctx.addInitScript((s) => {
      if (sessionStorage.getItem('g226.intent')) return; sessionStorage.setItem('g226.intent', '1');
      const key = 'wildshard.save.v2.device', doc = JSON.parse(localStorage.getItem(key) ?? '{"keys":{}}'); doc.keys ??= {};
      doc.keys['gridIntent.once'] = { v: 1, data: { instance: s, slug: s, at: Date.now() } };
      doc.keys['titleArrival.once'] = { v: 1, data: { slug: s, mode: 'enter', at: Date.now() } };
      localStorage.setItem(key, JSON.stringify(doc));
    }, slug);
    const t0 = Date.now();
    await page.goto(`${BASE}/?chunk=${slug}&tier=phone&mute=1&nolock=1&sw=0&skipintro=1`, { waitUntil: 'commit', timeout: 300000 });
    try {
      await page.waitForFunction(() => Boolean(window.__wildshard?.shard?.grid?.state?.().live?.live) && !document.querySelector('.ws-load'), null, { timeout: 240000, polling: 250 });
    } catch (error) {
      r.notLive = await page.evaluate(() => JSON.stringify({ href: location.href, load: Boolean(document.querySelector('.ws-load')), state: window.__wildshard?.shard?.grid?.state?.() ?? null }).slice(0, 1500));
      console.log(slug, 'not live:', r.notLive, String(error).slice(0, 200));
    }
    r.bootSeconds = Math.round((Date.now() - t0) / 100) / 10;
    await page.evaluate(() => { window.__wildshard?.world?.hud?.enterNow?.(); }).catch(() => undefined);
    await page.waitForTimeout(6000);
    r.shell = await page.evaluate(() => {
      const w = window.__wildshard?.world, s = window.__wildshard?.shard?.grid?.state?.();
      return { level: w?.game?.level?.id ?? null, home: s?.home ?? null, live: s?.live?.live?.current ?? null, cells: (s?.cells ?? []).map((c) => `${c.slug}@${c.cell.join(',')}`) };
    }).catch((e) => ({ error: String(e) }));
    for (const name of ['spawn', 'look-out', ...(POSES[slug] === undefined ? [] : ['pose'])]) {
      if (name === 'look-out') await page.evaluate(() => { const p = window.__wildshard.world.player; p.yaw += Math.PI; p.pitch = -0.08; }).catch(() => undefined);
      if (name === 'pose') await page.evaluate((q) => { const p = window.__wildshard.world.player; p.spawn(q.x, q.z, q.yaw); p.pitch = q.pitch; p.velocity.set(0, 0, 0); }, POSES[slug]).catch(() => undefined);
      await page.waitForTimeout(2500);
      const file = `${OUT}/${slug}-${name}.jpg`;
      await page.screenshot({ path: file, type: 'jpeg', quality: 78 });
      r.shots.push(file.slice(ROOT.length + 1));
    }
    // every material in the page's root scene compiles now, seen or not; then each program's own diagnostics
    const probe = await page.evaluate(() => {
      const g = window.__wildshard?.world?.game; if (g === undefined) return { error: 'no game' };
      const renderer = g.renderer, scene = g.rootScene ?? g.scene, camera = g.viewCamera ?? g.camera;
      renderer.debug.checkShaderErrors = true;
      let compileError = null;
      try { renderer.compile(scene, camera); } catch (e) { compileError = String(e).slice(0, 300); }
      const programs = renderer.info.programs ?? [];
      const failed = programs.filter((p) => p.diagnostics !== undefined && p.diagnostics.runnable === false)
        .map((p) => ({ name: p.name, log: `${p.diagnostics.programLog} ${p.diagnostics.fragmentShader?.log ?? ''} ${p.diagnostics.vertexShader?.log ?? ''}`.slice(0, 600) }));
      return { programs: programs.length, failed, compileError };
    }).catch((e) => ({ error: String(e) }));
    await page.waitForTimeout(1500);
    r.programs = probe.programs ?? null; r.failedPrograms = probe.failed ?? []; r.compileError = probe.compileError ?? probe.error ?? null;
    console.log(`${slug}: live ${JSON.stringify(r.shell)} boot ${r.bootSeconds}s programs ${r.programs} failed ${r.failedPrograms.length} shaderErrors ${r.shaderErrors.length} consoleErrors ${r.console.length} pageErrors ${r.pageErrors.length}`);
    for (const e of r.shaderErrors.slice(0, 3)) console.log('  shader:', e.slice(0, 400));
    for (const e of r.failedPrograms.slice(0, 3)) console.log('  failed:', e.name, e.log.slice(0, 300));
    results.push(r);
    await ctx.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${OUT}/neutral-look.json`, `${JSON.stringify({ base: BASE, results }, null, 1)}\n`);
}
