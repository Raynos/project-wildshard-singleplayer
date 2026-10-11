// oxlint-disable-next-line import/no-nodejs-modules -- Selects the defining checkout for the source-only authoring audit.
import process from 'node:process';
import { expect, it } from 'vitest';
import { RESIN_FLAG, TOKEN_FLAG, SECRET_FLAGS, RESIN_SPOTS, RESIN_COUNT, TOKEN_NAMES, PINE_GRAPH_DATA, PINE_TABLE_ACTIONS, PINE_LANTERN_ROWS } from '../../../src/shards/pine-hollow/data/interactions';
import * as legacy from '../../../src/shards/pine-hollow-legacy/quest/table';
import { PINE_GRAPH } from '../../../src/shards/pine-hollow/quest/graph';
import { auditAuthoringInputs } from '../../../scripts/authoring-inputs.mjs';

it('preserves authored pickup placements, flag vocabulary, token labels and stable quest command ids', () => {
  expect(RESIN_FLAG).toBe(legacy.RESIN_FLAG);
  expect(TOKEN_FLAG).toBe(legacy.TOKEN_FLAG);
  expect(SECRET_FLAGS).toStrictEqual(legacy.SECRET_FLAGS);
  expect(RESIN_SPOTS).toStrictEqual(legacy.RESIN_SPOTS);
  expect(RESIN_COUNT).toBe(legacy.RESIN_COUNT);
  expect(TOKEN_NAMES).toStrictEqual(legacy.TOKEN_NAMES);
  expect(PINE_GRAPH_DATA).toStrictEqual(PINE_GRAPH);
  expect(PINE_TABLE_ACTIONS.map(row => [row.id, row.act])).toStrictEqual([
    ['dam-log-a', 1], ['dam-log-b', 2], ['pond-glass', 3], ['ridge-flint', 4],
    ...Array.from({ length: 8 }, (_, i) => [`token-${i + 1}`, 10 + i]), ['lookout-bench', 18],
  ]);
  expect(PINE_LANTERN_ROWS.map(row => [row.id, row.act, row.sets])).toStrictEqual([
    ['lantern.pond', 5, ['lit:pond']], ['lantern.ridge', 6, ['lit:ridge']], ['lantern.den', 7, ['lit:den']],
  ]);
});

it('keeps the actual row metadata in one independent authoring input', () => {
  const audit = auditAuthoringInputs(process.cwd(), 'pine-hollow', 'src/shards/pine-hollow/data/interactions.ts');
  expect(audit.issues).toEqual([]);
  expect(audit.files).toEqual(['src/shards/pine-hollow/data/interactions.ts']);
});
