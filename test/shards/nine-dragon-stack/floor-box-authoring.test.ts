import { expect, it } from 'vitest';
import { BoxCollider } from '../../../src/sdk/physics';
import { floorBoxRows, floorBoxScene } from '../../../src/shards/nine-dragon-stack/generators/floorBoxes';
import { fragmentColliders, fragmentGrappleGuard } from '../../../src/shards/nine-dragon-stack/world/colliders';
import { fragmentColliders as legacyColliders, fragmentGrappleGuard as legacyGuard } from '../../../src/shards/nine-dragon-stack-legacy/world/colliders';
import baked from '../../../src/shards/nine-dragon-stack/runtime/physics.baked.json';
// oxlint-disable-next-line import/no-nodejs-modules -- Executes the compiled authoring source in plain Node.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Owns and deletes a source-only compilation stage.
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolves only the audited authoring files in the test checkout.
import { dirname, join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Selects the current Node executable and test checkout.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Imports the emitted ESM product in the Node child.
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { auditAuthoringInputs } from '../../../scripts/authoring-inputs.mjs';
import { linkNodeModules } from '../../../scripts/link-node-modules.mjs';
import { SDK_EXTERNALS } from '../../../scripts/sdk-externals.mjs';
import { floorBoxes } from '../../../src/shards/nine-dragon-stack/world/boxRows';
import { discoverGeneration, generateShardJob, generationInputs } from '../../../scripts/generate.mjs';

it('retains every frozen floor/front/guard descriptor and the actual registered ownership', () => {
  const live = fragmentColliders(), old = legacyColliders(), rows = floorBoxRows();
  expect(live.floors).toStrictEqual(old.floors);
  expect(live.fronts).toStrictEqual(old.fronts);
  expect(live.floors).toContain(live.square);
  expect(fragmentGrappleGuard()).toStrictEqual(legacyGuard());
  expect(rows.well).toStrictEqual(old.floors.slice(-5));
  expect(rows.guard).toStrictEqual(legacyGuard());
  for (const [name, shapes] of Object.entries(rows)) {
    expect(floorBoxes(name === 'street' || name === 'stairTop' || name === 'well' || name === 'stairLandings' ? name : 'guard')).toStrictEqual(shapes);
  }
  const guard = baked.pieces.find(row => row.id === 'nds-grapple-guard');
  expect(guard?.colliders).toStrictEqual(rows.guard);
  expect(guard?.follows).toStrictEqual({ matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], rotation: true });
  const first = floorBoxes('well'), next = floorBoxes('well');
  first.forEach((shape, index) => expect(shape).not.toBe(next[index]));
});

it('uses named SDK objects in the five original groups and never replaces the tread primitive', () => {
  const scene = floorBoxScene();
  expect(scene.children.map(row => row.name)).toEqual(['street', 'stairTop', 'well', 'stairLandings', 'guard']);
  expect(scene.children.flatMap(row => row.children)).toHaveLength(11);
  for (const group of scene.children) for (const box of group.children) expect(box).toBeInstanceOf(BoxCollider);
  expect(fragmentColliders().floors.filter(row => row.kind === 'treads')).toStrictEqual(legacyColliders().floors.filter(row => row.kind === 'treads'));
});

it('regenerates the floor boxes in a Node tree with no runtime, game, engine or legacy sources', async () => {
  const root = process.cwd(), entry = 'src/shards/nine-dragon-stack/generators/floorBoxes.ts';
  const audit = auditAuthoringInputs(root, 'nine-dragon-stack', entry);
  expect(audit.issues).toEqual([]);
  const cache = resolve('node_modules/.cache'); mkdirSync(cache, { recursive: true });
  const stage = realpathSync(mkdtempSync(join(cache, 'nine-authoring-')));
  try {
    for (const file of [...audit.files, ...Object.keys(generationInputs(root, ['src/format'])), 'src/sdk/package.json']) {
      const target = resolve(stage, file); mkdirSync(dirname(target), { recursive: true });
      copyFileSync(resolve(root, file), target);
    }
    linkNodeModules(root, stage);
    const output = resolve(stage, 'compiled');
    await build({ root: stage, configFile: false, publicDir: false, logLevel: 'silent', build: {
      outDir: output, emptyOutDir: true, minify: false,
      lib: { entry: resolve(stage, entry), formats: ['es'], fileName: () => 'floorBoxes.mjs' },
      rolldownOptions: { platform: 'node', external: SDK_EXTERNALS },
    } });
    const source = `import { floorBoxRows } from ${JSON.stringify(pathToFileURL(join(output, 'floorBoxes.mjs')).href)}; console.log(JSON.stringify(floorBoxRows()));`;
    const actual: unknown = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', cwd: stage, timeout: 5000 }));
    expect(actual).toStrictEqual(floorBoxRows());
  } finally { rmSync(stage, { recursive: true, force: true }); }
});

it('cold-generates, restores and force-compares the ignored rows through the shared cache', async () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'nine-floor-boxes');
  if (job === undefined) throw new Error('Missing Nine portal-floor generation job');
  const cache = resolve('node_modules/.cache'); mkdirSync(cache, { recursive: true });
  const stage = realpathSync(mkdtempSync(join(cache, 'nine-floors-cache-'))), cacheDir = join(stage, 'cache');
  try {
    for (const file of [...Object.keys(generationInputs(root, job.inputRoots)), ...Object.keys(generationInputs(root, ['src/format'])), 'scripts/generation-jobs.json']) {
      const target = resolve(stage, file); mkdirSync(dirname(target), { recursive: true });
      copyFileSync(resolve(root, file), target);
    }
    linkNodeModules(root, stage);
    const cold = await generateShardJob(stage, job, { cacheDir, restore: true });
    const output = job.outputs[0];
    if (output === undefined) throw new Error('Missing floor-box-row output');
    expect(JSON.parse(readFileSync(resolve(stage, output), 'utf8'))).toStrictEqual(floorBoxRows());
    expect(cold.hit).toBe(false);
    expect(cold.hashes).toEqual(job.buildOutputs);
    const warm = await generateShardJob(stage, job, { cacheDir });
    expect(warm.hit).toBe(true);
    expect(warm.key).toBe(cold.key);
    const compared = await generateShardJob(stage, job, { cacheDir, forceCompare: true });
    expect(compared.hashes).toEqual(cold.hashes);
  } finally { rmSync(stage, { recursive: true, force: true }); }
});
