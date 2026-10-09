import { expect, it } from 'vitest';
import { RngService } from '../../../src/engine/core/rng';
import { RespawnQueue as PageQueue, RESPAWN as PAGE_RULES, OUT_OF_SIGHT as PAGE_AWAY } from '../../../src/shards/driftwood-isle/quest/Ecology';
import { RespawnQueue, RESPAWN, OUT_OF_SIGHT } from '../../../src/shards/driftwood-isle/runtime/ecology';

it('preserves the actual page ecology rules, reverse queue order, night/distance fences and every spawn-stream draw', () => {
  expect(RESPAWN).toEqual(PAGE_RULES); expect(OUT_OF_SIGHT).toBe(PAGE_AWAY);
  const a = new RngService(0x5ea1), b = new RngService(0x5ea1);
  const page = new PageQueue(PAGE_RULES, () => a.stream('spawn').next()), native = new RespawnQueue(RESPAWN, () => b.stream('spawn').next());
  const kinds = ['boar', 'sailor', 'crab', 'monkey', 'bear', 'captain'];
  for (let second = 0; second < 1200; second++) {
    if (second % 47 === 0) {
      const kind = kinds[Math.floor(second / 47) % kinds.length]; if (kind === undefined) throw new Error('missing kind');
      expect(native.add(kind, 'test', 2, 0, 0, second)).toEqual(page.add(kind, 'test', 2, 0, 0, second));
    }
    const x = second % 5 === 0 ? 60 : 59.999, night = second % 7 === 0 ? 0.5 : 0.499;
    expect(native.take(second, x, 0, night)).toEqual(page.take(second, x, 0, night));
    expect(native.pending).toEqual(page.pending); expect(b.snapshot()).toEqual(a.snapshot());
  }
});
