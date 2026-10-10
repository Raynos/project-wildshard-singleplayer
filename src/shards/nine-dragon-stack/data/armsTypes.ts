// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** Nine Dragon’s authored Vec3 row shape. */
export type Vec3 = readonly [number, number, number];
/** Nine Dragon’s authored FpCapsuleEnd row shape. */
export interface FpCapsuleEnd { readonly bone: string; readonly at?: Vec3 }
/** Nine Dragon’s authored FpCapsuleRow row shape. */
export interface FpCapsuleRow { readonly a: FpCapsuleEnd; readonly b: FpCapsuleEnd; readonly r: number }
/** Nine Dragon’s authored FpArmsRow row shape. */
export interface FpArmsRow {
  /** the weapon socket (the blade runs along its +y) and the gadget socket (the muzzle; `<claw>*` meshes are its claw) */
  readonly weapon: string;
  readonly claw: string;
  /** the attach points when the GLB's extras give none: pendant pivots and the muzzle (socket space), the blade's span */
  readonly pendants: Readonly<Record<string, Vec3>>;
  readonly muzzle: Vec3;
  readonly bladeBase: number;
  readonly bladeTip: number;
  /** GLTFExporter writes custom attributes as `_NAME`; the loader reads them back lower case: their real names */
  readonly rename: Readonly<Record<string, string>>;
  /** the pendants' colliders (root space each frame) */
  readonly colliders: readonly FpCapsuleRow[];
  /** the moves each channel holds on their last pose until the next play */
  readonly holdRight: readonly string[];
  readonly holdLeft: readonly string[];
  /** layout(): the rest points' weights (guard, tip, hub) */
  readonly restWeights: readonly [number, number, number];
  /** the look lag (rad per rad/s, pitch and yaw) and its clamp; the walk weight's rate (1/s) */
  readonly lag: { readonly pitch: number; readonly yaw: number; readonly max: number };
  readonly walkRate: number;
  /** a move's trail: its life as a share of the move's total (default total when untimed), the blade share it starts from */
  readonly trail: { readonly life: number; readonly total: number; readonly from: number };
}
