// Run through browser-lane.sh against an immutable serve-build.sh --rev preview.
import { chromium, devices } from 'playwright';
import * as v from 'valibot';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { installInit } from '../parity/init.mjs';
import { poseAt, advance } from '../parity/frames.mjs';
import { fixedWorldFrame } from '../parity/fixed-render.mjs';
import { readParityFrame } from '../parity/frame-bytes.mjs';
import { developerSettings, saveFixture } from '../debug-settings.mjs';
import { loadingCardIndex } from '../loading-benchmark/catalogue.mjs';

/** @param {string} name */
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = arg('url'), candidate = arg('candidate'), mode = arg('mode') ?? 'shardfile';
if (mode !== 'legacy' && mode !== 'shardfile') throw new Error('Requires --mode=legacy|shardfile');
if (!url) throw new Error('Requires --url=URL [--candidate=URL --slug=SLUG --pose=P1 --out=tmp/...]');
/** @type {typeof readParityFrame<ReturnType<typeof fixedWorldFrame>>} */
const readWorldFrame = readParityFrame;
const out = resolve(arg('out') ?? 'tmp/exact-world-capture');
const D = Math.PI / 180;
const sets = [
  { slug: 'nine-dragon-stack', poses: [
    { name: 'P1', x: .95, y: 125, z: 7.5, yaw: -12*D, pitch: -4*D },
    { name: 'P2', x: .95, y: 125, z: 7.5, yaw: -12*D, pitch: 35*D },
    { name: 'P3', x: -10, y: 107, z: -25.4, yaw: -90*D, pitch: 30*D },
    { name: 'P4', x: 76, y: 146, z: 6, yaw: 90*D, pitch: -10*D },
    { name: 'P5', x: 76, y: 146, z: 6, yaw: -90*D, pitch: 4*D },
  ] },
  { slug: 'pine-hollow', poses: [
    { name: 'P1', x: 0, z: -235, yaw: Math.PI, pitch: 0 },
    { name: 'P2', x: 0, z: -200, yaw: Math.PI, pitch: 0 },
    { name: 'P3', x: 0, z: -28, yaw: Math.PI, pitch: 0 },
    { name: 'P4', x: 0, z: -28, yaw: Math.PI/2, pitch: -4*D },
  ] },
  { slug: 'driftwood-isle', poses: [{ name: 'P1', x: 100, z: 1, yaw: -Math.PI/2, pitch: -.05 }] },
].filter(set => !arg('slug') || arg('slug') === set.slug).map(set => ({ slug: set.slug, poses: set.poses.filter(pose => !arg('pose') || arg('pose') === pose.name) }));
if (!sets.some(set => set.poses.length)) throw new Error('No requested capture pose');
mkdirSync(out, { recursive: true });
const version = v.parse(v.object({build:v.string()}), await (await fetch(new URL('version.json', url))).json());
/** @type {(Omit<ReturnType<typeof fixedWorldFrame>,'data'> & {repeat:number,slug:string,pose:string,pixels:string,file:string})[]} */
const rows = [];
/** @type {{kind:'AA'|'AB',slug:string,pose:string,pixels:number}[]} */
const differences = [];
/** @type {{repeat:number,url:string,build:string}[]} */
const builds = [];
const result = { mode, builds, protocol: 'M3 world only; no post/viewmodel; Metal iPhone 16 Pro DPR2; fixed uniform time10; fresh-context seeded A/A; GL_DITHER off; serial GPU draw completion; full RGBA exact', build: version.build, candidate: candidate ?? null, rows, differences };
const save = () => writeFileSync(join(out, 'reading.json'), JSON.stringify(result, null, 2));
const device = devices['iPhone 16 Pro'];
if (device === undefined) throw new Error('Missing maintained phone preset');
/** @template T @param {string} phase @param {()=>Promise<T>} run @returns {Promise<T>} */
async function bounded(phase, run) {
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let timer;
  try {
    return await Promise.race([run(), new Promise((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error(`Fixed world capture stalled: ${phase}`)); }, 30000);
    })]);
  } finally { clearTimeout(timer); }
}
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  for (const [repeat, sourceUrl] of [url,url,...(candidate === undefined ? [] : [candidate])].entries()) for (const {slug, poses} of sets) {
    if (poses.length === 0) continue;
    const sourceVersion = v.parse(v.object({build:v.string()}), await (await fetch(new URL('version.json', sourceUrl))).json());
    if (repeat === 1 && sourceVersion.build !== version.build) throw new Error('A/A source changed');
    builds.push({repeat,url:sourceUrl,build:sourceVersion.build});
    const context = await browser.newContext({ ...device, viewport: {width:402,height:874}, deviceScaleFactor: 2 });
    try {
      await installInit(context, { lane: 'exact-world-capture', sha: sourceVersion.build, browser: 'chromium', capture: 30, tier: 'phone' });
      await developerSettings(context, { tier: 'phone', volume: 0, time: 'midday' });
      await saveFixture(context, {scope:'global',key:'gfx',data:{dpr:'2',aa:'auto'}});
      await saveFixture(context, {scope:'device',key:'debug.global.legacyShardButtons',data:'on'});
      /** @type {string[]} */
      const errors = [];
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      console.log(`${repeat} ${slug} entry`);
      await page.goto(sourceUrl, {waitUntil:'load'}); await page.locator('.ws-main-select').click();
      const names = await page.locator('.ws-menu-card b').allTextContents();
      await page.locator(`.ws-menu-dots i[data-i="${loadingCardIndex(names, slug)}"]`).click();
      const dual = await page.locator('.ws-menu-shardfile').isVisible();
      if (mode === 'legacy' && !dual) throw new Error(`No legacy entry for ${slug}`);
      await page.locator(mode === 'shardfile' && dual ? '.ws-menu-shardfile' : '.ws-menu-play').click();
      await page.waitForFunction(() => window.__wildshard?.world?.hud?.entered && !document.querySelector('.ws-load'), undefined, {timeout:240000});
      if (!(await page.evaluate(() => window.__wildshard.requireWorld().game.level.id)).includes(slug)) throw new Error('Wrong captured world');
      for (const pose of poses) {
        await bounded(`${slug}/${pose.name}/pose`, async () => { await poseAt(page, pose); await advance(page, 90); });
        const file = join(out, `${repeat}-${slug}-${pose.name}.rgba`);
        const frame = await bounded(`${slug}/${pose.name}/readback`, async () => readWorldFrame(page, await page.evaluateHandle(fixedWorldFrame, pose), file));
        const bytes = readFileSync(file);
        let lit = 0; for (let at = 0; at < bytes.length; at += 4) if (bytes[at] + bytes[at+1] + bytes[at+2] > 0) lit++;
        if (lit === 0) throw new Error('Empty world image');
        const pixels = createHash('sha256').update(bytes).digest('hex');
        result.rows.push({repeat,slug,pose:pose.name,...frame,pixels,file}); save();
        console.log(`${repeat} ${slug}/${pose.name} ${frame.calls} draws ${frame.triangles} tris frame${frame.frame} ${pixels.slice(0,12)}`);
      }
      errors.push(...await page.evaluate(() => window.__wildshardHarness?.errors ?? []));
      if (errors.length > 0) throw new Error(`Native page errors: ${JSON.stringify(errors)}`);
    } finally { await context.close(); }
  }
  for (const row of result.rows.filter(item => item.repeat === 0)) {
    for (const repeat of candidate === undefined ? [1] : [1,2]) {
    const next = result.rows.find(other => other.repeat === repeat && other.slug === row.slug && other.pose === row.pose);
    if (!next) throw new Error('Missing independent A/A capture');
    const a = readFileSync(row.file), b = readFileSync(next.file);
    if (a.length !== b.length) throw new Error('Readback dimensions changed');
    let pixels = 0; for (let at = 0; at < a.length; at += 4) if (a[at] !== b[at] || a[at+1] !== b[at+1] || a[at+2] !== b[at+2] || a[at+3] !== b[at+3]) pixels++;
    result.differences.push({kind:repeat===1?'AA':'AB',slug:row.slug,pose:row.pose,pixels});
    }
  }
  save();
  if (result.differences.some(row => row.pixels !== 0)) throw new Error('World AA/AB pixel mismatch; inspect reading.json');
} finally { await browser.close(); }
