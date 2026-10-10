#!/usr/bin/env node
// Trusted SF72 metadata only: real native browser recipes remain the shipping source.
// scripts/browser-lane.sh node src/shards/far-reach/generators/bake-sky-physics.mjs --url=<clean candidate preview>
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { skyPhysicsInputs } from '../../../../scripts/sky-physics-inputs.mjs';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const url = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
if (url === undefined) throw new Error('bake-sky-physics requires a clean-candidate --url');
const revision = process.argv.find(arg => arg.startsWith('--revision='))?.slice(11)
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = await (await fetch(new URL('/version.json', url))).json();
if (typeof version.build !== 'string' || !version.build.startsWith(`${revision.slice(0, 7)}-`)) throw new Error(`Sky bake revision mismatch: ${JSON.stringify(version)} vs ${revision}`);
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=far-reach&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.debug.snapshot().farReach?.goats.length === 5 && !document.querySelector('.ws-load'), null, { timeout: 180000 });
  const capture = () => {
    const g = window.__wildshard.world.game, sky = g.app.debug.snapshot().farReach;
    for (const [name, value] of Object.entries(g.app.debug.snapshot())) if (name.startsWith('movers.') && typeof value?.showRest === 'function') value.showRest();
    const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
    const actors = [], add = (id, actor) => {
      if (!actor?.simSpec) throw new Error(`Missing native simulation spec: ${id}`);
      actors.push({ id, spec: copy(actor.simSpec), seed: actor.seed, scale: actor.scale });
    };
    sky.rays.forEach((actor, i) => add(`far.ray.${i}`, actor));
    sky.roostRays.forEach((actor, i) => add(`far.roost.${i}`, actor));
    sky.wisps.forEach((actor, i) => add(`far.wisp.${i}`, actor)); add('far.roc', sky.roc);
    sky.goats.forEach((actor, i) => add(`far.goat.${i}`, actor));
    // a piece whose `active` follows the rider's mode (the hover decks and the updraft collide only on the board) is
    // sampled both ways: `active` stays the on-foot state, `mode` names the one mode it collides in (SimHost.boardColliders)
    const player = window.__wildshard.world.player, riding = player.hover;
    const activeIn = (piece, hover) => { player.hover = hover; try { return piece.active?.() ?? true; } finally { player.hover = riding; } };
    const pieces = g.app.registry.pieceList().filter(piece => piece.colliders?.length > 0).map(piece => {
      const foot = activeIn(piece, false), board = activeIn(piece, true);
      const row = { id: piece.id, name: piece.name, category: piece.category, file: piece.file, colliders: copy(piece.colliders), active: foot };
      if (foot !== board) row.mode = board ? 'board' : 'foot';
      if (piece.surface !== undefined) row.surface = piece.surface;
      if (piece.colliderOwner !== undefined) row.colliderOwner = piece.colliderOwner;
      if (piece.follows !== undefined) {
        piece.follows.updateWorldMatrix(true, false);
        row.follows = { matrix: piece.follows.matrixWorld.toArray(), rotation: piece.followRotation !== false };
      }
      return row;
    });
    return { actors, pieces };
  };
  const first = await page.evaluate(capture), second = await page.evaluate(capture);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Native collision metadata changed between independent captures');
  if (errors.length > 0 || first.actors.length !== 13 || first.pieces.length === 0) throw new Error(`Invalid native Sky bake: ${JSON.stringify(errors)}`);
  const result = { version: 1, revision, build: version.build, profile: 'iPhone 16 Pro / phone / DPR2', inputs: skyPhysicsInputs(root), ...first };
  writeFileSync(resolve(root, 'src/shards/far-reach/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
  console.log(`bake-sky-physics: ${first.actors.length} native actors, ${first.pieces.length} collider pieces, exact repeated browser equality`);
  await context.close();
} finally { await browser.close(); }
