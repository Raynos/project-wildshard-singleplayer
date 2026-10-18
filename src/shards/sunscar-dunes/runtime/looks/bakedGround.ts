/**
 * A baked ground (SHARD-PLATFORM M3; ex a dune shard's sand): the pieces a level whose ground is its compiled shardfile
 * terrain tiles draws round them, each driven by rows. Nothing here knows a shard.
 *
 * - `CubeSkirt`: the baked skirt past the ground's edge (a geometry pack), cut back to a grid cell's cube, worn in the
 *   ground's material once the data client lends it.
 */
import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { GeometryPack, fetchDeflated, packedRows, type PackedGeometryJson } from '@wildshard/sdk/kit/geometryPack';
import type { Scope } from '@wildshard/engine/app/scope';

/**
 * G99 (every shard is a 500 m cube): the skirt past the ground's edge, baked as a geometry pack (geometry 0 the standalone
 * skirt, geometry 1 cut to the cube's `cubeHalf`). The look loads it and holds the mesh, so the plugin can dress it in the
 * ground's material (`wear`) and swap in the cube's cut in a grid cell (`fit`); released with its scope.
 */
interface HeldSkirt { readonly parent: Object3D; readonly mesh: Mesh; readonly cube: BufferGeometry; readonly half: number; readonly scope: Scope }
export class CubeSkirt {
  private held: HeldSkirt | null = null;
  /**
   * The look: load the pack `url` (its `rows`) and hold its standalone skirt for `parent`, undrawn until worn; a pack that
   * fails to load is a page fault (`fault`): no skirt draws. The mesh is made here, before the ground's tiles: where the
   * skirt and a tile lie at the same depth and distance, the renderer orders them by creation, so the skirt keeps drawing
   * first, as it always has.
   */
  async load(parent: Object3D, pack: { readonly url: string; readonly rows: PackedGeometryJson & { readonly cubeHalf: number }; readonly fault: string }, scope: Scope): Promise<void> {
    let standalone: BufferGeometry, cube: BufferGeometry;
    try {
      const geometries = new GeometryPack(await fetchDeflated(pack.url), packedRows(pack.rows), 'skirt');
      standalone = geometries.geometry(0); cube = geometries.geometry(1);
    } catch (error: unknown) { console.error(pack.fault, error); return; }
    const mesh = new Mesh(scope.own(standalone), []), held: HeldSkirt = { parent, mesh, cube, half: pack.rows.cubeHalf, scope };
    mesh.receiveShadow = false; this.held = held;
    scope.onDispose(() => { mesh.removeFromParent(); cube.dispose(); if (this.held === held) this.held = null; });
  }
  /** The runtime: draw the held skirt in the ground's material (the data client's lent sand) at the tiles' draw `order`; once. */
  wear(material: Material, order = 0): void {
    const held = this.held;
    if (held?.mesh.parent !== null) return;
    held.mesh.material = material; held.mesh.renderOrder = order; held.parent.add(held.mesh);
  }
  /** The plugin, in a grid cell: the skirt ends at the cube's edge (the baked cut's half width). */
  fit(half: number): void {
    const held = this.held;
    if (held === null || held.mesh.geometry === held.cube) return;
    if (half !== held.half) throw new Error(`the skirt is baked for a ${String(held.half)} m cube, not ${String(half)} m`);
    const old = held.mesh.geometry;
    held.mesh.geometry = held.scope.own(held.cube);
    old.dispose();
  }
}
