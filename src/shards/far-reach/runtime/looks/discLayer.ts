import { CircleGeometry, Mesh, type Material } from 'three';

/** One disc: its mesh name, program, radius (m) and segments, centre `[x, y, z]` (m), render order and optional turn. */
export interface DiscLayerRow {
  readonly name: string;
  readonly program: string;
  readonly radius: number;
  readonly segments: number;
  readonly at: readonly [number, number, number];
  readonly order: number;
  readonly spin?: number;
}

/**
 * A horizontal disc in a shard's own material (an SF59 graph), as a declared row (SHARD-PLATFORM M3, look-family rows): a
 * cloud sea under floating islands, a painted vortex, any sheet laid flat on the world. The disc is unculled (it reaches the
 * horizon), its circle turned onto the ground (local x / y become world x / −z), then `spin` radians about its own axis.
 */
export function discLayer<M extends Material>(material: M, row: DiscLayerRow): Mesh<CircleGeometry, M> {
  const mesh = new Mesh(new CircleGeometry(row.radius, row.segments), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(row.at[0], row.at[1], row.at[2]); mesh.renderOrder = row.order; mesh.frustumCulled = false; mesh.name = row.name;
  if (row.spin !== undefined) mesh.rotation.z = row.spin;
  return mesh;
}
