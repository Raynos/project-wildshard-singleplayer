// oxlint-disable-next-line import/no-nodejs-modules -- Read original native inputs and own isolated sealed-generation fixtures.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine omitted-input catalogues to repository scratch.
import { relative, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { discoverGeneration, generateShardJob } from '../scripts/generate.mjs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyStaticSceneBytes, skyStaticScenes } from '../src/shards/far-reach/generators/staticScene';
import { fixedWorld, skyFixedWorldValues } from '../src/shards/far-reach/generators/fixedWorld';
import { WORLD_PLACEMENT_INPUTS, skyWorldPlacementValues } from '../src/shards/far-reach/generators/worldPlacementBytes';

const output = 'src/shards/far-reach/data/staticScenes.generated.json';

test('both fixed worlds retain the complete original bytes and isolate caller-owned values', () => {
  const values = skyFixedWorldValues(), original = JSON.stringify(values);
  for (const [standalone, length, hash] of [
    [true, 267_448, '6ab10af8592452f0307edeb7acbe905fa8ca2411e822ec19e8dfd97799fdf7d6'],
    [false, 267_137, '4f5741f1e848a1b1143ca259a94d48794a9778a1ab581a0faef69b907f0789dc'],
  ] as const) {
    const rows = fixedWorld(standalone, values), bytes = new TextEncoder().encode(JSON.stringify(rows));
    expect(bytes.byteLength).toBe(length); expect(hashImmutableBytes(bytes)).toBe(hash);
    rows.recipe.scene.nodes.length = 0;
    const hull = rows.colliders.flatMap(row => row.colliders).find(row => row.kind === 'hull');
    if (hull === undefined || hull.kind !== 'hull' || hull.points === undefined) throw new Error('Missing original fixed hull');
    Reflect.set(hull.points, 0, 999);
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(fixedWorld(standalone, values))))).toBe(hash);
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(fixedWorld(standalone))))).toBe(hash);
  }
  expect(JSON.stringify(values)).toBe(original);
  const changed = skyFixedWorldValues(), hull = changed.groundColliders[0]?.colliders[0];
  if (hull === undefined) throw new Error('Missing authored ground hull');
  hull.points[0] = 456;
  expect(JSON.stringify(skyFixedWorldValues())).toBe(original);
});

test('the static factory consumes explicit fixed-world values for both envelopes without mutating them', async () => {
  const { placements } = await skyWorldPlacementValues(new Map(WORLD_PLACEMENT_INPUTS.map(name => [name, new Uint8Array(readFileSync(`public${name}`))])));
  const values = skyFixedWorldValues();
  values.mill.scene.nodes = values.mill.scene.nodes.map(node => node.id === 'hub' ? { ...node, rotation: [0.25, 0, 0] } : node);
  const supplied = { ...values, groundColliders: [{ id: 'owned-ground', colliders: [{ kind: 'hull' as const, x: 1, y: 2, z: 3, points: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], surface: 'grass' as const }] }] };
  const before = JSON.stringify(supplied), rows = skyStaticScenes(placements, supplied);
  for (const mode of ['standalone', 'cell'] as const) {
    const hub = rows[mode].fixed.recipe.scene.nodes.find(node => node.id === 'mill.hub');
    if (hub?.kind !== 'group') throw new Error('Missing supplied mill hub');
    expect(hub.rotation).toEqual([0.25, 0, 0]);
    expect(rows[mode].fixed.colliders.find(row => row.id === 'owned-ground')).toEqual(supplied.groundColliders[0]);
  }
  const standaloneHull = rows.standalone.fixed.colliders.find(row => row.id === 'owned-ground')?.colliders[0];
  if (standaloneHull === undefined || standaloneHull.kind !== 'hull' || standaloneHull.points === undefined) throw new Error('Missing supplied hull');
  Reflect.set(standaloneHull.points, 0, 999);
  expect(rows.cell.fixed.colliders.find(row => row.id === 'owned-ground')).toEqual(supplied.groundColliders[0]);
  expect(JSON.stringify(supplied)).toBe(before);
  expect(() => fixedWorld(true, { ...values, mill: { ...values.mill, scene: { ...values.mill.scene, nodes: [] } } })).toThrow();
});

test('the static reader derives all original scene bytes from exactly six explicit native models', async () => {
  const reads: string[] = [];
  const bytes = await skyStaticSceneBytes(name => { reads.push(name); return new Uint8Array(readFileSync(`public${name}`)); });
  expect(reads).toEqual(WORLD_PLACEMENT_INPUTS);
  expect(bytes.byteLength).toBe(583_343);
  expect(hashImmutableBytes(bytes)).toBe('1be5a532bca78ccb782a80905105ca6d6fe243676539dc04d58e78f213ddef2a');
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
  const expected = '1be5a532bca78ccb782a80905105ca6d6fe243676539dc04d58e78f213ddef2a', cacheDir = mkdtempSync(resolve('tmp/sky-static-inputs-'));
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
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/groundScene.ts'))).toBe(true);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/data/groundScene.generated.json'))).toBe(false);
  }
});
