import { expect, it } from 'vitest';
import { BoxCollider } from '../../../src/sdk/physics';
import { frontRows, frontScene } from '../../../src/shards/nine-dragon-stack/generators/fronts';
import { fragmentColliders } from '../../../src/shards/nine-dragon-stack/world/colliders';
import { fragmentColliders as legacyColliders } from '../../../src/shards/nine-dragon-stack-legacy/world/colliders';
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
import { discoverGeneration, generateShardJob, generationInputs } from '../../../scripts/generate.mjs';

it('authors the exact frozen front boxes and actual registered piece without sharing runtime descriptors', () => {
  const rows = frontRows(), live = fragmentColliders(), old = legacyColliders();
  expect(rows).toStrictEqual(old.fronts);
  expect(live.fronts).toStrictEqual(rows);
  expect(live.floors).toStrictEqual(old.floors);
  expect(live.floors).toContain(live.square);
  const piece = baked.pieces.find(candidate => candidate.id === 'nds-fronts');
  expect(piece?.colliders).toStrictEqual(rows);
  const next = fragmentColliders();
  live.fronts.forEach((row, i) => expect(row).not.toBe(next.fronts[i]));
});

it('authors stable named SDK boxes and preserves the narrow east street offset', () => {
  const scene = frontScene();
  expect(scene.name).toBe('nds-fronts');
  expect(scene.children.map(row => row.name)).toEqual([
    'square-east-north', 'square-east-south', 'square-north', 'square-south',
    'street-west', 'street-east', 'street-end', 'stair-north', 'stair-south', 'stair-end',
  ]);
  for (const box of scene.children) expect(box).toBeInstanceOf(BoxCollider);
  expect(frontRows()[5]).toStrictEqual(legacyColliders().fronts[5]);
});

it('regenerates the front boxes in a Node tree with no runtime, game, engine or legacy sources', async () => {
  const root = process.cwd(), entry = 'src/shards/nine-dragon-stack/generators/fronts.ts';
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
      lib: { entry: resolve(stage, entry), formats: ['es'], fileName: () => 'fronts.mjs' },
      rolldownOptions: { platform: 'node', external: SDK_EXTERNALS },
    } });
    const source = `import { frontRows } from ${JSON.stringify(pathToFileURL(join(output, 'fronts.mjs')).href)}; console.log(JSON.stringify(frontRows()));`;
    const actual: unknown = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', cwd: stage, timeout: 5000 }));
    expect(actual).toStrictEqual(frontRows());
  } finally { rmSync(stage, { recursive: true, force: true }); }
});

it('cold-generates, restores and force-compares the ignored rows through the shared cache', async () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'nine-fronts');
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
    if (output === undefined) throw new Error('Missing front-row output');
    expect(JSON.parse(readFileSync(resolve(stage, output), 'utf8'))).toStrictEqual(frontRows());
    expect(cold.hit).toBe(false);
    expect(cold.hashes).toEqual(job.buildOutputs);
    const warm = await generateShardJob(stage, job, { cacheDir });
    expect(warm.hit).toBe(true);
    expect(warm.key).toBe(cold.key);
    const compared = await generateShardJob(stage, job, { cacheDir, forceCompare: true });
    expect(compared.hashes).toEqual(cold.hashes);
  } finally { rmSync(stage, { recursive: true, force: true }); }
});
