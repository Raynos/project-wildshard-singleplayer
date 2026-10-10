import type { PrimitivePartRow } from '@wildshard/sdk/kit/primitiveParts';

/**
 * The hamlet's stand-in people (PINE-HOLLOW-REMASTER PH-C1 / C6) as primitive parts in add order (@wildshard/sdk/kit/primitiveParts,
 * merged into one vertex-coloured geometry each): legs and boots, the long coat (a flared skirt, the torso, the belt), the
 * shirt front, the shoulders, the arms and hands, the head, neck, nose, ears, eyes and brows, the beard and the hat; the
 * ranger (board B3's "old warden": campaign hat, long grey beard, brass badge) holds his lantern low, the miller wears
 * an apron and a cap, the trader a fur hat and a red coat. `GLASS`: the lantern's glowing glass (the glow material).
 * Read by ../models/people.ts makeNpcFigure.
 */
/** Hale the ranger's stand-in body */
export const NPC_RANGER_BODY: readonly PrimitivePartRow[] = [
  { kind: 'cylinder', args: [0.075, 0.068, 0.82, 8], color: '#3b3a30', at: [-0.1, 0.45] },
  { kind: 'box', args: [0.12, 0.1, 0.24], color: '#2a2019', at: [-0.1, 0.05, 0.04] },
  { kind: 'cylinder', args: [0.075, 0.068, 0.82, 8], color: '#3b3a30', at: [0.1, 0.45] },
  { kind: 'box', args: [0.12, 0.1, 0.24], color: '#2a2019', at: [0.1, 0.05, 0.04] },
  { kind: 'cylinder', args: [0.2, 0.3, 0.72, 12, 1], open: true, color: '#4f4a32', at: [0, 0.66] },
  { kind: 'cylinder', args: [0.195, 0.2, 0.62, 12], color: '#4f4a32', at: [0, 1.24, 0, 0, 0, 0, 1, 1, 0.82] },
  { kind: 'cylinder', args: [0.2, 0.2, 0.06, 12], color: '#3a3624', at: [0, 1, 0, 0, 0, 0, 1.02, 1, 0.84] },
  { kind: 'box', args: [0.12, 0.3, 0.02], color: '#6e5b41', at: [0, 1.36, 0.165] },
  { kind: 'sphere', args: [0.2, 12, 6, 0, 6.283185307179586, 0, 1.5707963267948966], color: '#4f4a32', at: [0, 1.52, 0, 0, 0, 0, 1.12, 0.45, 0.82] },
  { kind: 'cylinder', args: [0.035, 0.035, 0.01, 10], color: '#c9a24a', at: [-0.09, 1.38, 0.17, 1.5707963267948966] },
  { kind: 'cylinder', args: [0.06, 0.05, 0.62, 8], color: '#4f4a32', at: [-0.25, 1.2, 0, 0, 0, 0.1] },
  { kind: 'sphere', args: [0.05, 8, 6], color: '#b98a6a', at: [-0.28, 0.87, 0.01] },
  { kind: 'cylinder', args: [0.06, 0.05, 0.36, 8], color: '#4f4a32', at: [0.25, 1.33, 0.1, -0.9, 0, -0.1] },
  { kind: 'cylinder', args: [0.05, 0.045, 0.32, 8], color: '#4f4a32', at: [0.27, 1.1, 0.28, 0.2] },
  { kind: 'sphere', args: [0.05, 8, 6], color: '#b98a6a', at: [0.27, 0.95, 0.3] },
  { kind: 'cylinder', args: [0.07, 0.09, 0.05, 8], color: '#26241f', at: [0.27, 0.86, 0.3] },
  { kind: 'cylinder', args: [0.085, 0.085, 0.04, 8], color: '#26241f', at: [0.27, 0.62, 0.3] },
  { kind: 'box', args: [0.012, 0.22, 0.012], color: '#26241f', at: [0.33, 0.74, 0.36] },
  { kind: 'box', args: [0.012, 0.22, 0.012], color: '#26241f', at: [0.21000000000000002, 0.74, 0.36] },
  { kind: 'box', args: [0.012, 0.22, 0.012], color: '#26241f', at: [0.21000000000000002, 0.74, 0.24] },
  { kind: 'box', args: [0.012, 0.22, 0.012], color: '#26241f', at: [0.33, 0.74, 0.24] },
  { kind: 'cylinder', args: [0.055, 0.06, 0.1, 8], color: '#b98a6a', at: [0, 1.58] },
  { kind: 'sphere', args: [0.105, 14, 10], color: '#b98a6a', at: [0, 1.7, 0, 0, 0, 0, 0.92, 1.08] },
  { kind: 'cone', args: [0.022, 0.06, 6], color: '#b98a6a', at: [0, 1.7, 0.105, 1.5707963267948966] },
  { kind: 'sphere', args: [0.025, 6, 4], color: '#b98a6a', at: [-0.098, 1.7, -0.005, 0, 0, 0, 0.5] },
  { kind: 'sphere', args: [0.012, 6, 4], color: '#15110e', at: [-0.037, 1.725, 0.093] },
  { kind: 'box', args: [0.045, 0.012, 0.01], color: '#bdb8ae', at: [-0.037, 1.752, 0.095, 0, 0, -0.12] },
  { kind: 'sphere', args: [0.025, 6, 4], color: '#b98a6a', at: [0.098, 1.7, -0.005, 0, 0, 0, 0.5] },
  { kind: 'sphere', args: [0.012, 6, 4], color: '#15110e', at: [0.037, 1.725, 0.093] },
  { kind: 'box', args: [0.045, 0.012, 0.01], color: '#bdb8ae', at: [0.037, 1.752, 0.095, 0, 0, 0.12] },
  { kind: 'cone', args: [0.1, 0.24, 10], color: '#bdb8ae', at: [0, 1.56, 0.07, 3.141592653589793, 0, 0, 1, 1, 0.7] },
  { kind: 'sphere', args: [0.095, 10, 6, 0, 6.283185307179586, 1.5707963267948966, 1.5707963267948966], color: '#bdb8ae', at: [0, 1.68, 0.02, 0, 0, 0, 1, 0.9, 0.95] },
  { kind: 'cylinder', args: [0.25, 0.26, 0.018, 16], color: '#6b5a3c', at: [0, 1.79] },
  { kind: 'cylinder', args: [0.075, 0.115, 0.15, 4], color: '#6b5a3c', at: [0, 1.87, 0, 0, 0.7853981633974483] },
  { kind: 'cylinder', args: [0.116, 0.118, 0.03, 12], color: '#3d3222', at: [0, 1.815] },
];
/** Hale the ranger's lantern glass (over-bright, on the glow material) */
export const NPC_RANGER_GLASS: readonly PrimitivePartRow[] = [
  { kind: 'cylinder', args: [0.055, 0.06, 0.2, 8], color: [2.4, 1.35, 0.45], at: [0.27, 0.74, 0.3] },
];
/** Brandt the miller's stand-in body */
export const NPC_MILLER_BODY: readonly PrimitivePartRow[] = [
  { kind: 'cylinder', args: [0.075, 0.068, 0.82, 8], color: '#4a4034', at: [-0.1, 0.45] },
  { kind: 'box', args: [0.12, 0.1, 0.24], color: '#2d231b', at: [-0.1, 0.05, 0.04] },
  { kind: 'cylinder', args: [0.075, 0.068, 0.82, 8], color: '#4a4034', at: [0.1, 0.45] },
  { kind: 'box', args: [0.12, 0.1, 0.24], color: '#2d231b', at: [0.1, 0.05, 0.04] },
  { kind: 'cylinder', args: [0.2, 0.3, 0.72, 12, 1], open: true, color: '#6a4b33', at: [0, 0.66] },
  { kind: 'cylinder', args: [0.195, 0.2, 0.62, 12], color: '#6a4b33', at: [0, 1.24, 0, 0, 0, 0, 1, 1, 0.82] },
  { kind: 'cylinder', args: [0.2, 0.2, 0.06, 12], color: '#4d3624', at: [0, 1, 0, 0, 0, 0, 1.02, 1, 0.84] },
  { kind: 'box', args: [0.32, 0.7, 0.02], color: '#e2dccb', at: [0, 0.82, 0.19, -0.06] },
  { kind: 'box', args: [0.12, 0.3, 0.02], color: '#cfc6b0', at: [0, 1.36, 0.165] },
  { kind: 'sphere', args: [0.2, 12, 6, 0, 6.283185307179586, 0, 1.5707963267948966], color: '#6a4b33', at: [0, 1.52, 0, 0, 0, 0, 1.12, 0.45, 0.82] },
  { kind: 'cylinder', args: [0.06, 0.05, 0.62, 8], color: '#6a4b33', at: [-0.25, 1.2, 0, 0, 0, 0.1] },
  { kind: 'sphere', args: [0.05, 8, 6], color: '#c49474', at: [-0.28, 0.87, 0.01] },
  { kind: 'cylinder', args: [0.06, 0.05, 0.62, 8], color: '#6a4b33', at: [0.25, 1.2, 0, 0, 0, -0.1] },
  { kind: 'sphere', args: [0.05, 8, 6], color: '#c49474', at: [0.28, 0.87, 0.01] },
  { kind: 'cylinder', args: [0.055, 0.06, 0.1, 8], color: '#c49474', at: [0, 1.58] },
  { kind: 'sphere', args: [0.105, 14, 10], color: '#c49474', at: [0, 1.7, 0, 0, 0, 0, 0.92, 1.08] },
  { kind: 'cone', args: [0.022, 0.06, 6], color: '#c49474', at: [0, 1.7, 0.105, 1.5707963267948966] },
  { kind: 'sphere', args: [0.025, 6, 4], color: '#c49474', at: [-0.098, 1.7, -0.005, 0, 0, 0, 0.5] },
  { kind: 'sphere', args: [0.012, 6, 4], color: '#15110e', at: [-0.037, 1.725, 0.093] },
  { kind: 'box', args: [0.045, 0.012, 0.01], color: '#8a7b68', at: [-0.037, 1.752, 0.095, 0, 0, -0.12] },
  { kind: 'sphere', args: [0.025, 6, 4], color: '#c49474', at: [0.098, 1.7, -0.005, 0, 0, 0, 0.5] },
  { kind: 'sphere', args: [0.012, 6, 4], color: '#15110e', at: [0.037, 1.725, 0.093] },
  { kind: 'box', args: [0.045, 0.012, 0.01], color: '#8a7b68', at: [0.037, 1.752, 0.095, 0, 0, 0.12] },
  { kind: 'sphere', args: [0.095, 10, 6, 0, 6.283185307179586, 1.5707963267948966, 1.5707963267948966], color: '#8a7b68', at: [0, 1.68, 0.02, 0, 0, 0, 1, 0.9, 0.95] },
  { kind: 'sphere', args: [0.115, 12, 6, 0, 6.283185307179586, 0, 1.5707963267948966], color: '#5a5146', at: [0, 1.76, -0.005, 0, 0, 0, 1.05, 0.6, 1.08] },
  { kind: 'box', args: [0.16, 0.012, 0.08], color: '#5a5146', at: [0, 1.77, 0.12, 0.12] },
];
/** Mott the trader's stand-in body */
export const NPC_TRADER_BODY: readonly PrimitivePartRow[] = [
  { kind: 'cylinder', args: [0.075, 0.068, 0.82, 8], color: '#35302a', at: [-0.1, 0.45] },
  { kind: 'box', args: [0.12, 0.1, 0.24], color: '#241c16', at: [-0.1, 0.05, 0.04] },
  { kind: 'cylinder', args: [0.075, 0.068, 0.82, 8], color: '#35302a', at: [0.1, 0.45] },
  { kind: 'box', args: [0.12, 0.1, 0.24], color: '#241c16', at: [0.1, 0.05, 0.04] },
  { kind: 'cylinder', args: [0.2, 0.3, 0.72, 12, 1], open: true, color: '#5c2a22', at: [0, 0.66] },
  { kind: 'cylinder', args: [0.195, 0.2, 0.62, 12], color: '#5c2a22', at: [0, 1.24, 0, 0, 0, 0, 1, 1, 0.82] },
  { kind: 'cylinder', args: [0.2, 0.2, 0.06, 12], color: '#40201b', at: [0, 1, 0, 0, 0, 0, 1.02, 1, 0.84] },
  { kind: 'box', args: [0.12, 0.3, 0.02], color: '#b7a27f', at: [0, 1.36, 0.165] },
  { kind: 'sphere', args: [0.2, 12, 6, 0, 6.283185307179586, 0, 1.5707963267948966], color: '#5c2a22', at: [0, 1.52, 0, 0, 0, 0, 1.12, 0.45, 0.82] },
  { kind: 'cylinder', args: [0.06, 0.05, 0.62, 8], color: '#5c2a22', at: [-0.25, 1.2, 0, 0, 0, 0.1] },
  { kind: 'sphere', args: [0.05, 8, 6], color: '#a87a5a', at: [-0.28, 0.87, 0.01] },
  { kind: 'cylinder', args: [0.06, 0.05, 0.62, 8], color: '#5c2a22', at: [0.25, 1.2, 0, 0, 0, -0.1] },
  { kind: 'sphere', args: [0.05, 8, 6], color: '#a87a5a', at: [0.28, 0.87, 0.01] },
  { kind: 'cylinder', args: [0.055, 0.06, 0.1, 8], color: '#a87a5a', at: [0, 1.58] },
  { kind: 'sphere', args: [0.105, 14, 10], color: '#a87a5a', at: [0, 1.7, 0, 0, 0, 0, 0.92, 1.08] },
  { kind: 'cone', args: [0.022, 0.06, 6], color: '#a87a5a', at: [0, 1.7, 0.105, 1.5707963267948966] },
  { kind: 'sphere', args: [0.025, 6, 4], color: '#a87a5a', at: [-0.098, 1.7, -0.005, 0, 0, 0, 0.5] },
  { kind: 'sphere', args: [0.012, 6, 4], color: '#15110e', at: [-0.037, 1.725, 0.093] },
  { kind: 'box', args: [0.045, 0.012, 0.01], color: '#2e2620', at: [-0.037, 1.752, 0.095, 0, 0, -0.12] },
  { kind: 'sphere', args: [0.025, 6, 4], color: '#a87a5a', at: [0.098, 1.7, -0.005, 0, 0, 0, 0.5] },
  { kind: 'sphere', args: [0.012, 6, 4], color: '#15110e', at: [0.037, 1.725, 0.093] },
  { kind: 'box', args: [0.045, 0.012, 0.01], color: '#2e2620', at: [0.037, 1.752, 0.095, 0, 0, 0.12] },
  { kind: 'sphere', args: [0.095, 10, 6, 0, 6.283185307179586, 1.5707963267948966, 1.5707963267948966], color: '#2e2620', at: [0, 1.68, 0.02, 0, 0, 0, 1, 0.9, 0.95] },
  { kind: 'cylinder', args: [0.12, 0.115, 0.13, 12], color: '#4a3a2a', at: [0, 1.82] },
];
