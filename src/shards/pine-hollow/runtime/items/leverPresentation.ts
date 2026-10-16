/** Authored rifle presentation: metres, seconds and radians. Kick is 1.25 degrees.
 * Gameplay magazine/reserve and action timing remain in the admitted weapon profile.
 * The existing ranged/held owners consume these values without a new controller. */
export const LEVER_PRESENTATION = {
  kick: 0.02181661564992912,
  flash: { frames: 2, lightTime: 0.06, light: 34 },
  brass: { count: 4, life: 1.8 }, tracer: { count: 2, time: 0.09 }, adsMotion: 0.3,
  lever: { open: 0.92, boltTravel: 0.058, hammerDown: -0.12, hammerCocked: 0.5, handTurn: 0.6 },
  sight: { y: 0.045, eyeZ: 0.36, rearZ: -0.13, frontZ: -0.512, muzzleZ: -0.535 },
  hammerPivot: [0, -0.006, 0.122], port: [0, 0.026, 0.045],
  hip: { px: 0.07, py: -0.085, pz: -0.26, rx: 0.05, ry: 0.14, rz: -0.15, scale: 1 },
  cyclePose: { px: -0.03, py: 0.03, pz: 0, rx: 0.1, ry: 0.1, rz: -0.45 },
} as const;

/** The baked fists' placement and gate pose on the held-firearm host. */
export const LEVER_HAND_HOLDS = {
  left: { at: [0, -0.017, -0.16], axis: [0, 0, -1], palm: [-0.5, 0.87, 0] },
  right: { at: [0, -0.062, 0.165], axis: [0, 1, -0.25], palm: [-1, 0, 0] },
  gate: { at: [0.03, -0.01, 0.03], axis: [0, 0, -1], palm: [-1, 0, 0] },
} as const;
