// oxlint-disable-next-line import/no-nodejs-modules -- Verify the relocated native witness's exact original program.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { authorToolProgram } from './fixtures/author-tool-source';
import { hashImmutableBytes } from '../src/sdk/immutable';
import original from './fixtures/driftwood-trail-models-original.json' with { type: 'json' };

test('the native trail model witness retains its entire original program and imports', () => {
  const file = 'test/fixtures/driftwood-trail-models.ts';
  const program = authorToolProgram(process.cwd(), file, readFileSync(file, 'utf8'));
  expect(hashImmutableBytes(new TextEncoder().encode(program))).toBe(original.hash);
});
