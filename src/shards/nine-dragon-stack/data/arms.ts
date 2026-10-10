// Nine Dragon's first-person arms as data (SHARD-PLATFORM M3): fp-rig.glb's row on the SDK first-person arm rig
// (@wildshard/sdk/viewmodel/fpArmsRig) — its sockets, the tassel / talisman / muzzle attach points and the blade's span
// when the GLB's extras give none, the exporter's attribute renames, the cloth's colliders, the held moves, the framing
// weights, the look lag and the trail. vm/fpArms.ts dresses the rig (materials, knot, halo, cloth); its head describes it.
import type { FpArmsRow } from '@wildshard/sdk/viewmodel/fpArmsRig';

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
