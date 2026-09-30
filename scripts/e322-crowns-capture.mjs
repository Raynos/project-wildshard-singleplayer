#!/usr/bin/env node
// e322-crowns-capture.mjs — E322 F-L3's evidence: Pine Hollow's tree crowns seen from above (the fire lookout's deck, a
// god view over the Hollow) and from the forest floor, in the real build, iPhone 16 Pro portrait (touch, phone tier,
// muted, Metal). One page: each view is posed, the game's loop is paused, and the frozen frame is drawn by hand so every
// variant of a view is the same frame (same wind, same LOD). Per view and variant it writes a screenshot and measures the
// crowns' luminance: the tree pixels are the ones that change when the forest's materials are hidden (the far impostors
// on their own, and every tree part), their mean Rec.709 luma (0–1, on the displayed sRGB) and the share below 0.08
// ("near-black"). The ground view's mid-frame band (35–65 % of the height) is the mid-crown reference.
//
//   scripts/browser-lane.sh --max 20 node scripts/e322-crowns-capture.mjs --url=http://127.0.0.1:4400 --out=<dir> [--diag]
//
// Variants: A = today, B = the fix (the factory's `crownTop` uniform, which the Debug row "Crowns from above" drives).
// --diag adds today's culprits one at a time on the impostors / cards: no normal map, no shadow receipt, no vertex colour.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

const { chromium, devices } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const OUT = resolvePath(flag('out', 'progress/e322-crowns'));
const DIAG = argv.includes('--diag');
/** --sweep: B at a softer and two stronger tunings beside the shipped one */
const SWEEP = argv.includes('--sweep');
mkdirSync(OUT, { recursive: true });

// cameras: eye position + look-at, both in world metres; `dy` is metres above the ground under the point
const LOOKOUT = { x: 36, z: 214 };
const VIEWS = [
  // the lookout's deck (11 m over its pad), standing at the south rail looking down the zipline over the Hollow
  { id: 'lookout', eye: { x: LOOKOUT.x - 0.5, z: LOOKOUT.z - 2.9, dy: 11 + 1.65, over: LOOKOUT }, at: { x: 20, z: 120, dy: 0 } },
  // the same deck, looking steeper down onto the crowns at the crag's foot
  { id: 'lookout-down', eye: { x: LOOKOUT.x - 0.5, z: LOOKOUT.z - 2.9, dy: 11 + 1.65, over: LOOKOUT }, at: { x: 28, z: 168, dy: 0 } },
  // a god view: 90 m over the Hollow's grove, looking steeply down
  { id: 'god', eye: { x: 10, z: 95, dy: 90 }, at: { x: 8, z: 25, dy: 0 } },
  // the forest floor: inside the King's standing stones looking W into the old-growth, and in the old-growth looking N
  { id: 'ground', eye: { x: 140, z: -30, dy: 1.65 }, at: { x: 100, z: -30, dy: 7 } },
  { id: 'ground-2', eye: { x: 118, z: -118, dy: 1.65 }, at: { x: 135.6, z: -82, dy: 7 } },
];

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const url = `${URL_BASE}/?chunk=pine-hollow&touch=1&tier=phone&mute=1&nolock=1&skipintro=1&sw=0&tod=day&clock=1e6&weather=clear&x=6&z=4`;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const summary = { url, build: null, views: {} };
try {
  const { defaultBrowserType: _b, ...iphone } = devices['iPhone 16 Pro'];
  const ctx = await browser.newContext(iphone);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.text().startsWith('[diag]')) console.log(m.text()); });
  page.on('pageerror', (e) => { console.log('[pageerror]', e.message.slice(0, 200)); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  summary.build = await (await fetch(`${URL_BASE}/version.json`)).json();
  await page.waitForFunction(() => Boolean(window.__world?.player && window.__world?.forest?.factory) && window.__world?.hud?.entered === true, undefined, { timeout: 300000, polling: 1000 });
  await page.addStyleTag({ content: '#hud,#hud *,.ws-touch,[class*="banner"],[class*="toast"],[class*="prompt"],[class*="hint"]{display:none!important}' });
  await page.evaluate(() => {
    const w = window.__world;
    if (w.animals) w.animals.calm = true;
    window.__crowns = { pose: null };
    // posed last in the frame, after the player's camera
    w.game.onLate(() => {
      const p = window.__crowns.pose, cam = w.game.camera;
      if (!p) return;
      for (const ch of cam.children) ch.visible = false; // the viewmodel
      cam.position.set(p.eye[0], p.eye[1], p.eye[2]); cam.up.set(0, 1, 0);
      cam.lookAt(p.at[0], p.at[1], p.at[2]); cam.updateMatrixWorld(true);
    });
  });
  await sleep(8000);
  const factoryState = await page.evaluate(() => { const F = window.__world.forest.factory; return { crownTop: F.crownTop?.value ?? null, tune: F.crownTop?.tune?.toArray() ?? null }; });
  console.log('factory', JSON.stringify(factoryState));
  summary.factory = factoryState;
  for (const v of VIEWS) {
    await page.evaluate((vv) => {
      const w = window.__world, h = window.__hf.heightAt;
      const o = vv.eye.over ?? vv.eye;
      const eye = [vv.eye.x, h(o.x, o.z) + vv.eye.dy, vv.eye.z], at = [vv.at.x, h(vv.at.x, vv.at.z) + vv.at.dy, vv.at.z];
      if (window.__crownGate !== undefined) w.game.frameGate = window.__crownGate;
      w.player.spawn(vv.eye.x, vv.eye.z, 0);
      w.freeCamera = true;
      window.__crowns.pose = { eye, at };
    }, v);
    await sleep(7000); // LOD buckets, streaming, the impostor dissolve
    const variants = [{ tag: 'A', mod: {} }, { tag: 'B', mod: { crownTop: 1 } }];
    if (SWEEP) variants.push({ tag: 'B-soft', mod: { crownTop: 1, tune: [0.7, 0.7, 0.45, 0.3] } }, { tag: 'B-strong', mod: { crownTop: 1, tune: [0.9, 1.4, 0.55, 0.45] } });
    if (DIAG) variants.push({ tag: 'A-noNormal', mod: { noNormal: true } }, { tag: 'A-noShadow', mod: { noShadow: true } }, { tag: 'A-noVcol', mod: { noVcol: true } },
      { tag: 'C-noShadow', mod: { cardNoShadow: true } }, { tag: 'C-noNormal', mod: { cardNoNormal: true } }, { tag: 'C-noAO', mod: { cardNoAO: true } }, { tag: 'C-noUpDark', mod: { cardPatch: ['mix( 1.0, 0.6,', 'mix( 1.0, 1.0,'] } },
      { tag: 'C-upN80', mod: { cardPatch: ['normal = normalize( mix( normal, upV, 0.25 ) );', 'normal = normalize( mix( normal, upV, 0.8 ) );'] } });
    summary.views[v.id] = {};
    for (const { tag, mod } of variants) {
      const stats = await page.evaluate((m) => {
        const w = window.__world, g = w.game, r = g.renderer, gl = r.getContext(), F = w.forest.factory;
        window.__crownGate ??= g.frameGate;
        g.frameGate = () => false;
        // this variant's switches (restored below)
        const undo = [];
        if (F.crownTop) {
          const old = F.crownTop.value, oldTune = F.crownTop.tune.toArray();
          F.crownTop.value = m.crownTop ?? 0;
          if (m.tune) F.crownTop.tune.fromArray(m.tune);
          undo.push(() => { F.crownTop.value = old; F.crownTop.tune.fromArray(oldTune); });
        }
        if (m.noNormal) { const old = F.farMaterial.normalMap; F.farMaterial.normalMap = null; F.farMaterial.needsUpdate = true; undo.push(() => { F.farMaterial.normalMap = old; F.farMaterial.needsUpdate = true; }); }
        if (m.noVcol) { F.needleMaterial.vertexColors = false; F.needleMaterial.needsUpdate = true; undo.push(() => { F.needleMaterial.vertexColors = true; F.needleMaterial.needsUpdate = true; }); }
        const objs = []; g.scene.traverse((o) => { if (o.material !== undefined) objs.push(o); });
        const mats = new Set([F.needleMaterial, F.twigMaterial, F.farMaterial, F.barkMaterial]);
        const far = objs.filter((o) => o.material === F.farMaterial), all = objs.filter((o) => mats.has(o.material));
        if (m.noShadow) { for (const o of far) o.receiveShadow = false; F.farMaterial.needsUpdate = true; undo.push(() => { for (const o of far) o.receiveShadow = true; F.farMaterial.needsUpdate = true; }); }
        const N = F.needleMaterial, cardObjs = objs.filter((o) => o.material === N || o.material === F.twigMaterial);
        if (m.cardNoShadow) { for (const o of cardObjs) o.receiveShadow = false; N.needsUpdate = true; undo.push(() => { for (const o of cardObjs) o.receiveShadow = true; N.needsUpdate = true; }); }
        if (m.cardNoNormal) { const old = N.normalMap; N.normalMap = null; N.needsUpdate = true; undo.push(() => { N.normalMap = old; N.needsUpdate = true; }); }
        if (m.cardNoAO) { const old = N.aoMap; N.aoMap = null; N.needsUpdate = true; undo.push(() => { N.aoMap = old; N.needsUpdate = true; }); }
        if (m.cardPatch) {
          const obc = N.onBeforeCompile, key = N.customProgramCacheKey, [a, b] = m.cardPatch;
          N.onBeforeCompile = (sh, rr) => { obc(sh, rr); if (!sh.fragmentShader.includes(a)) console.log('[diag] patch miss', a); sh.fragmentShader = sh.fragmentShader.replace(a, b); };
          N.customProgramCacheKey = () => `${key()}|diag${a.length}`; N.needsUpdate = true;
          undo.push(() => { N.onBeforeCompile = obc; N.customProgramCacheKey = key; N.needsUpdate = true; });
        }
        const W = r.domElement.width, H = r.domElement.height;
        const grab = () => { g.composer.render(1 / 30); g.composer.render(1 / 30); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
        const full = grab();
        for (const o of far) o.visible = false;
        const noFar = grab();
        for (const o of all) o.visible = false;
        const none = grab();
        for (const o of all) o.visible = true;
        grab(); // leave the full frame on the canvas for the screenshot
        const luma = (p, i) => (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / 255;
        const diff = (a, b, i) => Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        const acc = () => ({ n: 0, sum: 0, dark: 0, hist: new Float64Array(100) });
        const S = { all: acc(), far: acc(), cards: acc(), band: acc() };
        const add = (s, y) => { s.n++; s.sum += y; if (y < 0.08) s.dark++; s.hist[Math.min(99, Math.floor(y * 100))]++; };
        for (let y = 0; y < H; y++) {
          const inBand = y > H * 0.35 && y < H * 0.65; // readPixels rows are bottom-up; the band is symmetric
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (diff(full, none, i) <= 18) continue;
            const Y = luma(full, i);
            add(S.all, Y); if (inBand) add(S.band, Y);
            if (diff(full, noFar, i) > 18) add(S.far, Y); else add(S.cards, Y);
          }
        }
        for (const u of undo) u();
        const pct = (s, f) => { let c = 0; for (let k = 0; k < 100; k++) { c += s.hist[k]; if (c >= s.n * f) return k / 100; } return 1; };
        const fin = (s) => ({ px: s.n, share: Number((s.n / (W * H)).toFixed(3)), luma: s.n ? Number((s.sum / s.n).toFixed(3)) : null, dark: s.n ? Number((s.dark / s.n).toFixed(3)) : null, p10: pct(s, 0.1), p50: pct(s, 0.5), p90: pct(s, 0.9) });
        return { W, H, farObjects: far.length, all: fin(S.all), far: fin(S.far), cards: fin(S.cards), band: fin(S.band) };
      }, mod);
      writeFileSync(`${OUT}/${v.id}-${tag}.png`, await page.screenshot({ type: 'png' }));
      summary.views[v.id][tag] = stats;
      console.log(`${v.id.padEnd(13)} ${tag.padEnd(11)} trees ${JSON.stringify(stats.all)} · far ${JSON.stringify(stats.far)} · cards ${JSON.stringify(stats.cards)} · band ${JSON.stringify(stats.band)}`);
    }
    await page.evaluate(() => { const w = window.__world; w.game.frameGate = window.__crownGate; });
  }
  writeFileSync(`${OUT}/crowns.json`, `${JSON.stringify(summary, null, 1)}\n`);
  await ctx.close();
} finally {
  await browser.close();
}
