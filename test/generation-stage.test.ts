// oxlint-disable-next-line import/no-nodejs-modules -- Exact input hashes for owned stage fixtures.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Own every file and symlink beneath ignored tmp.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only owned fixture paths.
import { dirname, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { stageGenerationInputs } from '../scripts/generation-stage.mjs';

const owned: string[] = [];
afterEach(() => { for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(resolve('tmp/generation-stage-test-'));
  owned.push(root);
  const input = (file: string, bytes: string | Uint8Array) => {
    const source = resolve(root, file); mkdirSync(dirname(source), { recursive: true }); writeFileSync(source, bytes);
    return { file, source, hash: createHash('sha256').update(bytes).digest('hex') };
  };
  return { root, input };
}

test('copies exact source and upstream bytes into an owned isolated stage', async () => {
  const f = fixture();
  const source = f.input('src/source.mjs', 'authored');
  const upstream = f.input('cache/immutable.bin', new Uint8Array([0, 255, 17, 2]));
  const tree = await stageGenerationInputs({ root: f.root, job: 'fixture-stage', inputs: [source, { ...upstream, file: 'src/upstream.bin' }] });
  try {
    expect(tree.startsWith(resolve(f.root, 'tmp/generation-stage-'))).toBe(true);
    expect(readFileSync(resolve(tree, source.file), 'utf8')).toBe('authored');
    expect(new Uint8Array(readFileSync(resolve(tree, 'src/upstream.bin')))).toEqual(new Uint8Array([0, 255, 17, 2]));
    writeFileSync(source.source, 'later source');
    expect(readFileSync(resolve(tree, source.file), 'utf8')).toBe('authored');
    writeFileSync(resolve(tree, 'src/upstream.bin'), 'producer writes');
    expect(new Uint8Array(readFileSync(upstream.source))).toEqual(new Uint8Array([0, 255, 17, 2]));
  } finally { rmSync(tree, { recursive: true, force: true }); }
});

test('names changed inputs and removes a partly copied stage on failure', async () => {
  const f = fixture();
  const first = f.input('src/first.mjs', 'first'), changed = f.input('src/changed.bin', 'before');
  writeFileSync(changed.source, 'after!');
  await expect(stageGenerationInputs({ root: f.root, job: 'fixture-stage', inputs: [first, changed] }))
    .rejects.toThrow(/Generation inputs changed while copying fixture-stage: src\/changed\.bin \(expected [a-f0-9]{64}, copied [a-f0-9]{64}\)/u);
  expect(readdirSync(resolve(f.root, 'tmp'))).toEqual([]);
});

test('refuses traversal and linked sources before publishing a stage', async () => {
  const f = fixture(), input = f.input('src/source.mjs', 'authored');
  await expect(stageGenerationInputs({ root: f.root, job: 'fixture-stage', inputs: [{ ...input, file: '../escape' }] }))
    .rejects.toThrow();
  expect(existsSync(resolve(f.root, 'tmp'))).toBe(false);
  const link = resolve(f.root, 'link'); symlinkSync(input.source, link);
  await expect(stageGenerationInputs({ root: f.root, job: 'fixture-stage', inputs: [{ ...input, source: link }] }))
    .rejects.toThrow('source is not regular');
  expect(readdirSync(resolve(f.root, 'tmp'))).toEqual([]);
});
