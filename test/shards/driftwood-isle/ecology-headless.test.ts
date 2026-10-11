import { expect, it } from 'vitest';
import { RngService } from '../../../src/engine/core/rng';
import { RespawnQueue as PageQueue } from '../../../src/shards/driftwood-isle/quest/Ecology';
import { RespawnQueue } from '../../../src/shards/driftwood-isle/runtime/ecology';
import { RESPAWN, OUT_OF_SIGHT } from '../../../src/shards/driftwood-isle/data/ecology';

it('preserves the actual page ecology rules, reverse queue order, night/distance fences and every spawn-stream draw', () => {
  expect(RESPAWN).toEqual({ crab: { delay: [240, 360] }, monkey: { delay: [300, 420] }, boar: { delay: [300, 420] }, bear: { delay: [600, 900] }, sailor: { delay: [180, 180], night: true } }); expect(OUT_OF_SIGHT).toBe(60);
  const a = new RngService(0x5ea1), b = new RngService(0x5ea1);
  const page = new PageQueue(RESPAWN, () => a.stream('spawn').next()), native = new RespawnQueue(RESPAWN, () => b.stream('spawn').next());
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
