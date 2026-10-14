/** where a shrine stands: its centre (world xz) and which way its front faces (rot, radians about +Y) */
export interface ShrineSite { readonly x: number; readonly z: number; readonly rot: number }
export interface ShrineAnchor { x: number; y: number; z: number; yaw: number }

export interface ShrineParams {
  readonly site: ShrineSite;
  /** the ground under a world (x, z) at the site: its y */
  readonly ground: (x: number, z: number) => number;
}

