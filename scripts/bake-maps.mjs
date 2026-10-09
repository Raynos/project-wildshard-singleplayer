#!/usr/bin/env node
// Bake each shard's map from its world (SF66, G246 / G247; the look is G252's B, stylized): boot the shard in a served
// build, render it straight down (orthographic, the full 500 m cell centred on the origin) in 2 × 2 tiles, twice: a colour
// pass and a height pass (every mesh drawn with its world height). scripts/map-stylize.py turns the two into flat colours
// by ground type from the shard's own colour table (look/map.json "style"), with a hillshade and inked edges, and writes
// public/assets/<slug>/map/top.webp (1000 px, 0.5 m per pixel). The stamp (the map inputs' hash, look/map.json included, so
// a palette change rebakes) goes in src/shards/<slug>/look/map.baked.json. Only shards whose map inputs changed are baked
// unless --all or --shards is given. A shard with no "style" fails its bake: every shard owns its colour table.
//   node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head> [--shards=a,b] [--all] [--keep=<dir>]
//   (through scripts/browser-lane.sh; the stylizer runs under `uv run` with numpy, scipy and pillow)
// Bake rules (art/maps/round-1-baked-map-style/README.md): the engine renders with autoClear off, so colour and depth are
// cleared before every tile; the pixels are read straight after each draw; movers are drawn at rest (each mover runtime's
// `showRest`, in the same task as the draws).
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { saveFixture } from './debug-settings.mjs';
import { MAP_METRES, mapSettings, mapShards, mapTilesHash } from './map-hash.mjs';

const option = (name) => process.argv.find((part) => part.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = resolve(import.meta.dirname, '..');
const url = option('url');
if (url === undefined) throw new Error('bake-maps: --url=<served build> (scripts/serve-build.sh --head)');
const base = url.replace(/\/?$/, '/');
const only = option('shards')?.split(',');
const keep = option('keep');
const TILE = 1000, HEIGHT = 900, OUT = 1000;

const stampPath = (dir) => join(dir, 'look', 'map.baked.json');
const todo = mapShards(root).filter(({ slug, dir }) => {
  if (only) return only.includes(slug);
  if (process.argv.includes('--all') || !existsSync(stampPath(dir))) return true;
  return JSON.parse(readFileSync(stampPath(dir), 'utf8')).tilesHash !== mapTilesHash(dir);
});
if (todo.length === 0) { console.log('bake-maps: every map is current'); process.exit(0); }

// Browser side: hide what is not the world, pose the movers at rest, render 2 × 2 orthographic tiles of the colour pass and
// the height pass, each tile cleared before its draw and read straight after it; returns two PNG data URLs.
function bake(arg) {
  const g = window.__wildshard.world.game, r = g.renderer, scene = g.rootScene ?? g.scene, gl = r.getContext();
  const exposed = g.app.debug.snapshot();
  const rest = () => { for (const [name, value] of Object.entries(exposed)) if (name.startsWith('movers.') && typeof value?.showRest === 'function') value.showRest(); };
  const hidden = [], hide = (o) => { if (o.visible) { o.visible = false; hidden.push(o); } };
  for (const c of g.camera.children) hide(c); // held items
  const clouds = g.sky?.clouds; if (clouds) hide(clouds);
  const named = (o) => arg.hide.some((p) => (p.endsWith('*') ? o.name.startsWith(p.slice(0, -1)) : o.name === p));
  scene.traverse((o) => {
    // the engine sky and backdrops by name (never an island or a sky isle), the shard's own hides, particles and sprites
    const sky = o.name === 'look-dome' || (/cloud|sky|dome|backdrop/iu.test(o.name) && !/isle|island/iu.test(o.name));
    if (named(o) || sky || o.isPoints === true || o.isSprite === true) hide(o);
  });
  const fog = scene.fog, bg = scene.background; scene.fog = null;
  const cam0 = g.camera, side = Math.min(arg.tile, gl.drawingBufferWidth, gl.drawingBufferHeight), ratio = r.getPixelRatio(), half = arg.metres / 2;
  const near = arg.clipAbove === null ? 1 : arg.height - arg.clipAbove, far = arg.clipBelow === null ? arg.height + 400 : arg.height - arg.clipBelow;
  const pass = () => {
    const out = document.createElement('canvas'); out.width = side * 2; out.height = side * 2; const ctx = out.getContext('2d');
    r.setRenderTarget(null); r.setScissorTest(false); r.setViewport(0, 0, side / ratio, side / ratio);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      // straight down in the minimap's frame (Minimap.ts): north (+Z) up the image, east (−X) right; tile i from the left (+X), j from the top (+Z)
      const cam = cam0.clone(false); cam.isPerspectiveCamera = false; cam.isOrthographicCamera = true;
      cam.position.set(0, arg.height, 0); cam.up.set(0, 0, 1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
      const l = -half + i * half, t = half - j * half;
      // camera space: x runs toward −X world (east), y toward +Z (north); the tile spans world X [−l−half, −l], Z [t−half, t]
      cam.projectionMatrix.makeOrthographic(l, l + half, t, t - half, near, far);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
      r.clear(true, true, true); r.render(scene, cam);
      const buf = new Uint8Array(side * side * 4); gl.readPixels(0, 0, side, side, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const img = ctx.createImageData(side, side), row = side * 4;
      for (let y = 0; y < side; y++) img.data.set(buf.subarray((side - 1 - y) * row, (side - y) * row), y * row); // GL rows are bottom-up
      for (let k = 3; k < img.data.length; k += 4) img.data[k] = 255;
      ctx.putImageData(img, i * side, j * side);
    }
    return out.toDataURL('image/png');
  };
  const Color = scene.getObjectByProperty('isMesh', true)?.material?.color?.constructor;
  if (Color !== undefined) scene.background = new Color(arg.bg[0], arg.bg[1], arg.bg[2]);
  let colour, height = null;
  try {
    rest(); colour = pass();
    // height pass: every mesh in its world height (16 bit over R, G; B = 1 where anything is), cleared to black; the sky / sea
    // backdrops (> 800 m across), ghosts (invisible, colour-off or depth-off transparent) and the shard's "heightHide" left out
    const shaders = []; scene.traverse((o) => { if (o.material?.type === 'ShaderMaterial') shaders.push(o.material.constructor); });
    const SM = shaders[0];
    if (SM !== undefined) {
      const mat = new SM({
        vertexShader: 'varying float vH; void main(){ vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\n p = instanceMatrix * p;\n#endif\n vec4 w = modelMatrix * p; vH = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'varying float vH; void main(){ float v = clamp((vH + 100.0) / 400.0, 0.0, 1.0) * 65535.0; gl_FragColor = vec4(floor(v / 256.0) / 255.0, mod(floor(v), 256.0) / 255.0, 1.0, 1.0); }',
      });
      mat.side = 2; mat.toneMapped = false;
      const hid2 = [], back = (o) => arg.heightHide.some((p) => (p.endsWith('*') ? o.name.startsWith(p.slice(0, -1)) : o.name === p));
      scene.traverse((o) => {
        if (!o.visible || !(o.isMesh || o.isLine)) return;
        if (o.geometry && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere?.();
        const radius = o.geometry?.boundingSphere?.radius ?? 0, ms = Array.isArray(o.material) ? o.material : [o.material];
        const ghost = ms.every((m) => !m || m.visible === false || m.colorWrite === false || (m.transparent && m.depthWrite === false));
        if (radius > 800 || ghost || back(o)) { o.visible = false; hid2.push(o); }
      });
      const cc = r.getClearColor(cam0.position.clone()), ca = r.getClearAlpha(), tm = r.toneMapping;
      scene.background = null; r.setClearColor(0x000000, 1); r.toneMapping = 0; scene.overrideMaterial = mat;
      try { rest(); height = pass(); } finally { scene.overrideMaterial = null; r.setClearColor(cc, ca); r.toneMapping = tm; for (const o of hid2) o.visible = true; mat.dispose(); }
    }
  } finally {
    for (const o of hidden) o.visible = true;
    scene.fog = fog; scene.background = bg;
    r.setViewport(0, 0, r.domElement.width / ratio, r.domElement.height / ratio);
  }
  return { side, colour, height };
}

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const work = keep ?? mkdtempSync(join(tmpdir(), 'bake-maps-'));
mkdirSync(work, { recursive: true });
let failed = 0;
try {
  for (const { slug, dir } of todo) {
    const settings = mapSettings(dir);
    const context = await browser.newContext({ viewport: { width: TILE + 100, height: TILE + 100 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true }); // Developer-only shards boot too
    const page = await context.newPage();
    try {
      await page.goto(`${base}?chunk=${encodeURIComponent(slug)}&mute=1&skipintro=1&nolock=1&sw=0`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__wildshard?.world?.game && !document.querySelector('.ws-load')), null, { timeout: 180_000, polling: 250 });
      await page.waitForTimeout(6000); // late streamed pieces and models
      const out = await page.evaluate(bake, { tile: TILE, height: HEIGHT, metres: MAP_METRES, bg: [0.16, 0.18, 0.2], hide: settings.hide, heightHide: settings.heightHide, clipBelow: settings.clipBelow, clipAbove: settings.clipAbove });
      const colourPng = join(work, `colour-${slug}.png`), heightPng = join(work, `height-${slug}.png`), stylePath = join(work, `style-${slug}.json`);
      writeFileSync(colourPng, Buffer.from(out.colour.slice(out.colour.indexOf(',') + 1), 'base64'));
      if (out.height !== null) writeFileSync(heightPng, Buffer.from(out.height.slice(out.height.indexOf(',') + 1), 'base64'));
      const imageDir = join(root, 'public/assets', slug, 'map'), webp = join(imageDir, 'top.webp');
      mkdirSync(imageDir, { recursive: true }); mkdirSync(join(dir, 'look'), { recursive: true });
      if (settings.style === null || out.height === null) throw new Error(`${slug}: no look/map.json "style" (the colour table) or no height pass`);
      writeFileSync(stylePath, JSON.stringify(settings.style));
      execFileSync('uv', ['run', '--quiet', '--with', 'numpy', '--with', 'scipy', '--with', 'pillow', 'python', join(root, 'scripts/map-stylize.py'), colourPng, heightPng, stylePath, webp, String(OUT)], { stdio: 'inherit' });
      const bytes = statSync(webp).size;
      const stamp = { version: 1, tilesHash: mapTilesHash(dir), image: `/assets/${slug}/map/top.webp`, size: OUT, metres: MAP_METRES, north: '+z', east: '-x', style: `stylized:${settings.style.kind}`, bytes };
      writeFileSync(stampPath(dir), `${JSON.stringify(stamp, null, 2)}\n`);
      console.log(`bake-maps: ${slug} ${OUT}px ${(bytes / 1024).toFixed(0)} KB`);
    } catch (error) {
      failed++; console.error(`bake-maps: ${slug} FAILED — ${error instanceof Error ? error.message : String(error)}`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  if (keep === undefined) rmSync(work, { recursive: true, force: true });
}
if (failed > 0) process.exit(1);
