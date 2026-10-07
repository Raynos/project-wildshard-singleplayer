// Fresh parent comparisons for SF27. No stored parity baseline is written or accepted.
// node progress/shard-platform/SF27-parity.mjs --current=<sha> --parent=f40ec9d2d^ --out=<owned scratch>
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { capture, weatherLeak } from '../../scripts/parity.mjs';
import { browserPool } from '../../scripts/parity/pool.mjs';
import { compare } from '../../scripts/parity/compare.mjs';
import { aggregate, imageScore } from '../../scripts/parity/record.mjs';
import { array, object, string, get } from '../../scripts/parity/value.mjs';
import { saveFixture } from '../../scripts/debug-settings.mjs';
const ROOT = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const rev = (value) => execFileSync('git', ['rev-parse', `${value}^{commit}`], { cwd: ROOT, encoding: 'utf8' }).trim();
const current = rev(flag('current', 'HEAD')), parent = rev(flag('parent', 'f40ec9d2d^'));
const out = resolve(flag('out', `/private/tmp/claude-501/sp-builders/sp-x4/sf27-parity-${Date.now()}`));
mkdirSync(out, { recursive: true });
const shards = flag('shards', 'driftwood-isle').split(',');
const variants = flag('hybrid', 'off,on').split(',');
const tiers = flag('tiers', 'phone,desktop').split(',');
// G112 re-proofs compare the witnessed policy modes on each pin, independently of the director device row.
const groupModes = { parent: flag('parent-groups', 'legacy'), current: flag('current-groups', 'variant') };
const crowdModes = { parent: flag('parent-crowds', 'untracked'), current: flag('current-crowds', 'untracked') };
if (Object.values(crowdModes).some(value => !['untracked', 'legacy', 'variant', 'declared-default'].includes(value))) throw new Error('Invalid crowd witness mode');
const policyModes = { parent: flag('parent-policies', 'legacy'), current: flag('current-policies', 'variant') };
if (Object.values(policyModes).some(value => !['legacy', 'variant', 'declared-default'].includes(value))) throw new Error('Invalid ordinary policy witness mode');
if (Object.values(groupModes).some(value => !['legacy', 'variant', 'declared-default'].includes(value))) {
  throw new Error('--parent-groups/--current-groups must be legacy, variant or declared-default');
}
if (variants.some(value => !['off', 'on'].includes(value))) throw new Error('--hybrid must list off/on variants');
if (tiers.some(value => !['phone', 'desktop'].includes(value))) throw new Error('--tiers must list phone/desktop');
const pool = browserPool(ROOT, 1, 'metal'), records = {}, reports = [];
const start = Date.now();
// Activation is independently asserted above; the intentional implementation change is receipt metadata.
const gameplayRecord = (record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'activation'));
async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: out, env: { ...process.env, CLAUDE_CODE_SESSION_ID: `sp-x4-sf27-${process.pid}`, SERVE_BUILD_DIR: join(out, 'serve') }, stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = ''; child.stdout.on('data', (data) => { stdout += data; });
    child.on('error', reject); child.on('close', (code) => { if (code !== 0) reject(new Error(`${command} exited ${code}`)); else resolve(stdout.trim()); });
  });
}
try {
  for (const [label, sha] of [['parent', parent], ['current', current]]) {
    const url = await run(join(ROOT, 'scripts/serve-build.sh'), ['--rev', sha, '--name', `sf27-${label}`, '--hours', '1']);
    const base = String(url).replace(/\/$/u, '');
    try {
      const version = await (await fetch(`${base}/version.json`)).json();
      if (!JSON.stringify(version).includes(sha.slice(0, 7))) throw new Error('Preview identity mismatch');
      const browser = await pool.browser(0);
      for (const hybrid of variants) {
      let groupActivation = null;
      const policyActivation = new Map();
      const captureBrowser = {
        version: () => browser.version(),
        newContext: async (options) => {
          const context = await browser.newContext(options);
          await saveFixture(context, { scope: 'device', key: 'debug.plugin.driftwood-isle.driftwoodHybrid', data: hybrid });
          await saveFixture(context, { scope: 'device', key: 'debug.plugin.nalati-grasslands.shardDirectors', data: hybrid });
          for (const slug of ['far-reach', 'sunscar-dunes']) await saveFixture(context, { scope: 'device', key: `debug.plugin.${slug}.shardDirectors`, data: hybrid });
          const newPage = context.newPage.bind(context);
          context.newPage = async () => {
            const page = await newPage(), wait = page.waitForFunction.bind(page);
            page.waitForFunction = async (...args) => {
              const result = await wait(...args);
              const observed = await page.evaluate(() => {
                const probe = window.__wildshard;
                if (probe?.shard?.slug !== 'nalati-grasslands') return null;
                const wildlife = probe.shard.wildlife;
                if (!wildlife?.packs?.length || !wildlife?.herds?.length) return null;
                return { packs: wildlife.packs.map(policy => ({ members: policy.members.map(actor => actor.entityId), declared: typeof policy.snapshot === 'function' })),
                  herds: wildlife.herds.map(policy => ({ members: policy.members.map(actor => actor.entityId), declared: typeof policy.snapshot === 'function' })),
                  flocks: (wildlife.flocks ?? []).map(view => ({ count: view.n, declared: typeof view.controller?.snapshot === 'function' })),
                  saved: JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}').keys?.['debug.plugin.nalati-grasslands.shardDirectors']?.data };
              });
              if (observed !== null) groupActivation = observed;
              const ordinary = await page.evaluate(() => {
                const shard = window.__wildshard?.shard;
                if (!shard || !['far-reach', 'sunscar-dunes'].includes(shard.slug)) return null;
                const plugin = shard[shard.slug === 'far-reach' ? 'farReach' : 'sunscar'];
                return { slug: shard.slug, available: typeof plugin?.brainWitness === 'function',
                  actors: typeof plugin?.brainWitness === 'function' ? plugin.brainWitness() : [],
                  saved: JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}').keys?.[`debug.plugin.${shard.slug}.shardDirectors`]?.data };
              });
              if (ordinary !== null) {
                const previous = policyActivation.get(ordinary.slug);
                const actors = new Map((previous?.actors ?? []).map(actor => [actor.id, actor]));
                for (const actor of ordinary.actors) if (!actors.has(actor.id) || actor.family !== null) actors.set(actor.id, actor);
                policyActivation.set(ordinary.slug, { ...ordinary, actors: [...actors.values()] });
              }
              return result;
            };
            return page;
          };
          return context;
        },
      };
      for (const setting of ['off']) for (const shard of shards) for (const tier of tiers) {
        const folder = join(out, `${label}-${hybrid}-${setting}-${shard}-${tier}`); mkdirSync(folder, { recursive: true });
        const opts = { shard, tier, lane: 'm5', sha, root: ROOT, out: folder, timeout: 240, full: true, only: undefined, offline: false, accelerated: true, settings: { memorySaver: setting } };
        groupActivation = null;
        policyActivation.delete(shard);
        const record = await capture(captureBrowser, base, opts);
        if (shard === 'driftwood-isle') {
          const installed = Object.values(object(get(record, 'boot.systems'))).flat();
          if (installed.includes('shard.driftwood.movers') !== (hybrid === 'on')) throw new Error(`Hybrid activation witness failed: ${label}/${hybrid}/${tier}`);
          record.activation = { hybrid, system: 'shard.driftwood.movers', present: hybrid === 'on', brainBindingProof: 'test/shards/driftwood-isle/brain-binding.test.ts' };
        }
        if (shard === 'nalati-grasslands') {
          const mode = groupModes[label], expected = mode === 'declared-default' || (mode === 'variant' && hybrid === 'on');
          if (groupActivation === null || groupActivation.saved !== hybrid || [...groupActivation.packs, ...groupActivation.herds].some(policy => policy.declared !== expected)) {
            throw new Error(`Nalati group activation witness failed: ${label}/${hybrid}/${tier}: ${JSON.stringify(groupActivation)}`);
          }
          const crowdMode = crowdModes[label], crowdExpected = crowdMode === 'declared-default' || (crowdMode === 'variant' && hybrid === 'on');
          const installed = Object.values(object(get(record, 'boot.systems'))).flat(), crowdPresent = installed.includes('shard.nalati.wildlife.declared');
          if (crowdMode !== 'untracked' && (crowdPresent !== crowdExpected || !groupActivation.flocks.length
            || groupActivation.flocks.some(view => view.declared !== crowdExpected))) throw new Error(`Nalati crowd activation witness failed: ${label}/${hybrid}/${tier}: ${JSON.stringify(groupActivation)}`);
          record.activation = { deviceKey: 'debug.plugin.nalati-grasslands.shardDirectors', ...groupActivation,
            ...(crowdMode !== 'untracked' ? { crowdExpected, crowdSystemPresent: crowdPresent } : {}) };
        }
        if (['far-reach', 'sunscar-dunes'].includes(shard)) {
          const mode = policyModes[label], expected = mode === 'declared-default' || (mode === 'variant' && hybrid === 'on');
          const observed = policyActivation.get(shard), families = shard === 'far-reach'
            ? { skyGoat: 'ram-grazer', driftRay: 'orbit-diver', galeWisp: 'burst-flyer' }
            : { duneStrider: 'challenge-grazer', duneRay: 'patrol-diver' };
          if (observed === undefined || observed.saved !== hybrid || (mode !== 'legacy' && !observed.available)
            || (expected && Object.entries(families).some(([kind, family]) => !observed.actors.some(actor => actor.kind === kind && actor.family === family)))
            || (!expected && observed.actors.some(actor => actor.family !== null))) throw new Error(`Ordinary policy activation failed: ${label}/${hybrid}/${shard}/${tier}: ${JSON.stringify(observed)}`);
          record.activation = { deviceKey: `debug.plugin.${shard}.shardDirectors`, expected, ...observed };
        }
        if (['pine-hollow', 'nalati-grasslands'].includes(shard)) object(record.leak).weather = await weatherLeak(captureBrowser, base, opts);
        const key = `${hybrid}/${setting}/${shard}/${tier}`;
        records[`${label}/${key}`] = record;
        writeFileSync(join(folder, 'capture.json'), JSON.stringify(record, null, 2) + '\n');
        console.log(`SF27 captured ${label}/${key}`);
      }
      }
    } finally { await pool.release(0); await run(join(ROOT, 'scripts/serve-build.sh'), ['stop', new URL(base).port]); }
  }
  const browser = await pool.browser(0), context = await browser.newContext(), scorePage = await context.newPage();
  try {
    for (const hybrid of variants) for (const setting of ['off']) for (const shard of shards) for (const tier of tiers) {
      const key = `${hybrid}/${setting}/${shard}/${tier}`;
      const baseline = await aggregate(scorePage, [gameplayRecord(records[`parent/${key}`])], { sha: parent, browser: browser.version() });
      const record = records[`current/${key}`], images = [];
      for (const pose of array(record.poses)) {
        const p = object(pose), name = string(p.name), before = object(object(baseline.poses)[name]);
        const masks = [...array(before.boxes), ...array(p.boxes)];
        const score = await imageScore(scorePage, string(before.shot), string(p.shot), masks);
        p.ssim = score.ssim; images.push({ name, ssim: score.ssim, full: score.full, masked: score.masked, note: score.note });
      }
      // Existing approved ambient information entry, also used by the main parity harness.
      const parentCrowd = records[`parent/${key}`].activation?.crowdSystemPresent, currentCrowd = record.activation?.crowdSystemPresent;
      const renames = typeof parentCrowd === 'boolean' && typeof currentCrowd === 'boolean' && parentCrowd !== currentCrowd
        ? [{ systems: { [parentCrowd ? 'shard.nalati.wildlife.declared' : 'shard.nalati.wildlife']: currentCrowd ? 'shard.nalati.wildlife.declared' : 'shard.nalati.wildlife' } }] : [];
      const result = compare(baseline, gameplayRecord(record), { ambientInfo: ['forest.thrall'], renames });
      reports.push({ hybrid, setting, shard, tier, verdict: result.verdict, images, differences: result.rows.filter((r) => r.verdict === 'red' || r.verdict === 'new'), checks: result.rows.filter((r) => r.class === 'D'), parent: records[`parent/${key}`], current: record });
      console.log(`SF27 ${key}: ${result.verdict}, images ${images.map((i) => `${i.name}=${i.ssim}`).join(', ')}`);
    }
  } finally { await context.close(); }
  const record = { row: 'SF27', parent, current, tiers, groupModes, policyModes, crowdModes, hybridDebugFixtures: variants, when: new Date().toISOString(), elapsedSeconds: (Date.now() - start) / 1000,
    method: 'Fresh pinned parent and current captures using scripts/parity.mjs capture()/weatherLeak(), compare(), aggregate() and masked imageScore(). Memory saver OFF. Metal poses, full walk/combat/pause/resume/unload; seeded accelerated clock. No stored baseline writes. Phone tier is emulated Chromium, not Safari.',
    ambientInfo: ['forest.thrall'], reports };
  writeFileSync(join(out, 'SF27-parity.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(`Report ${join(out, 'SF27-parity.json')}`);
  if (reports.some((report) => report.verdict !== 'green')) process.exitCode = 2;
} finally { await pool.close(); }
