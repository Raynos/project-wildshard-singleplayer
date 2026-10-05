import type { BufferGeometry, Mesh } from 'three';

/**
 * G99 (every shard is a 500 × 500 × 500 cube): standalone, the dune sea's skirt (look/render.ts) runs on past the painted
 * ground to 520 m, under the far ranges. In a grid cell the road and the neighbours stand past 250 m, so the plugin
 * (`ctx.cube`) cuts the skirt back to the cube: it still fills the band between the painted ground's edge (240 m) and the
 * cell's (250 m), and nothing of it draws beyond. The look builds the skirt before the plugin's context exists, so it
 * hands the mesh over here.
 */
/** What owns the skirt's geometry: the look's level scope (only the verbs used here). */
interface SkirtOwner { readonly disposed: boolean; own: (geometry: BufferGeometry) => BufferGeometry; onDispose: (fn: () => void) => void }
interface HeldSkirt { readonly mesh: Mesh; readonly rebuild: (half: number) => BufferGeometry; readonly scope: SkirtOwner; half: number | null }
let held: HeldSkirt | null = null;

/** The look: this level's skirt and how to rebuild it out to a given half width (released with its scope). */
export function holdSkirt(mesh: Mesh, rebuild: (half: number) => BufferGeometry, scope: SkirtOwner): void {
  const entry: HeldSkirt = { mesh, rebuild, scope, half: null };
  held = entry;
  scope.onDispose(() => { if (held === entry) held = null; });
}

/** The plugin, in a grid cell: rebuild the skirt to end at the cube's edge (idempotent per half width). */
export function fitSkirtToCube(half: number): void {
  const entry = held;
  if (entry === null || entry.scope.disposed || entry.half === half) return;
  const old = entry.mesh.geometry, geometry = entry.rebuild(half);
  entry.scope.own(geometry);
  entry.mesh.geometry = geometry; entry.half = half;
  old.dispose();
}

/** Tests and captures: the held skirt's horizontal reach (m) from the shard's centre, or null when none is held. */
export function skirtReach(): number | null {
  const entry = held;
  if (entry === null) return null;
  const geometry = entry.mesh.geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  return box === null ? null : Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
}
