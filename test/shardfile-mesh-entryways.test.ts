import { describe, expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { bakeWorldCollision } from '../src/sdk/bake/worldCollision';
import type { WorldPrimitive } from '../src/sdk/bake/world';
import { encodeMeshCollision } from '../src/engine/core/meshCollision';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { validateMeshEntryways } from '../src/game/shardfile/meshEntryways';
import { validateSocketLandings } from '../src/game/shardfile/entryLanding';
import { validateEntrywayClearance } from '../src/game/shardfile/entryClearance';
import type { ShardMeshCollision } from '../src/game/shardfile/meshCollision';

function rectangle(x0: number, x1: number, z0: number, z1: number, y = 0): WorldPrimitive {
  return { node: 'ground', objectId: null, material: 0, terrain: false,
    positions: Float64Array.of(x0, y, z0, x1, y, z0, x0, y, z1, x1, y, z1), indices: Uint32Array.of(0, 2, 1, 1, 2, 3),
    normals: null, colours: null, uv: null, tangents: null };
}
const north = () => rectangle(-4, 4, 235, 250);
const others = () => [rectangle(-4, 4, -250, -235), rectangle(235, 250, -4, 4), rectangle(-250, -235, -4, 4)];
function fixture(geometry = [north(), ...others()]) {
  const source = emptyShardfile({ slug: 'mesh-entries', name: 'Mesh entries', author: 'Fixture', revision: 1, seed: 1 });
  const bake = bakeWorldCollision({ collision: geometry, panels: [] });
  const meshCollision: ShardMeshCollision = { version: 1, tiles: bake.tiles.map(({ x, z, file }) => ({ x, z, file })), panels: [] };
  return { source: { ...source, meshCollision }, assets: bake.assets };
}
function panel(f: ReturnType<typeof fixture>, geometry: WorldPrimitive, initialActive: boolean): void {
  const bytes = encodeMeshCollision({ vertices: Float32Array.from(geometry.positions), indices: geometry.indices }), file = hashImmutableBytes(bytes);
  f.assets.set(file, bytes); f.source.meshCollision.panels.push({ id: 'deck.collider', panel: 'deck', file, initialActive });
}

describe('actual mesh entry footprints', () => {
  it('accepts all four full footprints split at the native tile lattice, regardless of winding', () => {
    const f = fixture(); expect(f.source.meshCollision.tiles).toHaveLength(8);
    expect(() => validateMeshEntryways(f.source, f.assets)).not.toThrow();
    const reverse = [north(), ...others()].map(row => Object.assign(row, { indices: Uint32Array.of(0, 1, 2, 1, 3, 2) }));
    expect(() => { const reversed = fixture(reverse); validateMeshEntryways(reversed.source, reversed.assets); }).not.toThrow();
  });
  it.each(['gap', 'missing-half', 'below-road', 'slope'] as const)('refuses %s even with a forged flat edge profile', problem => {
    const rows = problem === 'gap' ? [rectangle(-4, 0.123, 235, 250), rectangle(0.124, 4, 235, 250)]
      : problem === 'missing-half' ? [rectangle(-4, 0, 235, 250)] : [rectangle(-4, 4, 235, 250, -0.01)];
    if (problem === 'slope') { const row = rows[0]; if (row === undefined) throw new Error('Slope fixture'); row.positions[1] = 0; row.positions[4] = 0; }
    const f = fixture([...rows, ...others()]);
    expect(() => validateMeshEntryways(f.source, f.assets)).toThrow('north requires continuous road-height ground');
  });
  it.each([true, false])('interactive deck initialActive=%s cannot prove missing permanent ground', active => {
    const f = fixture(others()); panel(f, north(), active);
    expect(() => validateMeshEntryways(f.source, f.assets)).toThrow('north requires continuous road-height ground');
  });
  it.each([true, false])('refuses above-road geometry in potential panel state initialActive=%s', active => {
    const f = fixture(); panel(f, rectangle(-0.05, 0.05, 242, 242.1, 0.001), active);
    expect(() => validateMeshEntryways(f.source, f.assets)).toThrow('north footprint obstructed');
  });
  it('allows below-road mesh layers under a complete surface, but not an overhead bridge', () => {
    const f = fixture([north(), rectangle(-4, 4, 235, 250, -2), ...others()]);
    expect(() => validateMeshEntryways(f.source, f.assets)).not.toThrow();
    const overhead = fixture([north(), rectangle(-1, 1, 240, 241, 3), ...others()]);
    expect(() => validateMeshEntryways(overhead.source, overhead.assets)).toThrow('footprint obstructed');
  });
  it('admits socketOverWater only with a real full-width static landing and explicit dry water exclusion', () => {
    const f = fixture([rectangle(-4, 4, 235, 250, -0.8), rectangle(-4, 4, 234, 235), ...others()]);
    const entry = f.source.entryways.find(row => row.edge === 'north'); if (entry === undefined) throw new Error('North fixture'); entry.kind = 'socketOverWater';
    f.source.water = [{ id: 'sea', kind: 'sea', level: 0, waves: false, dryEntries: ['north'] }];
    // Other ground entries remain dry in this focused water witness.
    f.source.water[0] = { id: 'pool', kind: 'pool', level: 0, shape: { kind: 'circle', x: 0, z: 245, radius: 1 }, dryEntries: ['north'] };
    expect(() => validateMeshEntryways(f.source, f.assets)).not.toThrow();
    expect(() => validateSocketLandings(f.source, f.assets)).not.toThrow();
    expect(() => validateEntrywayClearance(f.source, f.assets)).not.toThrow();
    f.source.water[0] = { id: 'pool', kind: 'pool', level: 0, shape: { kind: 'circle', x: 0, z: 245, radius: 1 } };
    expect(() => validateEntrywayClearance(f.source, f.assets)).toThrow('must be dry');
  });
  it('a socket cannot claim its own floor or an interactive landing; a narrow landing crack is refused', () => {
    for (const landing of [[], [rectangle(-4, 0.123, 234, 235), rectangle(0.124, 4, 234, 235)]]) {
      const f = fixture([rectangle(-4, 4, 235, 250, -0.8), ...landing, ...others()]);
      const entry = f.source.entryways.find(row => row.edge === 'north'); if (entry === undefined) throw new Error('North fixture'); entry.kind = 'socketOverWater';
      panel(f, rectangle(-4, 4, 234, 235), true);
      expect(() => validateSocketLandings(f.source, f.assets)).toThrow('full-width collision landing');
    }
  });
});
