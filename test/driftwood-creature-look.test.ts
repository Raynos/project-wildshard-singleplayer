import { describe, expect, it } from 'vitest';
import { validateGraph } from '../src/format/materialGraph';
import { CREATURE_INSTALL, CREATURE_LOOKS } from '../src/shards/driftwood-isle/generators/creatureLook';
import lookGraphs from '../src/shards/driftwood-isle/data/lookGraphs.json' with { type: 'json' };
import { authoredGraphs } from './fixtures/authoredGraphs';
import source from '../src/shards/driftwood-isle/shard.config';
import { lentGraphLook } from '../src/game/population/productCreatures';
import * as THREE from 'three';
import type { Animal } from '../src/engine/entities/AnimalView';
import { legacyDouble } from './fake/FakeGame';
import { CRAB_LOOK } from './fake/driftwoodLooks';

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
    const look = lentGraphLook(CRAB_LOOK, CREATURE_INSTALL.lent);
    expect(look.faceted).toBe(true);
    expect(look.kind).toBe(CRAB_LOOK.kind);
  });

  it('halves a blow on the crab shell from the front, not from the flank', () => {
    const crab = legacyDouble<Animal>({ yaw: 0 }), hit = new THREE.Vector3(), damage = CRAB_LOOK.damageMul;
    expect(damage?.(crab, hit, new THREE.Vector3(0, 0, -1))).toBe(0.5);
    expect(damage?.(crab, hit, new THREE.Vector3(-1, 0, 0))).toBe(1);
    expect(damage?.(crab, hit, new THREE.Vector3(0, 0, 1))).toBe(1);
  });
});
