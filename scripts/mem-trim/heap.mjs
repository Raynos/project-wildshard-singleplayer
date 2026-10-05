// mem-trim (G144): Driftwood's playable JS memory with a Driftwood reload row OFF vs ON, one served build, desktop Chromium
// (Metal), iPhone 16 Pro portrait, muted. ArrayBuffer backing stores (CDP Runtime.getHeapUsage after a GC), V8 heap,
// the scene's geometry array bytes still on the CPU and renderer.info.memory.
//   scripts/browser-lane.sh node scripts/mem-trim/heap.mjs --url=http://127.0.0.1:PORT --row=<driftwood row> [--hybrid=on]
// It also reads the island group's GPU vertex bytes and renderer.info. G173 (E450): the GPU-only copies and the island
// instancing are always on now (their rows are gone), so --row names whichever Driftwood reload row is being measured.
const R = new URL('../..', import.meta.url).pathname.replace(/\/$/u, '');
const { chromium, devices } = await import(`${R}/node_modules/playwright/index.mjs`);
const { saveFixtureCode } = await import(`${R}/scripts/debug-settings.mjs`);
const flag = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ROW = flag('row', '');
if (ROW === '') throw new Error('--row=<driftwood reload row> is required (G173 retired the GPU-only and instancing rows)');
const URL_BASE = flag('url', ''), HYBRID = flag('hybrid', 'off'), TIER = flag('tier', 'phone'), REV = flag('rev', 'unknown');
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const out = {};
try {
  for (const row of ['off', 'on', 'off', 'on']) {
    const phone = TIER === 'phone';
    const ctx = await browser.newContext(phone ? { ...devices['iPhone 16 Pro'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 } : { viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(saveFixtureCode({ scope: 'device', key: `debug.plugin.driftwood-isle.${ROW}`, data: row }));
    if (HYBRID === 'on') await page.addInitScript(saveFixtureCode({ scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodHybrid', data: 'on' }));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Runtime.enable');
    await page.goto(`${URL_BASE}/?chunk=driftwood-isle&skipintro=1&nolock=1&mute=1${phone ? '&touch=1&tier=phone' : '&tier=desktop'}`, { waitUntil: 'commit', timeout: 180_000 });
    await page.waitForFunction(() => Boolean(window.__wildshard?.world) && !document.querySelector('.ws-load'), null, { timeout: 240_000, polling: 200 });
    // a full turn on the spot so every tile in reach uploads (the boot's warm turns cover most of it)
    await page.evaluate(async () => { const p = window.__wildshard.world.player; for (let k = 0; k < 8; k++) { p.yaw = (p.yaw ?? 0) + Math.PI / 4; await new Promise((resolve) => { requestAnimationFrame(() => { requestAnimationFrame(resolve); }); }); } });
    await sleep(6000);
    await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); await sleep(500);
    const h = await cdp.send('Runtime.getHeapUsage');
    const scene = await page.evaluate(() => {
      const game = window.__wildshard.world.game; let arrays = 0, gpuOnly = 0;
      const seen = new Set();
      game.scene.traverse((o) => { const g = o.geometry; if (!g || seen.has(g)) return; seen.add(g);
        for (const a of Object.values(g.attributes)) { arrays += a.array?.byteLength ?? 0; if (a.array?.length === 0 && a.count > 0) gpuOnly += a.count * a.itemSize * 4; }
        arrays += g.index?.array?.byteLength ?? 0; });
      // the Blender island's vertex + index + instance bytes as uploaded (count × item size: a released array counts too)
      let islandGpu = 0; const island = game.scene.children.find((o) => o.name === 'blender-island'); const seenI = new Set();
      const bytes = (a) => (a ? a.count * a.itemSize * (a.array?.BYTES_PER_ELEMENT ?? 4) : 0);
      island?.traverse((o) => { const g = o.geometry; if (!g || seenI.has(g)) return; seenI.add(g);
        for (const a of Object.values(g.attributes)) islandGpu += bytes(a); islandGpu += bytes(g.index); if (o.isInstancedMesh) islandGpu += bytes(o.instanceMatrix); });
      const m = game.renderer.info.memory, ri = game.renderer.info.render;
      return { islandGpuMB: islandGpu / 2 ** 20, islandMeshes: island?.children.length ?? 0, calls: ri.calls, triangles: ri.triangles, sceneArraysMB: arrays / 2 ** 20, releasedApproxMB: gpuOnly / 2 ** 20, geometries: m.geometries, textures: m.textures, version: document.querySelector('meta[name=version]')?.content ?? null };
    });
    const r = { row, heapMB: h.usedSize / 2 ** 20, arrayBuffersMB: (h.backingStorageSize ?? 0) / 2 ** 20, ...scene };
    console.log(JSON.stringify(r));
    (out[row] ??= []).push(r);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log('SUMMARY', JSON.stringify(out));
const { mkdirSync, writeFileSync } = await import('node:fs');
mkdirSync(`${R}/progress/shard-platform/mem-trim`, { recursive: true });
const mean = (rows, key) => rows.reduce((a, r) => a + r[key], 0) / rows.length;
const file = `${R}/progress/shard-platform/mem-trim/heap-${REV}-${TIER}-${ROW}${HYBRID === 'on' ? '-hybrid' : ''}.json`;
writeFileSync(file, `${JSON.stringify({ rev: REV, tier: TIER, hybrid: HYBRID, when: new Date().toISOString(),
  method: 'Desktop Chromium (Metal), iPhone 16 Pro portrait, muted; playable + a full turn + 6 s, forced GC, CDP Runtime.getHeapUsage (usedSize, backingStorageSize = ArrayBuffers); scene geometry arrays still on the CPU; renderer.info.memory. Row off / on alternated twice.',
  means: Object.fromEntries(Object.entries(out).map(([row, rows]) => [row, { heapMB: mean(rows, 'heapMB'), arrayBuffersMB: mean(rows, 'arrayBuffersMB'), sceneArraysMB: mean(rows, 'sceneArraysMB'), islandGpuMB: mean(rows, 'islandGpuMB'), calls: mean(rows, 'calls'), triangles: mean(rows, 'triangles') }])), runs: out }, null, 2)}\n`);
console.log(`Wrote ${file}`);
