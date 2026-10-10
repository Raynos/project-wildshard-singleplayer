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
// Nine Dragon's first-person arms as data (SHARD-PLATFORM M3): fp-rig.glb's row on the SDK first-person arm rig
// (@wildshard/sdk/viewmodel/fpArmsRig) — its sockets, the tassel / talisman / muzzle attach points and the blade's span
// when the GLB's extras give none, the exporter's attribute renames, the cloth's colliders, the held moves, the framing
// weights, the look lag and the trail. vm/fpArms.ts dresses the rig (materials, knot, halo, cloth); its head describes it.

/** where the rig and its maps live */
export const ARMS_BASE = '/assets/nine-dragon/viewmodel/';
/** the parts with a maps / normals pair (`<name>-maps.webp`, `<name>-nrm.webp`) */
export const ARMS_MAPS = ['hand-r', 'arm-r', 'fist-l', 'gauntlet'] as const;

export const ARMS: FpArmsRow = {
  weapon: 'R_weapon', claw: 'L_claw',
  pendants: { tassel: [-0.026, -0.048, 0.014], talisman: [0.05, -0.036, 0.022] },
  muzzle: [0, 0.006, 0], bladeBase: 0.05, bladeTip: 0.81,
  rename: { _amat: 'aMat', _aface: 'aFace', _ans: 'aNs', _ahulln: 'aHullN' },
  // the fist round the grip (index … pinky), the palm / back-of-hand mass toward the wrist, the forearm, the guard
  colliders: [
    { a: { bone: 'R_weapon', at: [0, -0.125, 0] }, b: { bone: 'R_weapon', at: [0, -0.2, 0] }, r: 0.042 },
    { a: { bone: 'R_weapon', at: [0.02, -0.14, 0.015] }, b: { bone: 'R_weapon', at: [0.023, -0.216, 0.026] }, r: 0.036 },
    { a: { bone: 'R_hand' }, b: { bone: 'R_forearm' }, r: 0.042 },
    { a: { bone: 'R_weapon', at: [-0.02, -0.01, 0] }, b: { bone: 'R_weapon', at: [0.01, 0.02, 0] }, r: 0.03 },
  ],
  holdRight: ['charge', 'sheathe', 'sheathed'],
  holdLeft: ['grapple_aim', 'grapple_hold'],
  restWeights: [1, 1, 0.4],
  lag: { pitch: 0.01, yaw: 0.012, max: 0.05 },
  walkRate: 6,
  trail: { life: 0.45, total: 0.35, from: 0.4 },
};
