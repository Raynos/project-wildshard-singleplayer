import type { NpcRow } from '@wildshard/sdk/questGraph';

/** The keeper's authored pivot planes and static frame, shared by the native NPC row and its retained bake. */
export const KEEPER_FIGURE: NpcRow['figure'] = { model: 'keeper-hd', height: 1.95, centre: 'base', shoulder: [-0.25, 1.5, 0.03], armBelowX: -0.506, armSlope: 0.185, armAboveY: 0.85, armTopY: 1.6,
    elbow: { at: [-0.5, 1.24, 0], axis: [-0.7, -0.71] }, roughness: 0.85, flat: false };
