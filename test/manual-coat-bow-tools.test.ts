// oxlint-disable-next-line import/no-nodejs-modules -- Inspect exact manual command source without publishing assets.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify root/import/output addresses from the shared checkout.
import { cwd } from 'node:process';
import { expect, test } from 'vitest';
import { authorToolProgram } from './fixtures/author-tool-source';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/manual-coat-bow-original.json' with { type: 'json' };

const hash = (source: string): string => hashImmutableBytes(new TextEncoder().encode(source));
for (const row of original) test(`${row.script} retains its complete standalone command and addresses`, () => {
  const source = readFileSync(row.script, 'utf8');
  expect(hash(authorToolProgram(cwd(), row.script, source))).toBe(row.programSha256);
  expect(hash(source)).not.toBe(row.beforeSha256);
  if (row.script === 'scripts/bake-captain-coat.mjs') {
    expect(() => authorToolProgram(cwd(), row.script, source.replace("resolve(import.meta.dirname, '..')", "resolve(import.meta.dirname, '../outside')")))
      .toThrow('repository');
  } else {
    const moved = source.replace("'../public/assets/nalati/baked/'", "'../public/assets/nalati/outside/'");
    expect(hash(authorToolProgram(cwd(), row.script, moved))).not.toBe(row.programSha256);
    const file = source.replace("'../public/assets/nalati/baked/'", "'../public/assets/nalati/baked'");
    expect(hash(authorToolProgram(cwd(), row.script, file))).not.toBe(row.programSha256);
  }
});
