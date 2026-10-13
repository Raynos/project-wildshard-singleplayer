import { describe, expect, it } from 'vitest';
import { DEFAULT_GRAPH_BUDGET, validateGraph } from '@wildshard/format/materialGraph';
import source from '../../../src/shards/far-reach/shard.config';
import { SKY_SUN } from '../../../src/shards/far-reach/data/skyLook';
import { SUN_DIR } from '../../../src/shards/far-reach/look/sun';

describe('Sky Reach look graphs (SHARD-PLATFORM G382 / G387)', () => {
  it('every look material is an SF59 graph inside the default per-program budget', () => {
    const entries = Object.entries(source.look.materials);
    expect(entries.map(([id]) => id).sort()).toEqual(['deck-wood', 'dressing-clump', 'dressing-flower', 'falls', 'hover-frame', 'shack-beam', 'shack-plank', 'shack-shingle', 'shack-stone']);
    for (const [id, entry] of entries) {
      const checked = validateGraph(Reflect.get(entry, 'graph'), { dayKeys: [], stateFields: [], budget: DEFAULT_GRAPH_BUDGET });
      expect(checked.ok ? id : `${id}: ${checked.errors.join('; ')}`).toBe(id);
    }
  });

  it('the painted light graph lights from the sun the panorama paints', () => {
    expect([...SKY_SUN]).toEqual([SUN_DIR.x, SUN_DIR.y, SUN_DIR.z]);
  });
});
