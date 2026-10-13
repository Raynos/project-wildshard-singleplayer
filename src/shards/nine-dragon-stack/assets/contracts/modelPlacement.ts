import type { Matrix4, Color } from 'three';

/** Author-only model pose contract, structurally equal to the engine placement received by runtime recipes. */
export interface AuthoredPlacement<P extends object> {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw?: number;
  readonly leanX?: number;
  readonly leanZ?: number;
  readonly scale?: number;
  /** a full transform instead of the pose (Nine Dragon's matrices); x, y, z must still be its translation */
  readonly matrix?: Matrix4;
  /** this copy's params over the variant's and the defaults (merged and single; instanced / batched copies share their variant's shape) */
  readonly params?: Partial<P>;
  /** a `variants` id */
  readonly variant?: string;
  /** instanced / batched: a per-copy tint (0xrrggbb, or a Color taken as it is: linear floats, nothing rounded) */
  readonly color?: number | Color;
  /**
   * instanced into a weld (`PlaceOptions.weld`, E347): the index, in the weld, of the copy this one stands about (a crate
   * by a cabin's door) — it is drawn by its host, while the host's unit is within the weld's detail band
   */
  readonly host?: number;
}

