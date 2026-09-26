#!/usr/bin/env node
// ktx2-bc-probe.mjs — E173: the desktop KTX2 set on a GPU WITHOUT ASTC / ETC (a Windows / Linux desktop: D3D / Vulkan expose
// BC formats only). This Mac's Chrome (ANGLE Metal) exposes ASTC, ETC2, S3TC and BPTC (EXT_texture_compression_bptc), and
// three's KTX2Loader ranks ASTC 4×4 first for UASTC and ETC2 first for ETC1S, so that is what it uploads here. Hiding
// ASTC, ETC and PVRTC from the page (getExtension / getSupportedExtensions) makes it pick BC7 for both — the Windows path;
// `--hide-bptc` hides BPTC too and it picks S3TC (BC1 / BC3), the path of a GPU without BPTC. Either way it exercises
// WebGL's block-size rules on every mip level (a 6144×704 horizon's 22-texel level, a 5564-wide panorama). Reports the
// formats uploaded, every WebGL / KTX2 console error, and a frame.
//
//   node scripts/ktx2-bc-probe.mjs --url=http://localhost:4811 [--chunk=pine-hollow] [--hide-bptc] [--out=<png>]
//
// One headless Chromium on Metal, muted (`--mute-audio`, `mute=1`), closed at the end.
import { ledger, report } from './texmem-probe.mjs';

const { chromium } = await import('playwright');
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://localhost:4811');
const CHUNK = flag('chunk', 'pine-hollow');
const OUT = flag('out', '');
const HIDE = ['WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc', 'WEBGL_compressed_texture_etc1', 'WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc',
  ...(argv.includes('--hide-bptc') ? ['EXT_texture_compression_bptc'] : [])];
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((hide) => {
    for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
      const ge = C.prototype.getExtension, gs = C.prototype.getSupportedExtensions;
      C.prototype.getExtension = function getExtension(name) { return hide.includes(name) ? null : ge.call(this, name); };
      C.prototype.getSupportedExtensions = function getSupportedExtensions() { return (gs.call(this) ?? []).filter((n) => !hide.includes(n)); };
    }
  }, HIDE);
  await ctx.addInitScript(ledger);
  await ctx.addInitScript(() => { try { localStorage.setItem('ws.settings.v1', JSON.stringify({ prefetch: 'off', tex: 'ktx2' })); } catch { /* */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`[page] ${e.message.slice(0, 200)}`));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || /WebGL|GL_INVALID|ktx2|KTX2|basis/i.test(t)) errors.push(`[${m.type()}] ${t.slice(0, 240)}`); });
  await page.goto(`${URL_BASE}/?chunk=${CHUNK}&mute=1&skipintro=1&nolock=1&sw=0&tier=desktop`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__world?.game), undefined, { timeout: 300000, polling: 500 });
  await sleep(10000);
  const r = await page.evaluate(report, 0);
  const ext = await page.evaluate(() => (document.createElement('canvas').getContext('webgl2')?.getSupportedExtensions() ?? []).filter((n) => /compress/i.test(n)));
  console.log(`[bc] ${CHUNK} desktop, hidden: ${HIDE.join(' ')} · textures ${r.textureMB} MB (compressed ${r.compressedMB} MB in ${r.compressedTextures}) · the page sees ${ext.join(' ')}`);
  console.log(`  by format ${JSON.stringify(r.byFormat)}`);
  console.log(`  errors (${errors.length}): ${errors.slice(0, 12).join('\n    ') || 'none'}`);
  if (OUT !== '') await page.screenshot({ path: OUT });
} finally {
  await browser.close();
}
