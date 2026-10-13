// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the preloaded producer in an isolated Node process.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify fixture-owned output and cache bytes.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture directory only.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture-owned paths.
import { join } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Spawn the current pinned Node binary.
import process from 'node:process';
import { expect, it } from 'vitest';
import { generateBootTablesCached } from '../scripts/gen-boot-cache.mjs';

it('never caches a producer without the pre-import trace', () => {
  let calls = 0;
  const run = (): void => { calls++; };
  expect(generateBootTablesCached('.', '.', run)).toBe(false);
  expect(generateBootTablesCached('.', '.', run)).toBe(false);
  expect(calls).toBe(2);
});

it('traces sources, reads, inventories and unread writes; refuses corrupt evidence and failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'boot-direct-fixture-'));
  try {
    for (const dir of ['scripts', 'vite', 'src/game/boot', 'public/assets/packs']) mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    for (const file of ['gate-cache.mjs', 'gen-boot-cache.mjs']) {
      writeFileSync(join(root, 'scripts', file), readFileSync(`scripts/${file}`));
    }
    writeFileSync(join(root, 'scripts/bake-loader.mjs'), '');
    writeFileSync(join(root, 'knob.json'), 'one');
    writeFileSync(join(root, 'vite/gen.mjs'), `import { readFileSync, writeFileSync } from 'node:fs';
export function generateBootTables() {
const value = readFileSync('knob.json', 'utf8');
if (value === 'fail') throw Error('producer failure');
writeFileSync('src/other.generated.json', value);
writeFileSync('public/assets/packs/proof.pack', value);
}`);
    writeFileSync(join(root, 'driver.mjs'), `import { generateBootTables } from './vite/gen.mjs';
import { generateBootTablesCached } from './scripts/gen-boot-cache.mjs';
console.log('RESULT:' + generateBootTablesCached(process.cwd(), './cache', generateBootTables));`);
    const run = (): string => execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs',
      '--import', './scripts/gen-boot-cache.mjs', 'driver.mjs'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    expect(run()).toContain('RESULT:false');
    expect(run()).toContain('RESULT:true');
    writeFileSync(join(root, 'src/other.generated.json'), 'corrupt');
    expect(run()).toContain('RESULT:false');
    expect(readFileSync(join(root, 'src/other.generated.json'), 'utf8')).toBe('one');
    writeFileSync(join(root, 'knob.json'), 'two');
    expect(run()).toContain('RESULT:false');
    expect(readFileSync(join(root, 'src/other.generated.json'), 'utf8')).toBe('two');
    writeFileSync(join(root, 'public/assets/packs/proof.pack'), 'corrupt');
    expect(run()).toContain('RESULT:false');
    expect(readFileSync(join(root, 'public/assets/packs/proof.pack'), 'utf8')).toBe('two');
    writeFileSync(join(root, 'public/assets/packs/unexpected.pack'), 'new');
    expect(run()).toContain('RESULT:false');
    writeFileSync(join(root, 'vite/gen.mjs'), `${readFileSync(join(root, 'vite/gen.mjs'), 'utf8')}\n// changed defining producer\n`);
    expect(run()).toContain('RESULT:false');
    expect(run()).toContain('RESULT:true');
    writeFileSync(join(root, 'cache/boot.json'), '{');
    expect(run()).toContain('RESULT:false');
    const damaged = JSON.parse(readFileSync(join(root, 'cache/boot.json'), 'utf8')) as { inputs: Record<string, unknown> };
    delete damaged.inputs['F knob.json'];
    writeFileSync(join(root, 'cache/boot.json'), JSON.stringify(damaged));
    expect(run()).toContain('RESULT:false');
    const prior = readFileSync(join(root, 'cache/boot.json'), 'utf8');
    writeFileSync(join(root, 'knob.json'), 'fail');
    expect(run).toThrow('producer failure');
    expect(run).toThrow('producer failure');
    expect(readFileSync(join(root, 'cache/boot.json'), 'utf8')).toBe(prior);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
