import type { ConeFanView } from '@wildshard/sdk/items/coneFan';

/**
 * The war fan's viewmodel rows (the platform's cone fan, SHARD-PLATFORM M3).
 *
 * The hold, Top-10 row 3 (E407): ONE hold for every view, measured against the mockups' fans (390 x 844 portrait frame;
 * A's pivot at about (364, 605), its leaf's left tip (244, 547), top 480; B's left 275, top 452; proposal B's left 200,
 * top 475): the pivot low at the right (~345, 610), the leaf opening up and to the left, its right guard running off the
 * frame's edge, tipped back a little so the silk still faces you. (Earlier: the idle hold of mockup B / C, raised over the
 * GUST / DODGE / JUMP cluster in loop 5; E399's lower, smaller, face-on hold; council round 3's lean over GUST.)
 *
 * The three moves (loop 3, P3), as key poses over each move's duration: SWING a quick flat slash, right to left, from a
 * short wind-up to the right; HEAVY a raised wind-up, then a diagonal chop down and across; GUST the fan drawn back and
 * turned face-on, then thrust out to the centre like a push of wind. At rest a slow breath and the tassel swinging;
 * holding for HEAVY (a full charge in 0.6 s) draws the fan up and back.
 */
export const FAN_VIEW: ConeFanView = {
  hold: { x: 0.155, y: -0.194, z: -0.6, pitch: 0.35, yaw: -0.5, roll: 0.55, scale: 0.46 },
  spring: { gain: 0.01, clampYaw: 0.1, clampPitch: 0.1, k: 50, c: 12 },
  charge: 0.6,
  motions: {
    swing: { seconds: 0.34, keys: [[0, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }], [0.18, { x: 0.05, y: 0.01, z: 0.02, yaw: 0.45, pitch: 0.05, roll: -0.15 }],
      [0.5, { x: -0.16, y: 0.02, z: -0.05, yaw: -1.05, pitch: -0.1, roll: 0.25 }], [1, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }]] },
    heavy: { seconds: 0.6, keys: [[0, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }], [0.3, { x: 0.06, y: 0.12, z: 0.04, yaw: 0.35, pitch: 0.6, roll: -0.45 }],
      [0.55, { x: -0.14, y: -0.1, z: -0.08, yaw: -0.9, pitch: -0.7, roll: 0.5 }], [0.7, { x: -0.13, y: -0.09, z: -0.07, yaw: -0.85, pitch: -0.65, roll: 0.45 }],
      [1, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }]] },
    gust: { seconds: 0.55, keys: [[0, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }], [0.25, { x: 0.02, y: 0.02, z: 0.07, yaw: 0.55, pitch: 0.1, roll: 0.2 }],
      [0.45, { x: -0.11, y: 0.05, z: -0.14, yaw: 0.62, pitch: -0.05, roll: 0.32 }], [0.62, { x: -0.1, y: 0.05, z: -0.12, yaw: 0.6, pitch: -0.04, roll: 0.3 }],
      [1, { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 }]] },
  },
  breath: { rate: 1.3, lift: 0.004, pitch: 0.015 },
  draw: { x: 0.04, y: 0.06, z: 0.03, pitch: 0.35, yaw: 0.2, roll: 0.25 },
  pendant: { rate: 2.1, sway: 0.25, swish: 0.7 },
  hideAt: 0.5,
};
