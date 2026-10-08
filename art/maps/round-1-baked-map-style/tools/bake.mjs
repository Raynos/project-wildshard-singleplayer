// SHARD-PLATFORM G246 mockup: bake a shard's map straight down from the real world (orthographic, the whole 500 m cell).
// Loads the shard standalone (SHARD SELECT URL, phone tier, iPhone 16 Pro, muted), then renders the root scene once
// through an orthographic copy of the game camera onto the canvas (tone mapping + sRGB, no post chain), crops the cell.
// Run: scripts/browser-lane.sh node bake.mjs --url=<served build> --shard=<slug> --out=<png> [--px=1170]
import { writeFileSync } from 'node:fs';
const ROOT = '/Users/raynos/projects/games/wildshard-singleplayer';
const { saveFixture } = await import(`${ROOT}/scripts/debug-settings.mjs`);
const { chromium, devices } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const URL0 = arg('url', 'http://127.0.0.1:4403'), SLUG = arg('shard', 'driftwood-isle'), OUT = arg('out', `${import.meta.dirname}/bake-${SLUG}.png`);
const HIDE = arg('hide', ''), HIDE_BACK = arg('back', ''); // comma-separated name regex parts to hide during the bake (sky domes, cloud decks)
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--mute-audio'] });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
try {
  const ctx = await browser.newContext({ ...devices['iPhone 16 Pro'] }), page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
  await saveFixture(ctx, { scope: 'global', key: 'settings', data: { tier: 'phone' }, merge: true });
  await saveFixture(ctx, { scope: 'device', key: 'devMode', data: true });
  await page.goto(`${URL0}/?chunk=${SLUG}&tier=phone&touch=1&skipintro=1&nolock=1&sw=0&mute=1`, { waitUntil: 'commit', timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('.ws-load') && window.__wildshard?.world?.player !== undefined, undefined, { timeout: 300000, polling: 500 });
  await sleep(4000);
  // stand the player at the cell centre so anything streamed / LOD'd by distance is at its nearest
  await page.evaluate(() => { const w = window.__wildshard.world; try { w.animals.calm = true; } catch { /* */ } const p = w.player; p.spawn(0, 0, 0, Math.max(p.position.y, 2)); });
  await sleep(8000);
  const meta = await page.evaluate(([hide, hideBack]) => {
    const w = window.__wildshard.world, g = w.game, R = g.renderer, scene = g.rootScene, gl = R.domElement;
    const H = 250, TOP = 700;
    const cam = g.camera.clone(false), cam0 = cam;
    cam.position.set(0, TOP, 0); cam.up.set(0, 0, 1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    const aspect = gl.height / gl.width;
    cam.projectionMatrix.makeOrthographic(-H, H, H * aspect, -H * aspect, 1, TOP + 400);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.isPerspectiveCamera = false; cam.isOrthographicCamera = true;
    const hidden = [];
    for (const c of g.camera.children) if (c.visible) { c.visible = false; hidden.push(c); }
    const re = hide ? new RegExp(hide.split(',').join('|'), 'iu') : null, hits = [];
    if (re) scene.traverse((o) => { if (o.visible && re.test(o.name)) { o.visible = false; hidden.push(o); hits.push(o.name); } });
    const fog = scene.fog; scene.fog = null;
    // 2x2 tiles: each quadrant (250 m) fills the canvas width, so the cell comes out at 2x the canvas width
    const side = gl.width, N = 2, q = (2 * H) / N, y0 = Math.round((gl.height - side) / 2);
    const pass = () => {
      const c2 = document.createElement('canvas'); c2.width = side * N; c2.height = side * N; const x2 = c2.getContext('2d');
      R.setRenderTarget(null);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        // screen-left is +X (west); tile i counts from the left, j from the top (+Z)
        const l = -H + i * q, t = H - j * q, czm = t - q / 2, hh = (q / 2) * aspect;
        const cam = cam0.clone(false); cam.isPerspectiveCamera = false; cam.isOrthographicCamera = true; cam.updateMatrixWorld(true); // a fresh camera per tile: three skips re-sending the projection for the same camera
        cam.projectionMatrix.makeOrthographic(l, l + q, czm + hh, czm - hh, 1, TOP + 400);
        cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
        R.clear(true, true, true); R.render(scene, cam); // the engine runs with autoClear off: without this, tile 2+ fail the depth test
        // readPixels straight after the draw (drawImage of the GL canvas returned a stale snapshot after the first tile)
        const ctxGl = R.getContext(), buf = new Uint8Array(side * side * 4);
        ctxGl.readPixels(0, gl.height - y0 - side, side, side, ctxGl.RGBA, ctxGl.UNSIGNED_BYTE, buf);
        const img = x2.createImageData(side, side), row = side * 4;
        for (let y = 0; y < side; y++) img.data.set(buf.subarray((side - 1 - y) * row, (side - y) * row), y * row);
        for (let k = 3; k < img.data.length; k += 4) img.data[k] = 255;
        x2.putImageData(img, i * side, j * side);
      }
      return c2.toDataURL('image/png');
    };
    const color = pass();
    // height pass: every mesh drawn with its world height (16 bit over R,G; B = 1 where anything is), the sky / sea backdrops
    // (anything > 800 m across) and the named backdrops hidden, cleared to black
    let SM = null; scene.traverse((o) => { if (SM === null && o.material?.type === 'ShaderMaterial') SM = o.material.constructor; });
    let height = null; const ghosts = [];
    if (SM !== null) {
      const mat = new SM({
        vertexShader: 'varying float vH; void main(){ vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\n p = instanceMatrix * p;\n#endif\n vec4 w = modelMatrix * p; vH = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: 'varying float vH; void main(){ float v = clamp((vH + 100.0) / 400.0, 0.0, 1.0) * 65535.0; gl_FragColor = vec4(floor(v / 256.0) / 255.0, mod(floor(v), 256.0) / 255.0, 1.0, 1.0); }',
      });
      mat.side = 2; mat.toneMapped = false;
      const hid2 = []; ghosts.length = 0;
      const backdrop = hideBack ? new RegExp(hideBack.split(',').join('|'), 'iu') : null;
      scene.traverse((o) => {
        if (!o.visible) return;
        if (o.isPoints || o.isSprite) { o.visible = false; hid2.push(o); return; }
        if (!(o.isMesh || o.isLine)) return;
        if (o.geometry && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere?.();
        const r = o.geometry?.boundingSphere?.radius ?? 0;
        const ms = Array.isArray(o.material) ? o.material : [o.material], ghost = ms.every((m) => !m || m.visible === false || m.colorWrite === false || (m.transparent && m.depthWrite === false));
        if (r > 800 || ghost || (backdrop && backdrop.test(o.name))) { o.visible = false; hid2.push(o); if (r > 60) ghosts.push(`${o.name}|${Math.round(r)}|${ghost}`); }
      });
      const bg = scene.background, cc = R.getClearColor(cam.position.clone()), ca = R.getClearAlpha(), tm = R.toneMapping;
      scene.background = null; R.setClearColor(0x000000, 1); R.toneMapping = 0; scene.overrideMaterial = mat;
      try { height = pass(); } finally { scene.overrideMaterial = null; scene.background = bg; R.setClearColor(cc, ca); R.toneMapping = tm; for (const o of hid2) o.visible = true; }
    }
    scene.fog = fog; for (const o of hidden) o.visible = true;
    const names = []; scene.traverse((o) => { if (o.isMesh && o.geometry?.boundingSphere?.radius > 300) names.push(`${o.name}|${o.parent?.name}|${Math.round(o.geometry.boundingSphere.radius)}`); });
    return { url: color, height, ghosts, side, glw: gl.width, glh: gl.height, hits, big: names.slice(0, 30), player: [w.player.position.x, w.player.position.z] };
  }, [HIDE, HIDE_BACK]);
  writeFileSync(OUT, Buffer.from(meta.url.split(',')[1], 'base64'));
  if (meta.height) writeFileSync(OUT.replace(/bake-/u, 'height-'), Buffer.from(meta.height.split(',')[1], 'base64'));
  console.log(JSON.stringify({ ...meta, url: undefined, height: Boolean(meta.height) }, null, 1));
} finally { await browser.close(); }
