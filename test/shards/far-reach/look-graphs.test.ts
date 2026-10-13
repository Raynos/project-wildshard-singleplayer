import { describe, expect, it } from 'vitest';
import { DEFAULT_GRAPH_BUDGET, graphUsesMeshMap, validateGraph } from '@wildshard/format/materialGraph';
import source from '../../../src/shards/far-reach/shard.config';
import { SKY_SUN } from '../../../src/shards/far-reach/data/skyLook';
import { PANO_SUN } from '../../../src/shards/far-reach/look/panoramaData';

describe('Sky Reach look graphs (SHARD-PLATFORM G382 / G387)', () => {
  it('every look material is an SF59 graph inside the default per-program budget', () => {
    const entries = Object.entries(source.look.materials);
    expect(entries.map(([id]) => id).sort()).toEqual(['crown-dais', 'deck-wood', 'dressing-clump', 'dressing-flower', 'falls', 'hover-frame', 'keeper-scarf', 'lantern-glow', 'post-weather', 'shack-beam', 'shack-plank', 'shack-shingle',
      'shack-stone']);
    for (const [id, entry] of entries) {
      const checked = validateGraph(Reflect.get(entry, 'graph'), { dayKeys: [], stateFields: [], budget: DEFAULT_GRAPH_BUDGET });
      expect(checked.ok ? id : `${id}: ${checked.errors.join('; ')}`).toBe(id);
    }
  });

  it('the looks over a model map read it once (meshMap: one sampler)', () => {
    for (const id of ['crown-dais', 'keeper-scarf', 'lantern-glow', 'post-weather']) {
      const checked = validateGraph(Reflect.get(source.look.materials[id] ?? {}, 'graph'));
      expect(checked.ok && graphUsesMeshMap(checked.graph) && checked.cost.samplers === 1 ? id : `${id}: not one meshMap sampler`).toBe(id);
    }
  });

  it('the painted light graph lights from the sun the panorama paints', () => {
    const h = (PANO_SUN.heading * Math.PI) / 180, e = (PANO_SUN.elevation * Math.PI) / 180;
    const sun = [Math.sin(h) * Math.cos(e), Math.sin(e), -Math.cos(h) * Math.cos(e)];
    expect(SKY_SUN.map((v, i) => v - (sun[i] ?? 0)).every((d) => Math.abs(d) < 1e-12)).toBe(true);
  });
});
