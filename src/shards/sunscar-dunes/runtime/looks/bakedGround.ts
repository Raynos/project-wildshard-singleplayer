/**
 * A baked ground (SHARD-PLATFORM M3; ex a dune shard's sand): the pieces a level whose ground is its compiled shardfile
 * terrain tiles draws round them, each driven by rows. Nothing here knows a shard.
 *
 * - `CubeSkirt`: the baked skirt past the ground's edge (a geometry pack), cut back to a grid cell's cube, worn in the
 *   ground's material once the data client lends it.
 * - `lentMaterial`: the data client's built ground material, its curves reading the runtime's host fields.
 */
import { Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { GeometryPack, fetchDeflated, packedRows, type PackedGeometryJson } from '@wildshard/sdk/kit/geometryPack';
import type { Scope } from '@wildshard/engine/app/scope';
import { runtimePresentation } from '@wildshard/game/shardfile/runtimeProduct';
import type { Shardfile } from '@wildshard/format/shardSchema';

/** What owns the skirt's geometry: the look's level scope (only the verbs used here). */
export interface SkirtOwner { readonly disposed: boolean; own: (geometry: BufferGeometry) => BufferGeometry; onDispose: (fn: () => void) => void }

/**
 * G99 (every shard is a 500 m cube): the skirt past the ground's edge, baked as a geometry pack (geometry 0 the standalone
 * skirt, geometry 1 cut to the cube's `cubeHalf`). The look loads it and holds the mesh, so the plugin can swap in the cube's
 * cut in a grid cell (`fit`, once); released with its scope. A pack that fails to load is a page fault: no skirt draws.
 */
interface HeldSkirt { readonly parent: Object3D; readonly mesh: Mesh; readonly cube: BufferGeometry; readonly half: number; readonly scope: SkirtOwner; fitted: boolean; worn: boolean }
export class CubeSkirt {
  private held: HeldSkirt | null = null;
  /** The look: load the pack (`fault` opens its page fault); the standalone skirt, or null when it did not load. */
  async load(url: string, rows: PackedGeometryJson & { readonly cubeHalf: number }, fault: string): Promise<{ standalone: BufferGeometry; cube: BufferGeometry; half: number } | null> {
    try {
      const pack = new GeometryPack(await fetchDeflated(url), packedRows(rows), 'skirt');
      return { standalone: pack.geometry(0), cube: pack.geometry(1), half: rows.cubeHalf };
    } catch (error: unknown) { console.error(fault, error); return null; }
  }
  /**
   * The look: this level's skirt (its standalone geometry and cube cut, `half` its half width), drawn under `parent` once
   * worn. Its mesh is made here, before the ground's tiles: where the skirt and a tile lie at the same depth and distance,
   * the renderer orders them by creation, so the skirt keeps drawing first, as it always has.
   */
  hold(parent: Object3D, geometry: BufferGeometry, cube: BufferGeometry, half: number, scope: SkirtOwner): void {
    const mesh = new Mesh(scope.own(geometry), []); mesh.receiveShadow = false;
    const entry: HeldSkirt = { parent, mesh, cube, half, scope, fitted: false, worn: false };
    this.held = entry;
    scope.onDispose(() => { mesh.removeFromParent(); cube.dispose(); if (this.held === entry) this.held = null; });
  }
  /** The runtime: draw the held skirt in the ground's material (the data client's lent sand) at the tiles' draw `order`; once. */
  wear(material: Material, order = 0): void {
    const entry = this.held;
    if (entry === null || entry.scope.disposed || entry.worn) return;
    entry.mesh.material = material; entry.mesh.renderOrder = order; entry.worn = true; entry.parent.add(entry.mesh);
  }
  /** The plugin, in a grid cell: the skirt ends at the cube's edge (the baked cut's half width). */
  fit(half: number): void {
    const entry = this.held;
    if (entry === null || entry.scope.disposed || entry.fitted) return;
    if (half !== entry.half) throw new Error(`the skirt is baked for a ${String(entry.half)} m cube, not ${String(half)} m`);
    const old = entry.mesh.geometry;
    entry.mesh.geometry = entry.scope.own(entry.cube); entry.fitted = true;
    old.dispose();
  }
}

/**
 * The runtime's world stage: the built material `id` its data client lends (G345, `runtimePresentation`; in a grid cell the
 * region lends it), its look's curves reading the runtime's host fields through `state` while `scope` lives; null when
 * nothing lends this shard's presentation.
 */
export function lentMaterial(source: Shardfile, id: string, scope: Scope, state: (scope: 'shared' | 'player', name: string) => number | undefined): Material | null {
  const lent = runtimePresentation(source); if (lent === null) return null;
  scope.onDispose(lent.bindState(state));
  return lent.material(id);
}
