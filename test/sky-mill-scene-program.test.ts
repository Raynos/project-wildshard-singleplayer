// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated model roots/cache fixtures and compare original metadata bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine native model fixtures to repository scratch and bind source bundles.
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration, type ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { MILL_SCENE_FILES, MILL_SCENE_INPUTS, skyMillSceneSource, skyMillSceneProgram } from '../src/shards/far-reach/generators/millSceneProgram';

const check = (files: ReadonlyMap<string, Uint8Array>): void => {
  expect([...files.keys()]).toEqual(MILL_SCENE_FILES);
  const bytes = files.get('mill-scene.json');
  if (bytes === undefined) throw new Error('Missing original mill scene');
  expect(bytes.byteLength).toBe(2_200);
  expect(hashImmutableBytes(bytes)).toBe('3a4d921739c9ca69a3a36885fc4020c3ee01d47aa6097df406859a626ef842a8');
};

test('cold and persistent mill scene hits preserve every original hierarchy and motion-binding byte', async () => {
  const scratch = mkdtempSync(resolve('tmp/sky-mill-scene-program-')), source = resolve(scratch, 'source'), prefix = '/assets/far-reach/';
  let builds = 0;
  const context = (identity = 'a'): Pick<ProjectGenerationContext, 'cached'> => {
    const ctx = createProjectGeneration(resolve('src/shards/far-reach'), identity.repeat(64), new Map(), resolve(scratch, 'cache'), [{ prefix, directory: source }]);
    return { cached: (step, generate) => {
      expect(step).toEqual({ id: 'mill-scene', native: true, inputs: MILL_SCENE_INPUTS });
      return ctx.cached(step, inputs => { expect([...inputs.keys()]).toEqual(MILL_SCENE_INPUTS); builds++; return generate(inputs); });
    } };
  };
  try {
    for (const name of MILL_SCENE_INPUTS) {
      const path = resolve(source, name.slice(prefix.length)); mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, readFileSync(`public${name}`));
    }
    const cold = await skyMillSceneProgram(context()); check(cold);
    for (const bytes of cold.values()) bytes.fill(0);
    check(await skyMillSceneProgram(context())); expect(builds).toBe(1);
    for (const [index, name] of MILL_SCENE_INPUTS.entries()) {
      const path = resolve(source, name.slice(prefix.length)), changed = readFileSync(path), label = changed.indexOf('glTF-Transform v4.5.0');
      if (label === -1) throw new Error('Missing original model author label');
      changed[label] = 71; writeFileSync(path, changed);
      check(await skyMillSceneProgram(context())); expect(builds).toBe(index + 2);
    }
    check(await skyMillSceneProgram(context('b'))); expect(builds).toBe(4);
    await expect(skyMillSceneProgram(createProjectGeneration(resolve('src/shards/far-reach'), 'c'.repeat(64), new Map(), scratch)))
      .rejects.toThrow('Generation input needs exactly one declared root');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('missing, empty and extra source or cache inventories refuse without a physical metadata fallback', async () => {
  const source = new Map(MILL_SCENE_INPUTS.map(name => [name, new Uint8Array([1])]));
  for (const name of MILL_SCENE_INPUTS) {
    const missing = new Map(source), empty = new Map(source);
    missing.delete(name); empty.set(name, new Uint8Array());
    for (const inputs of [missing, empty]) await expect(skyMillSceneSource(inputs)).rejects.toThrow('Sky mill scene input inventory differs');
  }
  await expect(skyMillSceneSource(new Map([...source, ['extra', new Uint8Array([1])]]))).rejects.toThrow('Sky mill scene input inventory differs');
  const cached = new Map(MILL_SCENE_FILES.map(name => [name, new Uint8Array([1])]));
  for (const name of MILL_SCENE_FILES) {
    const absent = new Map(cached), blank = new Map(cached);
    absent.delete(name); blank.set(name, new Uint8Array());
    for (const files of [absent, blank]) await expect(skyMillSceneProgram({ cached: () => Promise.resolve(files) })).rejects.toThrow('Sky mill scene cache inventory differs');
  }
  await expect(skyMillSceneProgram({ cached: () => Promise.resolve(new Map([...cached, ['extra', new Uint8Array([1])]])) }))
    .rejects.toThrow('Sky mill scene cache inventory differs');
});

test('mill source and cache bundle without generated imports or file/compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/far-reach/generators/millSceneProgram.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing mill scene source bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.includes('.generated.'))).toBe(false);
  }
});

