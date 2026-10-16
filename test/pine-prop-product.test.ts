import { expect, test } from 'vitest';
import * as v from 'valibot';
import rows from '../src/shards/pine-hollow/data/props.json' with { type: 'json' };
import { output } from '../src/shards/pine-hollow/generators/output';
import { PropRowsSchema } from '../src/shards/pine-hollow/runtime/world/props';

test('named prop rows preserve every ordered pose and collider flag and refuse malformed records', () => {
  const file = output.namedFiles.find(row => row.name === 'world/props.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing named prop rows');
  const admitted = v.parse(PropRowsSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  expect(admitted).toEqual(rows);
  expect(() => v.parse(PropRowsSchema, { ...rows, rocks: [[6, 1, 0, 0, 0, 0, 0, 0, 1, 1]] })).toThrow();
  expect(() => v.parse(PropRowsSchema, { ...rows, logs: [[0, 0, 0, 0, 0, 0, 1]] })).toThrow();
  expect(() => v.parse(PropRowsSchema, { ...rows, stumps: [[0, 0, 0, 0, 0, 0, 1, Infinity]] })).toThrow();
  expect(() => v.parse(PropRowsSchema, { ...rows, extra: true })).toThrow();
});
