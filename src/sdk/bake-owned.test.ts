// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove only bounded author publication fixtures.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep every publication under the owned project root.
import { resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { build, createFilter } from 'vite';
import * as v from 'valibot';
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { bake, bakeOwned, BakedPiece, Scatter, WholeShape, confined, type BakeInputs } from './bake';
import { BoxCollider } from './physics';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';
import { assertConfigBoundary } from './configBoundary';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function directory(): string { mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp/bake-owned-')); owned.push(root); return root; }
const hash = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));
function fixture() {
  const geometry = new BoxGeometry(2, 2, 2), material = new MeshStandardMaterial({ color: 0x7b513c, roughness: 1 });
  const scene = new Group(); scene.name = 'owned-fixture';
  const mesh = new Mesh(geometry, material); mesh.name = 'plain'; mesh.position.set(-220, 1, -220); scene.add(mesh);
  const instanced = new InstancedMesh(geometry, material, 2);
  instanced.setMatrixAt(0, new Matrix4().makeTranslation(2, 1, 0)); instanced.setMatrixAt(1, new Matrix4().makeTranslation(-2, 1, 0));
  scene.add(new BakedPiece('piece', [['beam', instanced]], [{ kind: 'box', x: 0, y: 1, z: 0, hx: 3, hy: 1, hz: 1 }], {}, { anchor: [0, 2, 0] }));
  const scatter = new Mesh(geometry, material); scatter.name = 'scatter-model';
  scene.add(new Scatter('scatter', scatter, [new Matrix4().makeTranslation(180, 1, 180)]));
  const white = new MeshStandardMaterial({ color: 0xffffff });
  const whole = new Mesh(geometry, white); whole.name = 'whole-model'; whole.position.set(100, 1, -100); scene.add(new WholeShape('whole', whole));
  const collider = new BoxCollider(4, 2, 2, 'stone'); collider.name = 'wall'; collider.position.set(10, 1, 10); scene.add(collider);
  return { scene, dispose: () => { geometry.dispose(); material.dispose(); white.dispose(); } };
}

// Captured from the original algorithm before separating publication.
const sceneHash = '84d53374356a451ce1d6930ad729d8f98a062fdf5f0c101063789f2d1f546a22';
const assets = [
  ['b84acad237547985c7e69b460dede25141ecab4056aa025a74b873602bb4bae5', 2880],
  ['0277e449ef379494cc4f6153505a725d81d22d1d82adf7b77888c822eb0aba14', 1556],
  ['e3b7fe14398887a89b2801ee5abcc941bd73051eacca9f4071cdc6fc349ff648', 3428],
  ['12387c1edc269bfdd1ffb7b91853491251caa6adb14a27c66975e21dc1a8acd9', 2880],
  ['dfb25a605eec8e43b415d6e479cf79afa60134e8c9dc5aa285471688aab7bccb', 2876],
  ['cdd9caae333233b9db9696365f0702a698a54896f6675dc6933f70500a81bf33', 4604],
];

test('owned bake retains all original scene, piece, tile and asset bytes', () => {
  const graph = fixture();
  try {
    const result = bakeOwned(graph.scene, { slug: 'owned-fixture' });
    expect(result.sceneHash).toBeNull(); expect(result.scenePath).toBeNull();
    expect(hash(result.scene)).toBe(sceneHash);
    expect(hash({ shardfile: result.shardfile, colliders: result.colliders, pieces: result.pieces.map(({ glb, ...rows }) => ({ ...rows, glb: hashImmutableBytes(glb) })) }))
      .toBe('9a3ecd460a3c98d6fbab87a8cb7d12476b0d6baf44520c3a45a5c59183c1f9d9');
    expect([...result.assets].map(([id, bytes]) => [id, bytes.length])).toEqual(assets);
    for (const [id, bytes] of result.assets) expect(hashImmutableBytes(bytes)).toBe(id);
    expect(bake(graph.scene, { slug: 'owned-fixture' })).toEqual(result);
  } finally { graph.dispose(); }
});

test('existing publication retains exact canonical bytes, hash, both paths and cache refusal', () => {
  const root = directory(), graph = fixture(), project = realpathSync(root);
  try {
    const result = bake(graph.scene, { slug: 'owned-fixture' }, { project });
    const path = resolve(project, '.wildshard/cache/owned-fixture/scene.json');
    const immutable = resolve(project, '.wildshard/cache/owned-fixture', sceneHash, 'scene.json');
    expect(result.sceneHash).toBe(sceneHash); expect(result.scenePath).toBe(path);
    const expected = encodeCanonicalJson(result.scene);
    expect(readFileSync(path, 'utf8')).toBe(expected); expect(readFileSync(immutable, 'utf8')).toBe(expected);
    expect(bake(graph.scene, { slug: 'owned-fixture' }, { project }).sceneHash).toBe(sceneHash);
    writeFileSync(immutable, 'changed');
    expect(() => bake(graph.scene, { slug: 'owned-fixture' }, { project })).toThrow('cached bytes disagree');
  } finally { graph.dispose(); }
});

test('owned compilation does not publish even when a wider options object retains a project', () => {
  const root = directory(), graph = fixture(); const options: BakeInputs = { project: root };
  try {
    expect(bakeOwned(graph.scene, { slug: 'owned-fixture' }, options).scenePath).toBeNull();
    expect(existsSync(resolve(root, '.wildshard'))).toBe(false);
  } finally { graph.dispose(); }
});

for (const compile of [bake, bakeOwned]) {
  test(`${compile.name} retains identity, duplicate-piece and scatter placement refusals`, () => {
    expect(() => compile(new Group(), { slug: '../escape' })).toThrow('bounded shard slug');
    const duplicates = new Group().add(new BakedPiece('same', [], []), new BakedPiece('same', [], []));
    expect(() => compile(duplicates, { slug: 'fixture' })).toThrow('unique name');
    const scatter = new Scatter('moved', new Group(), []); scatter.position.x = 1;
    expect(() => compile(new Group().add(scatter), { slug: 'fixture' })).toThrow('world origin');
  });
}

test('existing publication still refuses project symlink escapes', () => {
  const root = directory(), outside = directory(); symlinkSync(outside, resolve(root, '.wildshard'));
  expect(() => bake(new Group(), { slug: 'fixture' }, { project: root })).toThrow('outside project');
  expect(() => confined(realpathSync(root), '../outside')).toThrow('outside project');
});

test('only the private publication leaf is marked side-effect-free in source and packed SDK', () => {
  const data = v.parse(v.object({ sideEffects: v.array(v.string()) }), JSON.parse(readFileSync(resolve('src/sdk/package.json'), 'utf8')));
  const filter = createFilter(data.sideEffects, null, { resolve: resolve('src/sdk') });
  for (const file of ['bakePublication.ts', 'dist/bakePublication.js']) expect(filter(resolve('src/sdk', file)), file).toBe(false);
  for (const file of ['bake.ts', 'assets.ts', 'package.json', 'bake/rawTexture.ts', 'future.mjs', 'bake/bakePublication.ts', 'dist/bake.js', 'dist/assets.js', 'dist/bake/props.js']) {
    expect(filter(resolve('src/sdk', file)), file).toBe(true);
  }
});

for (const name of ['bake', 'bakeOwned']) {
  test(`${name} keeps the unchanged config import boundary`, async () => {
    const entry = resolve('owned-bake-entry');
    const result = await build({ configFile: false, logLevel: 'silent', plugins: [{ name: 'bake-boundary-entry',
      resolveId(id) { return id === entry || id === 'owned-bake-entry' ? '\0owned-bake-entry' : null; },
      load(id) { return id === '\0owned-bake-entry' ? `import {${name}} from '@wildshard/sdk/bake';export function compile(scene,identity,inputs){return ${name}(scene,identity,inputs);}` : null; },
    }], build: { write: false, minify: false, lib: { entry, formats: ['es'] }, rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
    const built = Array.isArray(result) ? result[0] : result;
    if (built === undefined || !('output' in built)) throw new Error('Missing author bundle');
    const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
    for (const chunk of chunks) {
      const imports = [...chunk.imports, ...chunk.dynamicImports];
      const boundary = () => assertConfigBoundary(imports);
      if (name === 'bake') { expect(boundary).toThrow('file access'); expect(imports).toContain('node:fs'); expect(imports).toContain('node:path'); }
      else { expect(boundary).not.toThrow(); expect(imports).not.toContain('node:fs'); expect(imports).not.toContain('node:path'); expect(chunk.code).not.toContain('publishSceneDescription'); }
    }
  });
}


test('every explicitly staged bake caller includes its private publication input', () => {
  const registry = v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), inputRoots: v.array(v.string()) })) }), JSON.parse(readFileSync(resolve('scripts/generation-jobs.json'), 'utf8')));
  const missing = registry.jobs.filter(row => row.inputRoots.includes('src/sdk/bake.ts')
    && !row.inputRoots.some(input => input === 'src/sdk/bakePublication.ts' || 'src/sdk/bakePublication.ts'.startsWith(`${input}/`))).map(row => row.id);
  expect(missing).toEqual([]);
});
