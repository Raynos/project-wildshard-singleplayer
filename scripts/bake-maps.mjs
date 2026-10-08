#!/usr/bin/env node
// Bake each shard's map from its world (SF66, G246 / G247): boot the shard in a served build, render it straight down
// (orthographic, the full 500 m cell centred on the origin, ~0.5 m per pixel) with the sky, fog, player and held items
// off, and write the image to public/assets/<slug>/map/top.webp with its stamp (the map inputs' hash, size, metres)
// in src/shards/<slug>/look/map.baked.json. Only shards whose map inputs changed are baked unless --all or --shards is given.
// The style is a neutral placeholder (the plain lit render) until Jake picks photo vs stylized.
//   node scripts/bake-maps.mjs --url=<served build> [--shards=a,b] [--all]      (through scripts/browser-lane.sh)
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { saveFixture } from './debug-settings.mjs';
import { MAP_METRES, mapSettings, mapShards, mapTilesHash } from './map-hash.mjs';

const option = (name) => process.argv.find((part) => part.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(import.meta.dirname, '..');
const url = option('url');
if (url === undefined) throw new Error('bake-maps: --url=<served build> (scripts/serve-build.sh --head)');
const base = url.replace(/\/?$/, '/');
const only = option('shards')?.split(',');
const SIZE = 1000, HEIGHT = 900;

const stampPath = (dir) => join(dir, 'look', 'map.baked.json');
const todo = mapShards(root).filter(({ slug, dir }) => {
  if (only) return only.includes(slug);
  if (process.argv.includes('--all') || !existsSync(stampPath(dir))) return true;
  return JSON.parse(readFileSync(stampPath(dir), 'utf8')).tilesHash !== mapTilesHash(dir);
});
if (todo.length === 0) { console.log('bake-maps: every map is current'); process.exit(0); }

// Browser side: hide what is not the world, render top-down orthographic into the drawing buffer, encode WebP.
function bake(arg) {
  const g = window.__wildshard.world.game, r = g.renderer, scene = g.scene, cam = g.camera, gl = r.getContext();
  const hidden = [], keep = new Set();
  cam.traverse((o) => { if (o !== cam) keep.add(o); });
  const clouds = g.sky?.clouds; // the engine sky's cloud layer
  if (clouds) clouds.traverse((o) => { keep.add(o); });
  scene.traverse((o) => {
    const named = arg.hide.some((p) => (p.endsWith('*') ? o.name.startsWith(p.slice(0, -1)) : o.name === p));
    const sky = [named, o.name === 'look-dome', /cloud|sky|dome|backdrop/iu.test(o.name)].some(Boolean);
    if ([keep.has(o), sky, o.isPoints === true, o.isSprite === true].some(Boolean) && o.visible) { o.visible = false; hidden.push(o); }
  });
  const fog = scene.fog, bg = scene.background;
  scene.fog = null;
  const Color = scene.getObjectByProperty('isMesh', true)?.material?.color?.constructor;
  if (Color !== undefined) scene.background = new Color(arg.bg[0], arg.bg[1], arg.bg[2]);
  const saved = { pos: cam.position.clone(), quat: cam.quaternion.clone(), proj: cam.projectionMatrix.clone(), inv: cam.projectionMatrixInverse.clone(), auto: cam.matrixAutoUpdate };
  // straight down in the minimap's frame (Minimap.ts): north (+Z) up the image, east (−X) right; an orthographic projection written into the camera's own matrix
  cam.position.set(0, arg.height, 0); cam.up.set(0, 0, 1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
  const h = arg.metres / 2, n = 1, f = arg.clipBelow === null ? arg.height + 400 : arg.height - arg.clipBelow, e = cam.projectionMatrix.elements;
  e.fill(0); e[0] = 1 / h; e[5] = 1 / h; e[10] = -2 / (f - n); e[14] = -(f + n) / (f - n); e[15] = 1;
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  const size = Math.min(arg.size, gl.drawingBufferWidth, gl.drawingBufferHeight), ratio = r.getPixelRatio();
  r.setRenderTarget(null);
  r.setViewport(0, 0, size / ratio, size / ratio); r.setScissorTest(false);
  r.render(scene, cam);
  const px = new Uint8Array(size * size * 4);
  gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
  // restore (the page is closed after a bake, but keep the live loop sane meanwhile)
  for (const o of hidden) o.visible = true;
  scene.fog = fog; scene.background = bg;
  cam.position.copy(saved.pos); cam.quaternion.copy(saved.quat); cam.up.set(0, 1, 0); cam.projectionMatrix.copy(saved.proj); cam.projectionMatrixInverse.copy(saved.inv);
  r.setViewport(0, 0, r.domElement.width / ratio, r.domElement.height / ratio);
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4); // GL rows are bottom-up
  ctx.putImageData(img, 0, 0);
  return { size, webp: c.toDataURL('image/webp', 0.82) };
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--mute-audio'] });
let failed = 0;
try {
  for (const { slug, dir } of todo) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true }); // Developer-only shards boot too
    const page = await context.newPage();
    try {
      await page.goto(`${base}?chunk=${encodeURIComponent(slug)}&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game && !document.querySelector('.ws-load')), null, { timeout: 120_000, polling: 250 });
      await page.waitForTimeout(3000);
      const out = await page.evaluate(bake, { size: SIZE, height: HEIGHT, metres: MAP_METRES, bg: [0.16, 0.18, 0.2], hide: mapSettings(dir).hide, clipBelow: mapSettings(dir).clipBelow });
      const bytes = Buffer.from(out.webp.slice(out.webp.indexOf(',') + 1), 'base64');
      if (!out.webp.startsWith('data:image/webp')) throw new Error('the browser did not encode WebP');
      const imageDir = join(root, 'public/assets', slug, 'map');
      mkdirSync(imageDir, { recursive: true }); mkdirSync(join(dir, 'look'), { recursive: true });
      writeFileSync(join(imageDir, 'top.webp'), bytes);
      const stamp = { version: 1, tilesHash: mapTilesHash(dir), image: `/assets/${slug}/map/top.webp`, size: out.size, metres: MAP_METRES, north: '+z', east: '-x', style: 'placeholder', bytes: bytes.length };
      writeFileSync(stampPath(dir), `${JSON.stringify(stamp, null, 2)}\n`);
      console.log(`bake-maps: ${slug} ${out.size}px ${(bytes.length / 1024).toFixed(0)} KB`);
    } catch (error) {
      failed++; console.error(`bake-maps: ${slug} FAILED — ${error instanceof Error ? error.message : String(error)}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
if (failed > 0) process.exit(1);
