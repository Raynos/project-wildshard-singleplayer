#!/usr/bin/env node
// Trusted SF72 metadata only (Pine Hollow): where the built page placed the Warden's Hollow quest's prompts, read off the
// live page so the renderer-free quest (src/shards/pine-hollow/runtime/quest.ts) acts at the browser's own points. Captures
// the quest's interactables-table rows (quest/table.ts: the dam's two logs, the sluice, the pond glass, the ridge flint) as
// the kit placed them with their prompt points; Hale's talk point (his head) and radius; the three waystone lanterns'
// prompts; the zipline's launch prompt, its cable ends and its landing; and the lever-action's pickup in the ranger's cabin.
// Two independent captures must match exactly.
// scripts/browser-lane.sh node scripts/bake-pine-spots.mjs --url=<clean candidate preview> [--revision=<sha>]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { saveFixture } from './debug-settings.mjs';

const root = resolve(import.meta.dirname, '..');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url');
if (url === undefined) throw new Error('bake-pine-spots requires a clean-candidate --url');
const revision = arg('revision') ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = await (await fetch(new URL('/version.json', url))).json();
if (typeof version.build !== 'string' || !version.build.startsWith(`${revision.slice(0, 7)}-`)) throw new Error(`Pine spots revision mismatch: ${JSON.stringify(version)} vs ${revision}`);
const ROWS = ['dam-log-a', 'dam-log-b', 'dam-sluice', 'pond-glass', 'ridge-flint'];
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const q = window.__pineQuest;
    return q?.zip && q.people?.length === 3 && (window.__wildshard?.world?.interactables ?? []).some(p => p.label === 'Take the lever-action') && !document.querySelector('.ws-load');
  }, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  const capture = rows => {
    const q = window.__pineQuest, xyz = p => ({ x: p.x, y: p.y, z: p.z });
    const kit = rows.map(id => {
      const lv = q.kit.lives.find(l => l.def.id === id);
      if (lv === undefined) throw new Error(`Pine kit has no row ${id}`);
      return { id, kind: lv.def.kind, ...xyz(lv.position), yaw: lv.yaw, prompt: lv.prompt ? xyz(lv.prompt.position) : null };
    });
    const ranger = q.people.find(p => p.kind === 'ranger');
    const lanterns = Object.fromEntries(['pond', 'ridge', 'den'].map(id => [id, { ...xyz(q.lanterns[id].position), radius: q.lanterns[id].radius }]));
    const zip = q.zip;
    const rifle = window.__wildshard.world.interactables.filter(p => p.label === 'Take the lever-action');
    if (rifle.length !== 1) throw new Error('Pine has one lever-action pickup');
    return {
      rows: kit, talk: { ...xyz(ranger.prompt.position), radius: ranger.prompt.radius }, lanterns,
      zip: { prompt: { ...xyz(zip.prompt.position), radius: zip.prompt.radius }, top: xyz(zip.top), bottom: xyz(zip.bottom), landing: xyz(zip.landing) },
      rifle: { ...xyz(rifle[0].position), radius: rifle[0].radius },
    };
  };
  const first = await page.evaluate(capture, ROWS), second = await page.evaluate(capture, ROWS);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Pine spots changed between independent captures');
  if (errors.length > 0) throw new Error(`Invalid Pine spots bake: ${JSON.stringify(errors)}`);
  const result = { version: 1, revision, build: version.build, profile: 'iPhone 16 Pro / phone / DPR2', ...first };
  writeFileSync(resolve(root, 'src/shards/pine-hollow/runtime/spots.baked.json'), `${JSON.stringify(result, null, 1)}\n`);
  console.log(`bake-pine-spots: ${first.rows.length} table rows, Hale, three lanterns, the zipline and the lever-action, exact repeated browser equality`);
  await context.close();
} finally { await browser.close(); }
