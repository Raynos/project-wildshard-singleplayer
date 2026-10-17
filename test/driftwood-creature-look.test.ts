import { describe, expect, it } from 'vitest';
import { validateGraph } from '../src/format/materialGraph';
import { CREATURE_LOOKS } from '../src/shards/driftwood-isle/generators/creatureLook';
import lookGraphs from '../src/shards/driftwood-isle/data/lookGraphs.json' with { type: 'json' };
import { authoredGraphs } from './fixtures/authoredGraphs';
import source from '../src/shards/driftwood-isle/shard.config';
import { graphCreatureLook } from '../src/shards/driftwood-isle/runtime/looks/creatureLooks';
import { CRAB_LOOK } from '../src/shards/driftwood-isle/species/crab';

const CREATURE_GRAPHS = authoredGraphs(lookGraphs.looks);

describe('Driftwood creature graph looks', () => {
  it('declares the bodies as valid graph toon looks reading the tint and flash ports', () => {
    for (const id of Object.values(CREATURE_LOOKS)) {
      const graph = CREATURE_GRAPHS[id];
      expect(graph?.model, id).toBe('toon');
      const checked = validateGraph(graph);
      expect(checked.ok ? [] : checked.errors, id).toEqual([]);
      expect(source.look.materials[id]?.family, id).toBe('graph');
      const ops = Object.values(graph?.nodes ?? {}).map(node => node.op);
      expect(ops, id).toContain('materialColour');
      expect(ops, id).toContain('materialEmissive');
    }
  });

  it('keeps a species look faceted on the graph body', () => {
    const look = graphCreatureLook(CRAB_LOOK);
    expect(look.faceted).toBe(true);
    expect(look.kind).toBe(CRAB_LOOK.kind);
  });
});
