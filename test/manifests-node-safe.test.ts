// oxlint-disable-next-line import/no-nodejs-modules -- Fresh Node proves manifest imports have no browser globals.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The subprocess runs the current Node executable.
import { execPath } from 'node:process';
import { describe, expect, it } from 'vitest';
import { SHARDS } from '../src/shards.generated';

describe('node-safe manifests', () => {
  it('imports the actual generated registry in a fresh Node process with no window, document or location', () => {
    const script = `
      for (const key of ['window', 'document', 'location']) if (key in globalThis) throw new Error(key + ' was defined');
      const { SHARDS } = await import('./src/shards.generated.ts');
      if (!SHARDS.length || SHARDS.some(m => m.api !== 1)) throw new Error('invalid manifests');
      process.stdout.write(JSON.stringify(SHARDS.map(m => m.slug)));
    `;
    const output = execFileSync(execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', script], { encoding: 'utf8' });
    expect(JSON.parse(output)).toEqual(SHARDS.map((m) => m.slug));
  });
});
