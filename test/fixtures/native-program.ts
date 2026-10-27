// oxlint-disable-next-line import/no-nodejs-modules -- Execute the original compiler in its native Node realm.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Copy only verified native cache output while holding its read lease.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All compiler inputs remain repository-relative.
import { resolve } from 'node:path';
import { bakeInputHashes, InputHashMemo } from '../../scripts/bake-input-hashes.mjs';
import { runNativeRecorder } from '../../scripts/native-recorder-cache.mjs';

const memos = new Map<string, InputHashMemo>();
const MAX_BYTES = 1 << 26;
const LOADER = 'scripts/bake-loader.mjs';

/** Share completed construction, never a test result. The existing native cache
 * binds exact input bytes, tool/host identity and every output hash, coalesces
 * cold producers and fences source changes before publishing. Callers still
 * admit the full compiler envelope and run every original oracle themselves. */
export async function nativeProgramFixture(spec: {
  readonly id: string; readonly script: string; readonly inputs: readonly string[];
  readonly root?: string; readonly cacheDir?: string;
}): Promise<string> {
  const root = resolve(spec.root ?? '.'), memo = memos.get(root) ?? new InputHashMemo(root);
  memos.set(root, memo);
  const inventory = (): string[] => [...new Set([spec.script, LOADER, ...spec.inputs.flatMap(path => memo.paths(path, true))])].sort();
  const paths = inventory(), inputs = bakeInputHashes(root, paths, memo);
  const command = [process.execPath, '--import', `./${LOADER}`, '--', spec.script];
  const output = 'fixture.json';
  const result = await runNativeRecorder(root, {
    id: `fixture-${spec.id}`, inputs, command, outputs: [output], platform: 'native',
    tools: { cwd: memo.root, nodeOptions: process.env['NODE_OPTIONS'] ?? '' },
  }, {
    inputHashes: memo, ...(spec.cacheDir === undefined ? {} : { cacheDir: spec.cacheDir }),
    generate: directory => {
      const text = execFileSync(process.execPath, command.slice(1), { cwd: root, encoding: 'utf8', maxBuffer: MAX_BYTES });
      const value: unknown = JSON.parse(text);
      if (value === null || typeof value !== 'object') throw new Error('Missing native compiler envelope');
      if (JSON.stringify(inventory()) !== JSON.stringify(paths)) throw new Error('Native compiler input inventory changed');
      writeFileSync(resolve(directory, output), text);
      return Promise.resolve();
    },
  });
  try {
    const file = resolve(result.directory, output);
    if (statSync(file).size > MAX_BYTES) throw new Error('Native compiler envelope exceeds limit');
    return readFileSync(file, 'utf8');
  } finally { result.release(); }
}
