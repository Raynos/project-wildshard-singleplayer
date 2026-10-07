// oxlint-disable-next-line import/no-nodejs-modules -- Read committed rejection fixtures.
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { SHARDFILE_VERSION } from '@wildshard/sdk/version';

const dir = 'test/fixtures/shardfile/';
it('parses an empty renderer-neutral world', () => {
  expect(parseShardfile(JSON.parse(readFileSync(`${dir}empty.json`, 'utf8'))).version).toBe(SHARDFILE_VERSION);
});
it.each(readdirSync(dir).filter((f) => f.startsWith('reject-')))('rejects %s', (file) => {
  expect(() => parseShardfile(JSON.parse(readFileSync(dir + file, 'utf8')))).toThrow();
});
