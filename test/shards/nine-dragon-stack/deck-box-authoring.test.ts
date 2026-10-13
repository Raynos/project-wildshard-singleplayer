import { expect, it } from 'vitest';
import { BoxCollider } from '../../../src/sdk/physics';
import { deckCapRows, deckCapScene } from '../../../src/shards/nine-dragon-stack/generators/portalFloors';
import { entryCapColliders, portalDeckColliders, squareFloor } from '../../../src/shards/nine-dragon-stack/world/floorRows';
import { entryCapColliders as legacyCaps, portalDeckColliders as legacyDeck, squareFloor as legacySquare } from '../../../src/shards/nine-dragon-stack-legacy/world/floorRows';
import baked from '../../../src/shards/nine-dragon-stack/data/physics.generated.json';
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

it('reuses exact authored deck/square floors and preserves all standalone-only cap boxes in native frame order', () => {
  const caps = deckCapRows();
  expect(entryCapColliders(false)).toStrictEqual([]);
  expect(entryCapColliders(true)).toStrictEqual(legacyCaps(true));
  expect(entryCapColliders(true)).toStrictEqual([...caps.north, ...caps.south, ...caps.east, ...caps.west]);
  expect(squareFloor()).toStrictEqual(legacySquare());
  for (const edge of ['north', 'east', 'south', 'west'] as const) {
    expect(portalDeckColliders(edge)).toStrictEqual(legacyDeck(edge));
    const piece = baked.pieces.find(row => 'colliderOwner' in row && row.colliderOwner === `deck.${edge}`);
    expect(piece?.colliders).toStrictEqual(portalDeckColliders(edge));
  }
  const floors = baked.pieces.find(row => row.id === 'nds-floors');
  expect(floors?.colliders.slice(-16)).toStrictEqual(entryCapColliders(true));
  const first = entryCapColliders(true), next = entryCapColliders(true);
  first.forEach((shape, index) => expect(shape).not.toBe(next[index]));
});

it('authors sixteen named SDK cap boxes without drawing deck geometry', () => {
  const scene = deckCapScene();
  expect(scene.children.map(row => row.name)).toEqual(['north', 'east', 'south', 'west']);
  expect(scene.children.flatMap(row => row.children)).toHaveLength(16);
  for (const group of scene.children) for (const box of group.children) expect(box).toBeInstanceOf(BoxCollider);
});

it('regenerates the deck caps in a Node tree with no runtime, game, engine or legacy sources', async () => {
  const root = process.cwd(), entry = 'src/shards/nine-dragon-stack/generators/portalFloors.ts';
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
      lib: { entry: resolve(stage, entry), formats: ['es'], fileName: () => 'portalFloors.mjs' },
      rolldownOptions: { platform: 'node', external: SDK_EXTERNALS },
    } });
    const source = `import { deckCapRows } from ${JSON.stringify(pathToFileURL(join(output, 'portalFloors.mjs')).href)}; console.log(JSON.stringify(deckCapRows()));`;
    const actual: unknown = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', cwd: stage, timeout: 5000 }));
    expect(actual).toStrictEqual(deckCapRows());
  } finally { rmSync(stage, { recursive: true, force: true }); }
});

it('cold-generates, restores and force-compares the ignored rows through the shared cache', async () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'nine-deck-caps');
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
    if (output === undefined) throw new Error('Missing cap-row output');
    expect(JSON.parse(readFileSync(resolve(stage, output), 'utf8'))).toStrictEqual(deckCapRows());
    expect(cold.hit).toBe(false);
    expect(cold.hashes).toEqual(job.buildOutputs);
    const warm = await generateShardJob(stage, job, { cacheDir });
    expect(warm.hit).toBe(true);
    expect(warm.key).toBe(cold.key);
    const compared = await generateShardJob(stage, job, { cacheDir, forceCompare: true });
    expect(compared.hashes).toEqual(cold.hashes);
  } finally { rmSync(stage, { recursive: true, force: true }); }
});
