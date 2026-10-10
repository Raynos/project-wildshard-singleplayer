import { CircleGeometry, Mesh, type ShaderMaterial } from 'three';
import type { ShaderFamily, UniformMap } from './shaderFamily';

/**
 * A horizontal disc drawn by a shard's own program, as a declared row (SHARD-PLATFORM M3, look-family rows): a cloud sea
 * under floating islands, a painted vortex, a mist floor, any sheet laid flat on the world. Nothing here knows a shard:
 * the program is a row of the shard's `ShaderFamily`, and the disc (its radius and segments, where it sits, its draw order
 * and turn) is data. The disc is unculled (it reaches the horizon), its circle turned onto the ground (local x / y become
 * world x / −z), then `spin` radians about its own axis.
 */

/** One disc: its mesh name, program, radius (m) and segments, centre `[x, y, z]` (m), render order and optional turn. */
export interface DiscLayerRow<P extends string = string> {
  readonly name: string;
  readonly program: P;
  readonly radius: number;
  readonly segments: number;
  readonly at: readonly [number, number, number];
  readonly order: number;
  readonly spin?: number;
}

/** A disc from a row: the family's material for its program (the shared uniforms it reads, then `uniforms`). */
export function discLayer<P extends string>(family: ShaderFamily<P>, row: DiscLayerRow<P>, shared: UniformMap, uniforms?: UniformMap): Mesh<CircleGeometry, ShaderMaterial> {
  const material = family.material(row.program, shared, uniforms === undefined ? {} : { uniforms });
  const mesh = new Mesh(new CircleGeometry(row.radius, row.segments), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(row.at[0], row.at[1], row.at[2]); mesh.renderOrder = row.order; mesh.frustumCulled = false; mesh.name = row.name;
  if (row.spin !== undefined) mesh.rotation.z = row.spin;
  return mesh;
}
