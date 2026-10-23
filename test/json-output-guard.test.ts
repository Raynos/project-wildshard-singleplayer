// oxlint-disable-next-line import/no-nodejs-modules -- Drive the real JSON producer in tiny owned fixtures.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Own fixture inputs and assert failed writers publish nothing.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture paths remain under ignored tmp.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real SDK driver executable.
import { fileURLToPath } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the same Node executable as the parent test.
import { execPath } from 'node:process';
import { expect, test } from 'vitest';
import { jsonOutputGuard, assertJsonRows } from '../scripts/json-output-guard.mjs';
import { byteWriter, jsonBytes } from '../scripts/bake-output.mjs';
import { generateShardJob, prepareGeneration } from '../scripts/generate.mjs';

const payload = 'a'.repeat(1024);
const output = 'src/shards/example/data/output.json';
const entry = 'src/shards/example/generators/bake-example.mjs';
const driver = fileURLToPath(new URL('../src/sdk/bake/json.mjs', import.meta.url));
const put = (root: string, name: string, text: string): void => {
  const target = resolve(root, name); mkdirSync(resolve(target, '..'), { recursive: true }); writeFileSync(target, text);
};
async function fixture(run: (root: string) => void | Promise<void>): Promise<void> {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/json-writer-test-'));
  try { await run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const debt = (root: string, files: Record<string, { base64Chars: number; dataUris: number }>): void => {
  put(root, 'lint/no-binary-json.json', JSON.stringify({ schema: 'no-binary-json/1', source: 'a'.repeat(40), files }));
};

 test('shared JSON serialization refuses byte values before their numeric disguise', () => {
  for (const value of [new Uint8Array([1, 2]), new Float32Array([1]), new ArrayBuffer(2), new SharedArrayBuffer(2), { type: 'Buffer', data: [1, 2] }]) {
    expect(() => assertJsonRows({ nested: [value] })).toThrow('byte values');
    expect(() => jsonBytes({ nested: [value] })).toThrow('byte values');
  }
  expect(JSON.parse(jsonBytes({ position: [1, 2, 3], source: 'rows' }).toString())).toEqual({ position: [1, 2, 3], source: 'rows' });
});

test('shared writer admits exact existing debt, refuses new paths and never skips checking unchanged bytes', () => fixture(root => {
  debt(root, { [output]: { base64Chars: 1024, dataUris: 0 } });
  const writer = byteWriter(false, 'fixture', root), bytes = jsonBytes({ text: payload });
  writer.put(resolve(root, output), bytes);
  expect(readFileSync(resolve(root, output))).toEqual(bytes);
  const other = resolve(root, 'public/assets/example/new.json');
  put(root, 'public/assets/example/new.json', bytes.toString());
  expect(() => writer.put(other, bytes)).toThrow('BINARY-JSON');
  expect(() => writer.put(resolve(root, output), jsonBytes({ text: `${payload}a` }))).toThrow('BINARY-JSON');
  expect(() => writer.put(other, jsonBytes({ uri: 'data:application/octet-stream,AA' }))).toThrow('BINARY-JSON');
  writer.put(resolve(root, 'public/assets/example/new.bin'), new Uint8Array([0, 1, 255]));
  expect([...readFileSync(resolve(root, 'public/assets/example/new.bin'))]).toEqual([0, 1, 255]);
}));

test('SDK JSON recipes refuse encoded and raw bytes before creating an output', () => fixture(root => {
  for (const expression of ["{text:'a'.repeat(1024)}", "{uri:'data:image/png;base64,AA=='}", '{bytes:new Uint8Array([1,2])}']) {
    put(root, entry, `export function make(){return ${expression}}`);
    expect(() => execFileSync(execPath, [driver, entry, 'make', output], { cwd: root, stdio: 'pipe' })).toThrow();
    expect(existsSync(resolve(root, output))).toBe(false);
  }
  put(root, entry, 'export function make(){return {rows:[1,2,3]}}');
  execFileSync(execPath, [driver, entry, 'make', output], { cwd: root, stdio: 'pipe' });
  expect(JSON.parse(readFileSync(resolve(root, output), 'utf8'))).toEqual({ rows: [1, 2, 3] });
}));

test('SDK multi-file admission checks all JSON before writing any binary sibling', () => fixture(root => {
  put(root, entry, `export function make(){return new Map([['data/ok.bin',new Uint8Array([1,2])],['data/bad.json',new TextEncoder().encode(JSON.stringify({text:'a'.repeat(1024)}))]])}`);
  expect(() => execFileSync(execPath, [driver, entry, 'make', 'src/shards/example', '--files'], { cwd: root, stdio: 'pipe' })).toThrow();
  expect(existsSync(resolve(root, 'src/shards/example/data/ok.bin'))).toBe(false);
  expect(existsSync(resolve(root, 'src/shards/example/data/bad.json'))).toBe(false);
}));

test('SDK explicit byte products stay binary and cannot disguise JSON at a .json path', () => fixture(root => {
  put(root, entry, 'export function make(){return new Uint8Array([0,1,255])}');
  const bin = 'src/shards/example/data/output.bin';
  execFileSync(execPath, [driver, entry, 'make', bin, '--bytes'], { cwd: root, stdio: 'pipe' });
  expect([...readFileSync(resolve(root, bin))]).toEqual([0, 1, 255]);
  put(root, entry, "export function make(){return new TextEncoder().encode(JSON.stringify({text:'a'.repeat(1024)}))}");
  expect(() => execFileSync(execPath, [driver, entry, 'make', output, '--bytes'], { cwd: root, stdio: 'pipe' })).toThrow();
  expect(existsSync(resolve(root, output))).toBe(false);
}));

test('generation checks direct filesystem writers before publishing or restoring a product', () => fixture(async root => {
  const job = { id: 'fixture-binary', shard: 'example', entry, command: [entry], inputRoots: [entry], outputs: [output], buildTimeOutputs: [output], platform: 'portable' as const };
  put(root, entry, `import{writeFileSync}from'node:fs';writeFileSync('${output}',JSON.stringify({text:'a'.repeat(1024)}));`);
  put(root, 'scripts/generation-jobs.json', JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT fixture', jobs: [job] }));
  await expect(generateShardJob(root, job, { cacheDir: resolve(root, 'cache'), restore: true })).rejects.toThrow('BINARY-JSON');
  expect(existsSync(resolve(root, output))).toBe(false);
}));

test('a verified warm phase cannot bypass a smaller current binary allowance', () => fixture(async root => {
  const job = { id: 'fixture-binary', shard: 'example', entry, command: [entry], inputRoots: [entry], outputs: [output], buildTimeOutputs: [output], platform: 'portable' as const };
  put(root, entry, `import{writeFileSync}from'node:fs';writeFileSync('${output}',JSON.stringify({text:'a'.repeat(1024)}));`);
  put(root, 'scripts/generation-jobs.json', JSON.stringify({ schema: 'generation-jobs/1', notice: 'DO NOT EDIT fixture', jobs: [job] }));
  debt(root, { [output]: { base64Chars: 1024, dataUris: 0 } });
  const cacheDir = resolve(root, 'cache');
  await prepareGeneration(root, { cacheDir });
  expect(JSON.parse(readFileSync(resolve(root, output), 'utf8'))).toEqual({ text: payload });
  await prepareGeneration(root, { cacheDir });
  debt(root, {});
  await expect(prepareGeneration(root, { cacheDir })).rejects.toThrow('BINARY-JSON');
  expect(() => jsonOutputGuard(root)(output, JSON.stringify({ text: payload }))).toThrow('BINARY-JSON');
}));
