// Pine Hollow's trophy wall as data: its mount slots and where it hangs (the compendium's `trophies` and `wall`;
// generators/trophyMounts.ts bakes the mounts from them, runtime/compendium/trophyWall.ts hangs them).

/** the wall, top row first (the antlered heads need the width), then the bottom row */
export const PINE_HOLLOW_TROPHIES = [
  { entry: 'ghost-stag', outline: 'stag', mount: { kind: 'deer', variant: 'ghost' }, title: 'Ghostbuster' },
  { entry: 'antler-king', outline: 'king', title: 'Regicide, Technically' },
  { entry: 'imperial-bull', outline: 'elk', mount: { kind: 'elk', variant: 'imperial' }, title: 'His Royal Lowness' },
  { entry: 'ironhide', outline: 'boar', mount: { kind: 'boar', variant: 'ironhide' }, title: 'Ironhide\'s Retirement Plan' },
  { entry: 'scarback', outline: 'boar', mount: { kind: 'boar', variant: 'scarback' }, title: 'Scar Tissue Collector' },
  { entry: 'grizzled-sow', outline: 'bear', mount: { kind: 'bear', variant: 'brown-old' }, title: 'Grin and Bear It' },
  { entry: 'blackpaw', outline: 'bear', mount: { kind: 'bear', variant: 'black-old' }, title: 'Paws for Thought' },
] as const;

/**
 * The ranger's cabin (cabin 1: W 5 × L 7, chimney at −Z, door on +X). The wall is the back wall's inner face (x = −W/2 +
 * 2·LOG_R, the log crests) between the hearth corner and the window at z = +0.6: z ∈ [−3.2, −0.2]. Turned +90° so the
 * wall's +z is the cabin's +X (into the room) and its +x the viewer's right (−Z). FLOOR = 0.22 (Cabin.ts).
 */
export const RANGER_WALL = { cabin: 0, at: [-2.27, 0.22, -1.7] as [number, number, number], yaw: Math.PI / 2, width: 3.0, rows: [3, 4] as const, rowY: [1.98, 1.12] as const };
