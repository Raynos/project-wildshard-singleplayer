import { describe, expect, it } from 'vitest';
import { validateGraph } from '../src/format/materialGraph';
import { ISLAND_GRAPHS, ISLAND_LOOKS } from '../src/shards/driftwood-isle/data/islandLook';
import source from '../src/shards/driftwood-isle/shard.config';

describe('Driftwood baked cove graph looks', () => {
  it('declares every cove material as a valid graph toon look', () => {
    for (const id of Object.values(ISLAND_LOOKS)) {
      const graph = ISLAND_GRAPHS[id];
      expect(graph?.model, id).toBe('toon');
      const checked = validateGraph(graph);
      expect(checked.ok ? [] : checked.errors, id).toEqual([]);
      expect(source.look.materials[id]?.family, id).toBe('graph');
    }
  });

  it('reads no per-instance attributes on the copies: tint, origin, edge and ground come from the engine and the graph', () => {
    const attributes = (id: string): string[] => Object.values(ISLAND_GRAPHS[id]?.nodes ?? {}).flatMap(node => node.op === 'attribute' && node.name !== undefined ? [node.name] : []).sort();
    expect(attributes(ISLAND_LOOKS.props)).toEqual([]);
    expect(attributes(ISLAND_LOOKS.cover)).toEqual([]);
    expect(attributes(ISLAND_LOOKS.terrain)).toEqual(['aCover', 'aCoverSide']);
  });
});
