// oxlint-disable-next-line import/no-nodejs-modules -- Check the SDK's committed package contract without installing anything.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('publishes every defining author module with its emitted JS and portable declaration path', () => {
  const data: unknown = JSON.parse(readFileSync('src/sdk/package.json', 'utf8'));
  if (typeof data !== 'object' || data === null || !('exports' in data) || typeof data.exports !== 'object' || data.exports === null
    || !('publishConfig' in data) || typeof data.publishConfig !== 'object' || data.publishConfig === null
    || !('exports' in data.publishConfig)) throw new Error('Invalid SDK package contract');
  const expected: Record<string, { types: string; default: string }> = {};
  for (const [name, source] of Object.entries(data.exports)) {
    if (typeof source !== 'string' || !source.startsWith('./') || !source.endsWith('.ts')) throw new Error('Invalid defining SDK export');
    expected[name] = { types: `./dist/types/sdk/${source.slice(2, -3)}.d.ts`, default: `./dist/${name.slice(2)}.js` };
  }
  expect(data.publishConfig.exports).toEqual(expected);
  expect(expected['./modes']).toBeDefined();
  expect(expected['./species']).toBeDefined();
});
