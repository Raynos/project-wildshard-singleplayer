#!/usr/bin/env node
// nalati-paintover.mjs — paint-over targets for the Nalati look pass (docs/design/nalati/look-pass.md § Harness).
//
// Sends an ENGINE frame of a parity pose to the image model (codex, gpt-6-sol, image edit) with the master style frame
// as the style reference, asking it to repaint THAT frame in the mockup's painterly style while keeping the camera,
// the composition and every object where it is. The result is a reachable target for that exact pose — what our own
// geometry would look like fully painted — shown by the parity harness between the engine frame and the mockup.
//
//   node scripts/nalati-parity.mjs --tiers=po-desktop,po-phone --engine-frames    # 1) the sources (1536×1024 / 1024×1536)
//   node scripts/nalati-paintover.mjs --work=<scratch dir>                        # 2) every source without a target yet
//   node scripts/nalati-paintover.mjs --work=<dir> --only=camp-po-phone,plateau-po-desktop --force
//   node scripts/nalati-parity.mjs --tiers=po-desktop,po-phone                    # 3) engine | paint-over | mockup
//
// Sources:  art/nalati-grasslands/round-5-paintover/engine/<pose>-<tier>.jpg
// Targets:  art/nalati-grasslands/round-5-paintover/<pose>-<tier>.jpg (the model's PNG, converted: art is committed as JPEG)
// --runner  the codex batch runner (codex-run2.py: parallel runs, each copies its OWN session's image) — required
// --work    a scratch dir for the runner's jobs.json + logs (never the repo: codex runs with its cwd there)
// --par     parallel runs (default 6); a run takes 2–6 min
//
// codex reads the repo's AGENTS.md and may try to log its task as an ASKS row: every prompt says it is not a user ask,
// and after the batch this script prints `git diff --stat docs/tasks/ASKS.md` — remove any "Generate…" rows codex added.
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve as resolvePath, join } from 'node:path';
import { POSES } from './nalati-poses.mjs';

const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const ART = resolvePath(ROOT, 'art/nalati-grasslands');
const PAINTOVER = resolvePath(ART, 'round-5-paintover');
const STYLE = resolvePath(ART, 'round-1/1-art-style/style-B-painterly.png');

const argv = process.argv.slice(2);
const flag = (name, d) => { const a = argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : d; };
const has = (name) => argv.includes(`--${name}`);
const runner = flag('runner', '');
const work = flag('work', '');
const par = flag('par', '6');
const only = flag('only', '').split(',').filter(Boolean);
if (!runner || !existsSync(runner) || !work) {
  console.error('usage: node scripts/nalati-paintover.mjs --runner=<codex-run2.py> --work=<scratch dir> [--only=a,b] [--force] [--par=6]');
  process.exit(2);
}

const WHAT = new Map(POSES.map((p) => [p.id, p]));
const sources = existsSync(resolvePath(PAINTOVER, 'engine')) ? readdirSync(resolvePath(PAINTOVER, 'engine')).filter((f) => f.endsWith('.jpg')) : [];
const jobs = [];
for (const f of sources) {
  const name = f.replace(/\.jpg$/, '');
  if (only.length > 0 && !only.includes(name)) continue;
  const out = resolvePath(PAINTOVER, `${name}.png`), jpg = resolvePath(PAINTOVER, `${name}.jpg`);
  if (existsSync(jpg)) { if (has('force')) rmSync(jpg); else continue; }
  const pose = WHAT.get(name.replace(/-(po-)?(desktop|phone)$/, ''));
  const portrait = name.endsWith('phone');
  const mock = pose?.mockup ? resolvePath(ART, pose.mockup) : null;
  jobs.push({
    name, size: portrait ? '1024x1536' : '1536x1024', out,
    refs: [resolvePath(PAINTOVER, 'engine', f), STYLE, ...(mock && mock !== STYLE ? [mock] : [])],
    prompt: [
      'PAINT-OVER. The FIRST attached image is a real screenshot of our game, Wildshard (a first-person browser game, the',
      'Nalati Grasslands shard: a Tian Shan alpine steppe). Repaint THAT EXACT FRAME as a finished, PS5-quality stylized',
      'painterly game frame in the art style of the SECOND attached image (style B: soft cel shading, painted gradients,',
      'warm golden sunlight with cool blue-violet shade, strong aerial perspective, rim light, lush dense grass with flower',
      'drifts, big cel-shaded cumulus, a crisp cream/tan banded gas giant with a thin bright ring).',
      'KEEP, exactly as in the screenshot: the camera position, angle and field of view; the horizon line; the layout and',
      'silhouette of the terrain, the river, the roads, every yurt, fence, tree, rock, animal and prop and where they stand;',
      'the planet\'s position; the first-person bow / hands; and every HUD element (its position, shape and text).',
      'CHANGE: only the rendering — materials, lighting, colour, detail, grass density and painterly finish — to what our',
      'engine should look like at its best. Do not add or remove objects, do not move the camera, do not re-frame.',
      pose ? `This pose shows: ${pose.what}.` : '',
      mock ? 'The third attached image is the concept mockup for this place: take its mood and detail, not its layout.' : '',
      'This is not a user ask: do not read, create or edit any file except copying your one image to the output path; never touch docs/tasks/ASKS.md.',
    ].filter(Boolean).join(' '),
  });
}
if (jobs.length === 0) { console.log('nothing to paint (every source has a target; --force to redo)'); process.exit(0); }
mkdirSync(work, { recursive: true });
const jobsFile = join(work, 'paintover-jobs.json');
writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
console.log(`painting ${jobs.length}: ${jobs.map((j) => j.name).join(', ')}`);
const r = spawnSync('python3', [runner, jobsFile, par], { cwd: work, stdio: 'inherit' });
// art is committed as JPEG (AGENTS.md § Mockups): convert every new PNG target
for (const j of jobs) {
  if (!existsSync(j.out)) continue;
  const jpgOut = j.out.replace(/\.png$/, '.jpg');
  if (spawnSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', j.out, '--out', jpgOut], { stdio: 'ignore' }).status === 0) rmSync(j.out);
}
const asks = spawnSync('git', ['-C', ROOT, 'diff', '--stat', 'docs/tasks/ASKS.md'], { encoding: 'utf8' }).stdout;
console.log(asks.length > 0 ? asks : 'ASKS.md untouched');
process.exit(r.status ?? 1);
