// oxlint-disable-next-line import/no-nodejs-modules -- Inspect complete command programs without opening a browser or publishing assets.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Normalize literal addresses against the actual repository root.
import { cwd } from 'node:process';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nineAuthorProgram } from './fixtures/nine-author-program';
import originals from './fixtures/nine-author-programs.json' with { type: 'json' };

const hash = (value: string): string => hashImmutableBytes(new TextEncoder().encode(value));
for (const row of originals) test(`${row.script} preserves every native command statement and file address`, () => {
  const source = readFileSync(row.script, 'utf8');
  const program = (text: string): string => hash(nineAuthorProgram(cwd(), row.script, text));
  expect(program(source)).toBe(row.programSha256);
  expect(hash(source)).not.toBe(row.beforeSha256);
  expect(() => nineAuthorProgram(cwd(), row.script, source.replace("resolve(import.meta.dirname, '..')", "resolve(import.meta.dirname, '../outside')")))
    .toThrow('repository');
  expect(program(source.replace('decalAtlasPage.ts', 'wrongPage.ts'))).not.toBe(row.programSha256);
  const output = "resolve(root, 'public', source.url.slice(1))";
  expect(source).toContain(output);
  expect(program(source.replace(output, "resolve(root, 'elsewhere', source.url.slice(1))"))).not.toBe(row.programSha256);
  expect(program(source.replace("'--check'", "'--write'"))).not.toBe(row.programSha256);
  expect(program(source.replace('await session.dispose()', 'void session.dispose()'))).not.toBe(row.programSha256);
  expect(program(source.replace('!Buffer.from(image.pixels).equals(original)', 'false'))).not.toBe(row.programSha256);
  expect(program(source.replace("'../src/shards/nine-dragon-stack/data/nativeDecals.json'", "'../src/shards/nine-dragon-stack/data/other.json'"))).not.toBe(row.programSha256);
});

test('native decal documentation keeps the browser lane and read-only check flag', () => {
  const readme = readFileSync('src/shards/nine-dragon-stack/README.md', 'utf8');
  expect(readme).toContain('bash scripts/browser-lane.sh node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-nine-decal-atlas.mjs --check');
});
