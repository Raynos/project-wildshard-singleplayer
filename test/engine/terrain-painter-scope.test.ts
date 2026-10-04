import { describe, expect, it, vi } from 'vitest';
import { Mesh, MeshLambertMaterial, PlaneGeometry } from 'three';
import { Terrain } from '../../src/engine/world/Terrain';
import { Scope } from '../../src/engine/app/scope';
import type { TerrainPainter } from '../../src/engine/render/look';
import { patchShader, patchIds, PATCH_ORDER } from '../../src/engine/render/shaderPatches';

describe('terrain painter ownership', () => {
  it('passes the owning scope so resources and shader edits disappear on unload', async () => {
    const scope = new Scope('painter-test'), geometry = new PlaneGeometry(), material = new MeshLambertMaterial();
    const disposeGeometry = vi.spyOn(geometry, 'dispose'), disposeMaterial = vi.spyOn(material, 'dispose');
    const painter: TerrainPainter = { build: (terrain, _field, owner) => {
      expect(owner).toBe(scope);
      owner.own(geometry); owner.own(material);
      patchShader(material, 'painter.test', PATCH_ORDER.decorate, () => undefined, { scope: owner });
      terrain.material = material; terrain.mesh = new Mesh(geometry, material); terrain.group.add(terrain.mesh);
      return Promise.resolve();
    } };
    const terrain = new Terrain();
    try {
      await terrain.build({}, painter, scope);
      expect(patchIds(material)).toContain('painter.test');
    } finally { scope.dispose(); }
    expect(patchIds(material)).not.toContain('painter.test');
    expect(disposeGeometry).toHaveBeenCalledTimes(1); expect(disposeMaterial).toHaveBeenCalledTimes(1);
  });
  it('rejects a custom painter without a live scope before it allocates resources', async () => {
    const build = vi.fn(() => Promise.resolve()), scope = new Scope('disposed-painter'); scope.dispose();
    await expect(new Terrain().build({}, { build })).rejects.toThrow('live owning level scope');
    await expect(new Terrain().build({}, { build }, scope)).rejects.toThrow('live owning level scope');
    expect(build).not.toHaveBeenCalled();
  });
});
