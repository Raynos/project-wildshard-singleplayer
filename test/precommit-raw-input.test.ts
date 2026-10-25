// oxlint-disable-next-line import/no-nodejs-modules -- Exercise candidate Git bytes in an owned tiny repository.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture files and compiled module are removed after the test.
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the fixture to the repository scratch root.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Load one real bundle without eval or encoded source.
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { stagedInputOverride } from '../scripts/precommit-related.mjs';
import { stagedFiles } from '../scripts/precommit-projects.mjs';

test('candidate overrides preserve raw JSON/shaders and ordinary modules over peer WIP', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/cf1-raw-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = (...args: string[]): void => { execFileSync('git', args, { cwd: root, env, stdio: 'pipe' }); };
  const json = '{"value":1}\n', shader = 'void main() {\n  gl_Position = vec4(1.0);\n}\n', source = 'export const value = 1;\n';
  const file = resolve(root, 'values.json'), glsl = resolve(root, 'source.glsl'), module = resolve(root, 'value.ts');
  try {
    git('init', '-q'); git('config', 'core.hooksPath', '/dev/null');
    writeFileSync(file, json); writeFileSync(glsl, shader); writeFileSync(module, source); git('add', '.');
    writeFileSync(file, '{"value":99}'); writeFileSync(glsl, 'foreign shader'); writeFileSync(module, 'export const value = 99;');
    const entry = resolve(root, 'entry');
    const result = await build({ root, configFile: false, publicDir: false, logLevel: 'silent',
      plugins: [stagedInputOverride(root, stagedFiles(root)), { name: 'cf1-raw-test',
        resolveId(id) { return id === entry ? '\0cf1-raw-test' : null; },
        load(id) { return id === '\0cf1-raw-test'
          ? `import a from ${JSON.stringify(`${file}?raw`)};import b from ${JSON.stringify(`${file}?import&raw`)};
             import c from ${JSON.stringify(`${glsl}?raw`)};import d from ${JSON.stringify(file)};
             import {value} from ${JSON.stringify(`${module}?import`)};export const result=[a,b,c,d.value,value];` : null; } }],
      build: { write: false, minify: false, lib: { entry, formats: ['es'] }, rolldownOptions: { output: { codeSplitting: false } } } });
    const built = Array.isArray(result) ? result[0] : result;
    if (built === undefined || !('output' in built)) throw new Error('Missing raw override bundle');
    const chunks = built.output.filter(row => row.type === 'chunk');
    if (chunks.length !== 1 || chunks[0] === undefined) throw new Error('Expected one raw override module');
    const output = resolve(root, 'result.mjs'); writeFileSync(output, chunks[0].code);
    const loaded: unknown = await import(pathToFileURL(output).href);
    if (typeof loaded !== 'object' || loaded === null || !('result' in loaded)) throw new Error('Missing raw fixture result');
    expect(loaded.result).toEqual([json, json, shader, 1, 1]);
    expect(readFileSync(file, 'utf8')).toBe('{"value":99}');
    expect(readFileSync(glsl, 'utf8')).toBe('foreign shader');
    expect(readFileSync(module, 'utf8')).toBe('export const value = 99;');
    expect(execFileSync('git', ['show', ':values.json'], { cwd: root, env, encoding: 'utf8' })).toBe(json);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
