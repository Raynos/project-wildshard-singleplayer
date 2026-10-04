import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Material } from 'three';
import { coarseTileMask } from '../src/engine/world/coarseTileMask';
import { patchIds } from '../src/engine/render/shaderPatches';
import { Scope } from '../src/engine/app/scope';

// SF15a × SF9b: equal surfaces share one material across tiles, so a coarse tile's mask must patch its own variant,
// never the shared material (patching the shared one appended the mask once per tile and redefined wsCoarseXZ)
describe('coarse tile mask on shared prop materials', () => {
  it('gives each coarse tile its own variant with the mask once, one program, and restores on dispose', () => {
    const shared: Material = new MeshStandardMaterial();
    const tiles = [0, 1, 2, 3].map((x) => {
      const meshes: Mesh<BoxGeometry, Material>[] = [new Mesh(new BoxGeometry(), shared), new Mesh(new BoxGeometry(), shared)];
      const root = new Group(); root.add(...meshes);
      return { root, x, meshes, scope: new Scope('test.coarse-tile') };
    });
    for (const { root, x, scope } of tiles) coarseTileMask(root, x, 0, scope);
    const variants = tiles.map(({ meshes }) => {
      const materials = new Set(meshes.map((mesh) => mesh.material));
      expect(materials.size).toBe(1); // one variant per tile, shared by the tile's meshes
      const [material] = [...materials];
      if (material === undefined) throw new Error('no variant');
      return material;
    });
    expect(new Set(variants).size).toBe(4);
    expect(variants).not.toContain(shared);
    expect(patchIds(shared)).not.toContain('engine.coarse-tile-mask');
    for (const material of variants) expect(patchIds(material).filter((id) => id === 'engine.coarse-tile-mask')).toHaveLength(1);
    expect(new Set(variants.map((material) => material.customProgramCacheKey())).size).toBe(1); // one program for every coarse tile
    for (const { scope } of tiles) scope.dispose();
    for (const { meshes } of tiles) for (const mesh of meshes) expect(mesh.material).toBe(shared);
  });
});
