// oxlint-disable-next-line import/no-nodejs-modules -- Read original native inputs and own isolated sealed-generation fixtures.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine omitted-input catalogues to repository scratch.
import { relative, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete original scene JSON without assertion expansion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyStaticSceneBytes, skyStaticScenes } from '../src/shards/far-reach/generators/staticScene';
import { WORLD_PLACEMENT_INPUTS, skyWorldPlacementValues } from '../src/shards/far-reach/generators/worldPlacementBytes';

const output = 'src/shards/far-reach/data/staticScenes.generated.json';

test('the static reader derives all original scene bytes from exactly six explicit native models', async () => {
  const reads: string[] = [];
  const bytes = await skyStaticSceneBytes(name => { reads.push(name); return new Uint8Array(readFileSync(`public${name}`)); });
  expect(reads).toEqual(WORLD_PLACEMENT_INPUTS);
  expect(Buffer.compare(bytes, readFileSync(output))).toBe(0);
  const { placements } = await skyWorldPlacementValues(new Map(WORLD_PLACEMENT_INPUTS.map(name => [name, new Uint8Array(readFileSync(`public${name}`))])));
  expect(skyStaticScenes({ ...placements, half: 123 }).half).toBe(123);
});

test('the actual cold sealed static writer omits generated placements and refuses an omitted native model', async () => {
  const root = resolve('.'), { jobs } = discoverGeneration(root), job = jobs.find(row => row.id === 'sky-static-scenes');
  if (job === undefined) throw new Error('Missing retained static writer');
  expect(job.command).toContain('skyStaticSceneBytes'); expect(job.command.at(-1)).toBe('--bytes');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/placements.json');
  expect(job.inputRoots).not.toContain('src/shards/far-reach/data/physicsPlacements.generated.json');
  expect(job.inputRoots).toContain('src/shards/far-reach/generators/physicsPlacements.ts');
  for (const name of WORLD_PLACEMENT_INPUTS) expect(job.inputRoots).toContain(`public${name}`);
  const first = WORLD_PLACEMENT_INPUTS[0]; if (first === undefined) throw new Error('Missing native placement input');
  const expected = hashImmutableBytes(readFileSync(output)), cacheDir = mkdtempSync(resolve('tmp/sky-static-inputs-'));
  const omitted = { ...job, inputRoots: job.inputRoots.filter(path => path !== `public${first}`) };
  const catalogPath = relative(root, resolve(cacheDir, 'omitted.json'));
  try {
    writeFileSync(catalogPath, JSON.stringify({ schema: '../scripts/generation-jobs.schema.json', jobs: jobs.map(row => row.id === job.id ? omitted : row) }));
    await expect(generateShardJob(root, omitted, { cacheDir, catalogPath, forceCompare: true })).rejects.toThrow('Generator exited 1');
    const result = await generateShardJob(root, job, { cacheDir, forceCompare: true });
    try { expect(result.hit).toBe(false); expect(result.hashes).toEqual({ [output]: expected }); }
    finally { result.release(); }
  } finally { rmSync(cacheDir, { recursive: true, force: true }); }
});

test('the reader bundle includes its owned producer and excludes the generated placement handoff', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/staticScene.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing static reader bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/worldPlacementBytes.ts'))).toBe(true);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/data/placements.json'))).toBe(false);
  }
});
