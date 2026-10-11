import { expect, it } from 'vitest';
import { BoxCollider } from '../../../src/sdk/physics';
import { portalFloorRows, portalFloorScene } from '../../../src/shards/nine-dragon-stack/generators/portalFloors';
import { portalFloorRows as clientFloors } from '../../../src/shards/nine-dragon-stack/world/floorRows';
import shard from '../../../src/shards/nine-dragon-stack/shard.config';
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

it('authors the five declared portal floors with the exact native shapes and registration order', () => {
  const rows = portalFloorRows();
  expect(rows.map(row => row.id)).toEqual(['deck.north', 'deck.east', 'deck.south', 'deck.west', 'square']);
  expect(rows).toStrictEqual(clientFloors());
  expect(shard.props?.colliders).toStrictEqual(rows);
  for (const row of rows) {
    const piece = baked.pieces.find(candidate => 'colliderOwner' in candidate && candidate.colliderOwner === row.id);
    expect(piece?.colliders).toStrictEqual(row.shapes);
  }
});

it('builds actual named three.js collider objects instead of importing a native capture', () => {
  const scene = portalFloorScene();
  expect(scene.children).toHaveLength(5);
  expect(scene.children.flatMap(floor => floor.children)).toHaveLength(17);
  for (const floor of scene.children) for (const collider of floor.children) {
    expect(collider).toBeInstanceOf(BoxCollider);
    expect(collider.name.startsWith(`${floor.name}.`)).toBe(true);
  }
});

it('regenerates the portal floors in a Node tree with no runtime, game, engine or legacy sources', async () => {
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
    const source = `import { portalFloorRows } from ${JSON.stringify(pathToFileURL(join(output, 'portalFloors.mjs')).href)}; console.log(JSON.stringify(portalFloorRows()));`;
    const actual: unknown = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', cwd: stage, timeout: 5000 }));
    expect(actual).toStrictEqual(portalFloorRows());
  } finally { rmSync(stage, { recursive: true, force: true }); }
});

it('keeps all authoring generators and the scene reader out of the client config bundle', async () => {
  const result = await build({ configFile: false, publicDir: false, logLevel: 'silent', build: {
    write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/shard.config.ts'), formats: ['es'], fileName: 'config' },
  } });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => 'output' in item ? item.output : []);
  const modules = outputs.flatMap(item => item.type === 'chunk' ? Object.keys(item.modules) : []);
  expect(modules.some(id => id.endsWith('/data/portalFloors.generated.json'))).toBe(true);
  expect(modules.some(id => id.endsWith('/data/portalEntries.generated.json'))).toBe(true);
  expect(modules.filter(id => /\/generators\/|\/src\/sdk\/(?:scene|physics|spawns|entries)\.ts$/u.test(id))).toEqual([]);
});

it('cold-generates, restores and force-compares the ignored rows through the shared cache', async () => {
  const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'nine-portal-floors');
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
    if (output === undefined) throw new Error('Missing floor-row output');
    expect(JSON.parse(readFileSync(resolve(stage, output), 'utf8'))).toStrictEqual(portalFloorRows());
    expect(cold.hit).toBe(false);
    expect(cold.hashes).toEqual(job.buildOutputs);
    const warm = await generateShardJob(stage, job, { cacheDir });
    expect(warm.hit).toBe(true);
    expect(warm.key).toBe(cold.key);
    const compared = await generateShardJob(stage, job, { cacheDir, forceCompare: true });
    expect(compared.hashes).toEqual(cold.hashes);
  } finally { rmSync(stage, { recursive: true, force: true }); }
});

it('force-compares the ignored portal rows and restores a verified build cache without a browser', async () => {
    const root = process.cwd(), job = discoverGeneration(root).jobs.find(row => row.id === 'nine-portal-entries');
    if (job === undefined) throw new Error('Missing portal-entry authoring job');
    const compared = await generateShardJob(root, job, { forceCompare: true });
    expect(compared.hashes).toEqual(job.buildOutputs);
    const file = job.outputs[0]; if (file === undefined) throw new Error('Missing portal-row output');
    const actual: unknown = JSON.parse(readFileSync(resolve(compared.directory, file), 'utf8'));
    expect(actual).toEqual(shard.entryways);
    const warm = await generateShardJob(root, job);
    expect(warm.hit).toBe(true); expect(warm.key).toBe(compared.key);
  });
