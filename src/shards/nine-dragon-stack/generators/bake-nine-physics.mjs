#!/usr/bin/env node
// Trusted SF72 metadata only (Nine Dragon Stack): the real native browser recipes remain the shipping source. Captures
// every registered piece's colliders at load exactly as the page built them: the fragment's floors and fronts, the five
// declared portal floors (deck.<edge> ×4, square), the Well's crossings, the Well safety cap with its `active` state, and
// every placed model's own colliders (balustrade, gate posts, banyan planter, stalls, market), and the Fei Zhua's dragon
// hooks (the ring centres its course bites, `nd.grapple`). Nine has no creature, so no actor is baked. Two independent same-page captures must match exactly.
// scripts/browser-lane.sh node src/shards/nine-dragon-stack/generators/bake-nine-physics.mjs --url=<clean candidate DEVSERVER preview> [--revision=<sha>]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ninePhysicsInputs } from '../../../../scripts/nine-physics-inputs.mjs';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const url = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
if (url === undefined) throw new Error('bake-nine-physics requires a clean-candidate --url');
const revision = process.argv.find(arg => arg.startsWith('--revision='))?.slice(11)
  ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = await (await fetch(new URL('/version.json', url))).json();
if (typeof version.build !== 'string' || !version.build.startsWith(`${revision.slice(0, 7)}-`)) throw new Error(`Nine bake revision mismatch: ${JSON.stringify(version)} vs ${revision}`);
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=nine-dragon-stack&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const pieces = window.__wildshard?.world?.game?.app?.registry?.pieceList() ?? [];
    return pieces.some(piece => piece.id === 'nds-crossings') && window.__wildshard?.shard?.['nd.grapple'] !== undefined && !document.querySelector('.ws-load');
  }, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  const capture = () => {
    const g = window.__wildshard.world.game;
    const copy = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
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
    const hooks = window.__wildshard.shard['nd.grapple'].hooks();
    return { pieces, hooks };
  };
  const first = await page.evaluate(capture), second = await page.evaluate(capture);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Native Nine metadata changed between independent captures');
  if (errors.length > 0 || first.pieces.length === 0 || first.hooks.length === 0) throw new Error(`Invalid native Nine bake: ${JSON.stringify(errors)}`);
  const result = { version: 1, revision, build: version.build, profile: 'iPhone 16 Pro / phone / DPR2', inputs: ninePhysicsInputs(root), ...first };
  writeFileSync(resolve(root, 'src/shards/nine-dragon-stack/runtime/physics.baked.json'), `${JSON.stringify(result)}\n`);
  const colliders = first.pieces.reduce((sum, piece) => sum + piece.colliders.length, 0);
  console.log(`bake-nine-physics: ${String(first.pieces.length)} collider pieces, ${String(colliders)} colliders, ${String(first.hooks.length)} hooks, exact repeated browser equality`);
  await context.close();
} finally { await browser.close(); }
