#!/usr/bin/env node
// Trusted SF72 metadata only (Signal Dunes): the real native browser recipes remain the shipping source. Captures the
// 13 declared homes' model-derived simulation specs (the strider's height comes from its fitted GLB), seeds and scales,
// the Matriarch's spec once play summons her (the quest's own actions, then the player walks into her basin), and every
// native collider piece, and the quest's interaction spots and crack targets. Two independent same-page captures must
// match exactly.
// scripts/browser-lane.sh node src/shards/sunscar-dunes/generators/bake-signal-physics.mjs --url=<clean candidate preview> [--revision=<sha>]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { signalPhysicsInputs } from '../../../../scripts/signal-physics-inputs.mjs';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const url = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
if (url === undefined) throw new Error('bake-signal-physics requires a clean-candidate --url');
const revision = process.argv.find(arg => arg.startsWith('--revision='))?.slice(11)
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = await (await fetch(new URL('/version.json', url))).json();
// the build id leads with the short revision git chose (7 or more hex digits)
const built = typeof version.build === 'string' ? version.build.split('-')[0] ?? '' : '';
if (built.length < 7 || !revision.startsWith(built)) throw new Error(`Signal bake revision mismatch: ${JSON.stringify(version)} vs ${revision}`);
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=sunscar-dunes&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const homes = window.__wildshard?.world?.game?.app?.debug.snapshot().sunscar?.creatures?.homes;
    return homes?.length === 13 && homes.every(home => home.animal !== null) && !document.querySelector('.ws-load');
  }, null, { timeout: 180000 });
  const capture = () => {
    const g = window.__wildshard.world.game, signal = g.app.debug.snapshot().sunscar;
    const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
    const actors = signal.creatures.homes.map(home => {
      const actor = home.animal;
      if (!actor?.simSpec) throw new Error(`Missing native simulation spec: ${home.id}`);
      return { id: home.id, kind: home.kind, spec: copy(actor.simSpec), seed: actor.seed, scale: actor.scale };
    });
    const pieces = g.app.registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
      const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file, colliders: copy(piece.colliders), active: piece.active?.() ?? true };
      if (piece.surface !== undefined) row.surface = piece.surface;
      if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
      if (piece.follows !== undefined) {
        piece.follows.updateWorldMatrix(true, false);
        row.follows = { matrix: piece.follows.matrixWorld.toArray(), rotation: piece.followRotation !== false };
      }
      return row;
    });
    // The quest's interaction spots and crack targets, as the built world placed them (world/build.ts order).
    const places = window.__wildshard.world.game.app.debug.snapshot().sunscar.places;
    const spot = (id, p, radius) => ({ id, x: p.x, y: p.y, z: p.z, radius });
    const spots = { interact: [spot('logbook', places.logbook.position, places.logbook.radius), spot('well', places.well.spot.position, places.well.spot.radius),
      ...places.braziers.map((b, i) => spot(`brazier.${i}`, b.spot.position, b.spot.radius)), spot('fire', places.fire.brazier.position, places.fire.brazier.radius)],
    crack: places.crackables.map((c, i) => spot(i === 0 ? 'well.crank' : `brazier.${i - 1}`, c.at, c.radius)) };
    return { actors, pieces, spots };
  };
  const first = await page.evaluate(capture), second = await page.evaluate(capture);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Native Signal metadata changed between independent captures');
  if (errors.length > 0 || first.actors.length !== 13 || first.pieces.length === 0) throw new Error(`Invalid native Signal bake: ${JSON.stringify(errors)}`);
  // The Matriarch's body exists only in her fight: play's own steps light the signal, then the player walks into her basin.
  await page.evaluate(() => {
    const signal = window.__wildshard.world.game.app.debug.snapshot().sunscar;
    signal.stage('waymarks-lit'); signal.fire.light();
    window.__wildshard.world.player.spawn(-14, -150 + 40, Math.PI);
  });
  await page.waitForFunction(() => (window.__wildshard.world.game.app.debug.snapshot().sunscar?.matriarch?.body() ?? null) !== null, null, { timeout: 60000 });
  const boss = await page.evaluate(() => {
    const signal = window.__wildshard.world.game.app.debug.snapshot().sunscar, actor = signal.matriarch.body();
    return { id: 'sunscar.matriarch', kind: actor.kind, spec: structuredClone(actor.simSpec) };
  });
  if (errors.length > 0 || boss.kind !== 'duneMatriarch' || !(boss.spec.hp > 0)) throw new Error(`Invalid native Matriarch bake: ${JSON.stringify(errors)}`);
  const result = { version: 1, revision, build: version.build, profile: 'iPhone 16 Pro / phone / DPR2', inputs: signalPhysicsInputs(root), ...first, bosses: [boss] };
  writeFileSync(resolve(root, 'src/shards/sunscar-dunes/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
  console.log(`bake-signal-physics: ${first.actors.length} native homes + Matriarch spec, ${first.pieces.length} collider pieces, exact repeated browser equality`);
  await context.close();
} finally { await browser.close(); }
