import { expect, it } from 'vitest';
import { compileScript } from '../../scripts/compile-script.mjs';
import { CONFORMANCE_SOURCE } from '../fixtures/script-conformance/source.mjs';
import { runConformance } from '../fixtures/script-conformance/run';

it('replays identical query replies and restores complete libm/memory/global/actor state', async () => {
  const bytes = await compileScript(CONFORMANCE_SOURCE), ticks = 12;
  const queries = Array.from({ length: ticks }, (_v, i) => [1, 2].map((entity) => ({ kind: (i + 1) % 4 + 1, input: Array.from({ length: 8 }, (_n, at) => i + 1 + at), entity, reply: [entity * 0.25, i + 1, 0] }))).flat();
  const result = runConformance({ bytes: Array.from(bytes), queries, ticks, checkpoint: 5 });
  expect(result.calls).toHaveLength(12); expect(result.queries).toBe(24); expect(result.restored).toBe(result.final);
  expect(() => runConformance({ bytes: Array.from(bytes), queries: [], ticks, checkpoint: 5 })).toThrow();
});
