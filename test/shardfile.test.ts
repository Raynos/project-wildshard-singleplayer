// oxlint-disable-next-line import/no-nodejs-modules -- Read committed rejection fixtures.
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { SHARDFILE_VERSION } from '@wildshard/sdk/version';
import { performanceTargetIssues } from '../src/game/shardfile/reportCard';
import { memoryTargetWarnings } from '../src/game/shardfile/budget';

const dir = 'test/fixtures/shardfile/';
it('parses an empty renderer-neutral world', () => {
  expect(parseShardfile(JSON.parse(readFileSync(`${dir}empty.json`, 'utf8'))).version).toBe(SHARDFILE_VERSION);
});
it.each(readdirSync(dir).filter((f) => f.startsWith('reject-')))('rejects %s', (file) => {
  expect(() => parseShardfile(JSON.parse(readFileSync(dir + file, 'utf8')))).toThrow();
});
it.each(readdirSync(dir).filter((f) => f.startsWith('warn-')))('warns instead of refusing category memory in %s', (file) => {
  const shard = parseShardfile(JSON.parse(readFileSync(dir + file, 'utf8')));
  expect(memoryTargetWarnings(shard)).toHaveLength(1);
});

it.each(readdirSync(dir).filter(file => file.startsWith('target-')))('grades %s at the build boundary instead of corrupting the format', file => {
  const shard = parseShardfile(JSON.parse(readFileSync(dir + file, 'utf8')));
  expect(performanceTargetIssues(shard).some(issue => issue.severity === 'refusal')).toBe(true);
  expect(performanceTargetIssues(shard, 'warn').every(issue => issue.severity === 'warning')).toBe(true);
});
