#!/usr/bin/env node
// Trusted SF72 metadata only (Driftwood Isle): where the built page placed the quest's interactables, read off the live
// page so the renderer-free quest (src/shards/driftwood-isle/runtime/quest.ts) acts at the browser's own points. Captures
// every interactables-table row as the kit placed it (quest/interactables.ts `DRIFTWOOD_INTERACT`, through the adventure's
// `place`: the POI modules' anchors, the floors under them), with its prompt point; Wendell's talk point (his head) and
// radius; the iron sword's prompt point on the wreck's rack (its guarded radius at load); the reward spot the finale computed from the ring
// and the planet; and the sluice gate's collider as the registry built it. Two independent captures must match exactly.
// `inputs` hashes the sources the spots come from (scripts/driftwood-spots-inputs.mjs): the quest test refuses a stale bake.
// scripts/browser-lane.sh node src/shards/driftwood-isle/generators/bake-driftwood-spots.mjs --url=<clean candidate preview> [--revision=<sha>]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';
import { driftwoodSpotsInputs } from '../../../../scripts/driftwood-spots-inputs.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url');
if (url === undefined) throw new Error('bake-driftwood-spots requires a clean-candidate --url');
const revision = arg('revision') ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const version = await (await fetch(new URL('/version.json', url))).json();
if (typeof version.build !== 'string' || !version.build.startsWith(`${revision.slice(0, 7)}-`)) throw new Error(`Driftwood spots revision mismatch: ${JSON.stringify(version)} vs ${revision}`);
const errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=driftwood-isle&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const w = window.__wildshard?.world, snap = w?.game?.app?.debug?.snapshot?.();
    return (w?.animals?.animals ?? []).some(a => a.kind === 'sailor') && snap?.['driftwood.adventure']?.finale && !document.querySelector('.ws-load');
  }, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  const capture = () => {
    const w = window.__wildshard.world, snap = w.game.app.debug.snapshot(), adv = snap['driftwood.adventure'], shell = snap.driftwood;
    const rows = adv.kit.lives.map(lv => {
      // the barrel at its home (where the kit spawned its body), never where the body has settled since (it jitters by 1e-5)
      const d = lv.def, at = d.kind === 'barrel' ? lv.home : lv.position, row = { id: d.id, kind: d.kind, x: at.x, y: at.y, z: at.z, yaw: lv.yaw };
      if (lv.prompt) row.prompt = { x: lv.prompt.position.x, y: lv.prompt.position.y, z: lv.prompt.position.z };
      if (lv.collider && d.kind === 'door') row.collider = { x: lv.collider.x, z: lv.collider.z, hw: lv.collider.hw, hd: lv.collider.hd, rot: lv.collider.rot, yTop: lv.collider.yTop, yBottom: lv.collider.yBottom };
      return row;
    });
    // the two prompts that are not table rows, by their labels at load (the sword's while the sailor guards it)
    const prompts = shell.interactables.map(p => ({ label: p.label, x: p.position.x, y: p.position.y, z: p.position.z, radius: p.radius }));
    const talk = prompts.filter(p => p.label === 'Talk to Wendell'), sword = prompts.filter(p => /iron sword|guards the rack/u.test(p.label));
    if (talk.length !== 1 || sword.length !== 1) throw new Error(`Driftwood prompts: ${JSON.stringify(prompts.map(p => p.label))}`);
    const reward = adv.finale.rewardAt, pose = adv.finale.rewardPose, zip = adv.zipline;
    if (!pose || !zip?.lay?.spec) throw new Error('Driftwood reward/zipline capture port missing');
    const point = p => ({ x: p.x, y: p.y, z: p.z });
    const zipline = { top: point(zip.lay.spec.top), bottom: point(zip.lay.spec.bottom), sag: zip.lay.spec.sag ?? 1.6,
      prompt: { ...point(zip.prompt.position), radius: zip.prompt.radius } };
    return { rows, talk: talk[0], sword: sword[0], reward: { x: reward.x, y: reward.y, z: reward.z, yaw: pose.yaw, pitch: pose.pitch, phase: pose.phase }, zipline };
  };
  const first = await page.evaluate(capture), second = await page.evaluate(capture);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Driftwood spots changed between independent captures');
  if (errors.length > 0) throw new Error(`Invalid Driftwood spots bake: ${JSON.stringify(errors)}`);
  const result = { version: 1, revision, build: version.build, profile: 'iPhone 16 Pro / phone / DPR2', inputs: driftwoodSpotsInputs(root), ...first };
  writeFileSync(resolve(root, 'src/shards/driftwood-isle/runtime/spots.baked.json'), `${JSON.stringify(result, null, 1)}\n`);
  console.log(`bake-driftwood-spots: ${first.rows.length} table rows, the talk, the sword and the reward spot, exact repeated browser equality`);
  await context.close();
} finally { await browser.close(); }
