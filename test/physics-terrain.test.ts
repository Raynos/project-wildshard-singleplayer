// PHYSICS.md P1: the Rapier heightfield is the terrain the player sees. For both shards' baked grids, 10 k random rays
// straight down must land within 2 cm of the rendered mesh's triangles (three's PlaneGeometry, rotated flat: each cell
// split along its (x0, z1)–(x1, z0) diagonal) — which also proves the row / column layout and the diagonal match.
import { describe, expect, it } from 'vitest';
import { loadRapier } from '../src/physics/rapier';
import { Physics } from '../src/physics/Physics';
import { addEdgeWalls, addTerrain, EDGE_WALL_INSET } from '../src/physics/terrain';
import { parseBakedTerrain } from '../src/world/BakedTerrain';
import { Rng } from '../src/core/rng';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import driftwoodBake from '../public/assets/baked/driftwood-isle/terrain.bin?inline';
import pineBake from '../public/assets/baked/pine-hollow/terrain.bin?inline';

/** A `?inline` import is a data: URL (tests run in plain node, no file access): its bytes. */
const bytesOf = async (dataUrl: string): Promise<ArrayBuffer> => (await fetch(dataUrl)).arrayBuffer();
const wasm = () => bytesOf(wasmInline);
const BAKES: Record<string, string> = { 'driftwood-isle': driftwoodBake, 'pine-hollow': pineBake };

async function grid(slug: string) {
  const g = parseBakedTerrain(await bytesOf(BAKES[slug] ?? ''));
  if (!g) throw new Error(`${slug}: no bake`);
  return g;
}

/** The rendered surface: the triangle of the mesh cell under (x, z). `flip`: the other diagonal (the test's control). */
function meshHeight(h: Float32Array, res: number, size: number, x: number, z: number, flip = false): number {
  const u = (x + size / 2) * (res - 1) / size, v = (z + size / 2) * (res - 1) / size;
  const ix = Math.min(res - 2, Math.floor(u)), iz = Math.min(res - 2, Math.floor(v));
  const fx = u - ix, fz = v - iz;
  const h00 = h[iz * res + ix] ?? 0, h10 = h[iz * res + ix + 1] ?? 0, h01 = h[(iz + 1) * res + ix] ?? 0, h11 = h[(iz + 1) * res + ix + 1] ?? 0;
  if (flip) return fx >= fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

describe('physics terrain', () => {
  for (const slug of ['driftwood-isle', 'pine-hollow']) {
    it(`${slug}: the heightfield matches the rendered mesh to 2 cm over 10 k rays`, async () => {
      const R = await loadRapier(await wasm());
      const g = await grid(slug);
      const physics = new Physics(R);
      addTerrain(physics, g.heights, g.res, g.size);
      physics.world.step(); // builds the query structures
      const rng = new Rng(7);
      const half = g.size / 2 - 0.5;
      let worst = 0, control = 0;
      for (let i = 0; i < 10_000; i++) {
        const x = rng.range(-half, half), z = rng.range(-half, half);
        const hit = physics.world.castRay(new R.Ray({ x, y: 500, z }, { x: 0, y: -1, z: 0 }), 2000, true);
        expect(hit).not.toBeNull();
        const y = 500 - (hit?.timeOfImpact ?? 0);
        worst = Math.max(worst, Math.abs(y - meshHeight(g.heights, g.res, g.size, x, z)));
        control = Math.max(control, Math.abs(y - meshHeight(g.heights, g.res, g.size, x, z, true)));
      }
      physics.dispose();
      expect(worst).toBeLessThan(0.02);
      expect(control).toBeGreaterThan(0.1); // the other diagonal is visibly off: the ruler can tell them apart
    });
  }

  it('the edge walls stop a ray 1.2 m minus the player radius inside the chunk edge', async () => {
    const R = await loadRapier(await wasm());
    const physics = new Physics(R);
    addEdgeWalls(physics);
    physics.world.step();
    const hit = physics.world.castRay(new R.Ray({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }), 1000, true);
    expect(hit?.timeOfImpact).toBeCloseTo(250 - EDGE_WALL_INSET, 3);
    physics.dispose();
  });
});
