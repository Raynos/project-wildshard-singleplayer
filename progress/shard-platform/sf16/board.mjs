#!/usr/bin/env node
// SHARD-PLATFORM SF16, the M1 look board: today's template (the legacy chunk, ?chunk=_template on the built client)
// beside the template booted from its shardfile through the real client (the same build with the template's shardfile
// embedded: the plain clientWorld + water + exported creatures + the look), six matched cameras, SSIM per pair.
// One command (builds both sides, assembles the shardfile client, runs this through the browser lane):
//   progress/shard-platform/sf16/run.sh <scratch dir> [legacy ref]
// By hand: scripts/browser-lane.sh node progress/shard-platform/sf16/board.mjs <legacy dist> <client dir> <scratch out>
// Writes progress/shard-platform/sf16/board.jpg, board-world.jpg (the residual at the ladder's +fov step) and evidence.json (per camera: full-frame SSIM and the
// attribution ladder below).
import { createServer } from 'node:http';
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, resolve as resolvePath, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { installInit } from '../../../scripts/parity/init.mjs';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { ssim } from '../../../scripts/parity/ssim.mjs';

const [legacyDir, clientDir, outDir] = process.argv.slice(2).map((path) => resolvePath(path));
if (legacyDir === undefined || clientDir === undefined || outDir === undefined) throw new Error('usage: board.mjs <dist> <shardfile client dir> <scratch out>');
mkdirSync(outDir, { recursive: true });
const here = import.meta.dirname;
const mime = { '.js': 'application/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.m4a': 'audio/mp4', '.ktx2': 'image/ktx2' };
const serve = (directory) => new Promise((resolve) => {
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname, file = resolvePath(directory, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(`${directory}/`)) { response.writeHead(403); response.end(); return; }
    try { if (!statSync(file).isFile()) throw new Error('missing'); response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream'); response.end(readFileSync(file)); }
    catch { response.writeHead(404); response.end(); }
  });
  server.listen(0, '127.0.0.1', () => { resolve(server); });
});
// feet position and the point the camera faces; yaw from the player's convention (forward = (-sin yaw, -cos yaw))
const CAMERAS = [
  { name: 'spawn', at: [0, 4], look: [0, -12], pitch: -0.1 },
  { name: 'pool', at: [25, 31], look: [25, 20], pitch: -0.3 },
  { name: 'hut', at: [7, -1], look: [0, -12], pitch: -0.1 },
  { name: 'door', at: [0, -4], look: [0, -9], pitch: -0.05 },
  { name: 'creatures', at: [9, -6], look: [15, -12], pitch: -0.2 },
  { name: 'boss arena', at: [-9, -12], look: [-15, -20], pitch: -0.2 },
].map((camera) => ({ ...camera, yaw: Math.atan2(-(camera.look[0] - camera.at[0]), -(camera.look[1] - camera.at[1])) }));

const [legacyServer, clientServer] = await Promise.all([serve(legacyDir), serve(clientDir)]);
const port = (server) => { const address = server.address(); if (address === null || typeof address === 'string') throw new Error('no port'); return address.port; };
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal'] });
try {
  const open = async (lane) => {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    await installInit(context, { lane, sha: 'sf16-board', browser: 'chromium', accelerated: true, tier: 'phone' });
    await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone' } });
    await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
    const page = await context.newPage(); page.setDefaultTimeout(180_000);
    const errors = []; page.on('pageerror', (error) => { errors.push(String(error)); }); page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    return { page, errors };
  };
  const today = await open('sf16-today'), declared = await open('sf16-shardfile');
  const query = 'tier=phone&skipintro=1&nolock=1&mute=1&weather=clear&touch=1&sw=0';
  await today.page.goto(`http://127.0.0.1:${port(legacyServer)}/?chunk=_template&${query}`);
  await today.page.waitForFunction(() => Boolean(window.__wildshard) && !document.querySelector('.ws-load') && !document.getElementById('hud')?.classList.contains('intro'));
  await declared.page.goto(`http://127.0.0.1:${port(clientServer)}/?${query}`);
  await declared.page.waitForFunction(() => window.__wildshard?.shard?.shardfile && !document.querySelector('.ws-load'));
  await declared.page.evaluate(() => { if (window.__wildshard.app.state !== 'play') window.__wildshard.world.game.app.input.pressGesture('confirm'); });
  await declared.page.waitForFunction(() => window.__wildshard.app.state === 'play');
  for (const side of [today, declared]) await side.page.evaluate(() => window.__parity.advance(30));
  const census = async (page) => page.evaluate(() => {
    const animals = window.__wildshard.world.animals.animals;
    return animals.map((view) => ({ kind: view.kind, x: Math.round(view.position.x * 10) / 10, z: Math.round(view.position.z * 10) / 10, alive: view.alive, custom: view.model?.species?.rig ?? null, triangles: view.mesh.geometry.index?.count ?? view.mesh.geometry.getAttribute('position').count }));
  });
  // every difference between the two sides, named (SF16 polish, 2026-10-04); the ladder measures the first three
  const named = {
    hud: 'journal chip order and catalogue developer label differ; the normal hidden-template descriptor keeps its Developer banner, while this standalone SDK product has no catalogue status. HUD hidden at the world step',
    heldItem: 'both clients mount the held whip and lantern; their camera-parented viewmodels are hidden at the world step',
    fov: 'both held whips drive Hor+ portrait FOV (86.8 deg); the measured per-camera values verify the match',
    shadows: 'intended: baked L0 props cast shadows inside the 80 m ring (plan 3.2); today\'s grey-box primitives never set castShadow. Darkens the ground in front of the hut at the door camera',
    poolBasin: 'intended: the baked terrain samples the generator\'s -3 m pool step every 1.95 m (257 over 500 m), so the basin wall shows up to one sample outside the 5 m waterline; today\'s 40 x 40 ground (5 m grid) dips only at the pool centre vertex',
    scatter: 'intended: the 20 grey cubes are baked from RngService(357) at desktop density; today draws 10 (phone tier) from the session cosmetic stream, so positions differ',
    creatures: 'animation phase only: the grey blob idles in a different squash at capture; same exported skins and triangle counts',
    rampTreads: 'not a difference: the ten-tread stair right of the hut shows on both sides of the real and world frames; the immutable-byte proof verifies every tread and slope vertex, test/shardfile-fine-props-drawn.test.ts proves resident fine props are drawn, and each capture awaits the full refinement disc and asserts both real frames render from one camera pose (recorded per side)',
    horizon: 'intended: baked terrain covers the whole cell, so the far ground meets the sky as a soft band where today\'s 200 m plane stops in a hard edge',
  };
  const evidence = { named, cameras: {}, creatures: { today: await census(today.page), shardfile: await census(declared.page) }, errors: {} };
  // The attribution ladder (diagnostic captures after the real one, never on the board): each step removes one named
  // difference and re-scores, so what is left at the last step is the render itself.
  //   world:   HUD and the camera-parented viewmodel (held whip / lantern) hidden on both sides
  //   fov:     + the shardfile camera given today's FOV (today's held whip owns camera.fov, Hor+ on portrait)
  //   shadows: + castShadow off on the shardfile side (baked L0 props cast; today's grey-box primitives never did)
  const diagnose = (page, step) => page.evaluate(({ step: s, fov }) => {
    const game = window.__wildshard.world.game, camera = game.camera, saved = window.__sf16 ??= { fov: camera.fov, casters: [] };
    const hidden = s !== 'full';
    // a stylesheet, not inline styles: HUD children set their own visibility every frame
    let sheet = document.getElementById('sf16-hide');
    if (hidden && sheet === null) { sheet = document.createElement('style'); sheet.id = 'sf16-hide'; sheet.textContent = 'body > *:not(canvas):not(:has(canvas)), #hud, #hud * { visibility: hidden !important; }'; document.head.append(sheet); }
    if (!hidden) sheet?.remove();
    for (const child of camera.children) child.visible = !hidden;
    camera.fov = fov ?? saved.fov; camera.updateProjectionMatrix();
    if (s === 'shadows') game.scene.traverse((object) => { if (object.isMesh && object.castShadow) { object.castShadow = false; saved.casters.push(object); } });
    else { for (const object of saved.casters) object.castShadow = true; saved.casters.length = 0; }
    if (s === 'full') delete window.__sf16;
  }, step);
  const shots = [];
  for (const camera of CAMERAS) {
    const pair = [];
    let residency;
    for (const side of [today, declared]) {
      await side.page.evaluate((p) => window.__wildshard.pose(p), { x: camera.at[0], z: camera.at[1], yaw: camera.yaw, pitch: camera.pitch });
      await side.page.evaluate(() => window.__parity.advance(20));
      if (side === declared) {
        residency = await side.page.evaluate(async ([x, z]) => {
          const state = window.__wildshard.shard.shardfileResidency;
          if (state?.mode !== 'standalone' || state.workers) throw new Error('Template board requires the plain standalone client');
          // Fixed-frame advance can enqueue asynchronous cache reads; it cannot prove that GLBs have uploaded.
          // This is the same data-side refresh used while walking, awaited through its complete serialized queue.
          await state.tiles.refresh(x, z);
          const cameraTile = `0/${Math.floor((x + 250) / 62.5)}/${Math.floor((z + 250) / 62.5)}`;
          const fine = [...state.tiles.fine].sort();
          if (!fine.includes(cameraTile)) throw new Error(`Camera L0 has not uploaded: ${cameraTile}`);
          for (let tz = 0; tz < 8; tz++) for (let tx = 0; tx < 8; tx++) {
            const minX = -250 + tx * 62.5, minZ = -250 + tz * 62.5;
            const distance = Math.hypot(Math.max(minX - x, 0, x - minX - 62.5), Math.max(minZ - z, 0, z - minZ - 62.5));
            if (distance <= 150 && !fine.includes(`0/${tx}/${tz}`)) throw new Error(`Fine coverage has not uploaded: 0/${tx}/${tz}`);
          }
          return { cameraTile, fine, ready: true };
        }, camera.at);
      }
      // Render after the awaited installs; both sides advance the same fixed frames.
      await side.page.evaluate(() => window.__parity.advance(2));
      const jpeg = await side.page.screenshot({ type: 'jpeg', quality: 88 });
      const draws = await side.page.evaluate(() => {
        const world = window.__wildshard.world, camera = world.game.camera, round = (n) => Math.round(n * 1e4) / 1e4;
        camera.updateMatrixWorld(true);
        const e = camera.matrixWorld.elements, forward = [-e[8], -e[9], -e[10]];
        // the real frame's render pose: the camera's world position and facing, beside the player feet the pose set
        const pose = { camera: [e[12], e[13], e[14]].map(round), yaw: round(Math.atan2(-forward[0], -forward[2])), pitch: round(Math.asin(Math.max(-1, Math.min(1, forward[1])))),
          feet: [world.player.position.x, world.player.position.y, world.player.position.z].map(round), playerYaw: round(world.player.yaw) };
        return { calls: world.game.lastFrame.calls, triangles: world.game.lastFrame.triangles, fov: camera.fov, pose };
      });
      pair.push({ jpeg, draws });
    }
    // both real frames render from one pose (SF16): a drift here would read as missing content at the frame's edge
    const [a, b] = pair.map((shot) => shot.draws.pose);
    // eye height follows each side's own ground (the pool basin differs by design), so only x, z, yaw and pitch must agree
    const drift = Math.max(Math.abs(a.camera[0] - b.camera[0]), Math.abs(a.camera[2] - b.camera[2]), Math.abs(a.yaw - b.yaw) * 10, Math.abs(a.pitch - b.pitch) * 10);
    if (drift > 0.05) throw new Error(`${camera.name}: the two real frames render from different poses: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    const file = (i) => join(outDir, `${camera.name.replace(' ', '-')}-${i === 0 ? 'today' : 'shardfile'}.jpg`);
    pair.forEach((shot, i) => { writeFileSync(file(i), shot.jpeg); });
    const score = async (a, b) => (await today.page.evaluate(ssim, { a: a.toString('base64'), b: b.toString('base64') })).ssim;
    const full = await score(pair[0].jpeg, pair[1].jpeg), ladder = { full };
    const capture = async (side, step, fov) => { await diagnose(side.page, { step, fov }); await side.page.evaluate(() => window.__parity.advance(2)); return side.page.screenshot({ type: 'jpeg', quality: 88 }); };
    const reference = await capture(today, 'world', null);
    for (const step of ['world', 'fov', 'shadows']) {
      const jpeg = await capture(declared, step, step === 'world' ? null : pair[0].draws.fov);
      ladder[step] = await score(reference, jpeg);
      writeFileSync(join(outDir, `${camera.name.replace(' ', '-')}-${step}.jpg`), jpeg);
    }
    writeFileSync(join(outDir, `${camera.name.replace(' ', '-')}-reference.jpg`), reference);
    for (const side of [today, declared]) await diagnose(side.page, { step: 'full', fov: null });
    evidence.cameras[camera.name] = { ssim: full, ladder, today: pair[0].draws, shardfile: pair[1].draws, residency, at: camera.at, look: camera.look };
    shots.push({ name: camera.name, today: file(0), shardfile: file(1), ssim: full, ladder,
      world: { today: join(outDir, `${camera.name.replace(' ', '-')}-reference.jpg`), shardfile: join(outDir, `${camera.name.replace(' ', '-')}-fov.jpg`) } });
    console.log(`${camera.name.padEnd(11)} SSIM ${full.toFixed(4)}  world ${ladder.world.toFixed(4)}  +fov ${ladder.fov.toFixed(4)}  -shadows ${ladder.shadows.toFixed(4)}  fov ${pair[0].draws.fov.toFixed(1)} vs ${pair[1].draws.fov.toFixed(1)}  draws ${pair[0].draws.calls} vs ${pair[1].draws.calls}  eye ${a.camera.join(',')} yaw ${a.yaw} vs ${b.camera.join(',')} yaw ${b.yaw}`);
  }
  evidence.errors = { today: today.errors, shardfile: declared.errors };
  writeFileSync(join(outDir, 'shots.json'), JSON.stringify(shots));
  execFileSync('python3', [join(here, 'compose.py'), join(outDir, 'shots.json'), join(here, 'board.jpg')], { stdio: 'inherit' });
  // the residual board: the ladder's +fov step (HUD and held items hidden, matched FOV, shadows on) — what is left to name
  writeFileSync(join(outDir, 'world.json'), JSON.stringify(shots.map((shot) => ({ name: shot.name, ...shot.world, ssim: shot.ladder.fov }))));
  execFileSync('python3', [join(here, 'compose.py'), join(outDir, 'world.json'), join(here, 'board-world.jpg'),
    'SF16 M1 residual: HUD + held items hidden, shardfile camera at today\'s FOV; today (left) vs shardfile (right), SSIM'], { stdio: 'inherit' });
  writeFileSync(join(here, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
} finally { await browser.close(); legacyServer.close(); clientServer.close(); }
