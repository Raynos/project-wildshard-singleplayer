/** The keeper's authored pivot planes and static frame, shared by the native NPC row and its retained bake. */
export const KEEPER_FIGURE: {
  model: string; height: number; centre: 'base'; shoulder: [number, number, number];
  neck?: [number, number, number]; armBelowX: number; armSlope: number; armAboveY: number; armTopY: number;
  elbow: { at: [number, number, number]; axis: [number, number] }; roughness: number; flat: boolean;
} = { model: 'keeper-hd', height: 1.95, shoulder: [-0.25, 1.5, 0.03], armBelowX: -0.506, armAboveY: 0.85, armSlope: 0.185, armTopY: 1.6, centre: 'base',
    elbow: { at: [-0.5, 1.24, 0], axis: [-0.7, -0.71] }, roughness: 0.85, flat: false };
