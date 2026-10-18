// Nine Dragon's world build as data (SHARD-PLATFORM M3, ex world/build.ts): the kit
// conversion's yield, the Well's silk sheet layers, the noodle stall's steam puffs and the movers' paths
// (kit/kitConvert, looks/mistGeometry, props/pathMovers).

/** each silk sheet across the Well is two layers: at its height, and 5 m under it at 70 % */
export const SHEET_LAYERS = [{ dy: 0, alpha: 1 }, { dy: -5, alpha: 0.7 }] as const;

/** soft steam billboards over the noodle stall's pots: six per pot, their seeds 0.37 apart pot to pot */
export const STEAM_PUFFS = { perPoint: 6, stride: 0.37 } as const;

/** the movers (models/movers.ts), heights over the stack's base (layout.ts Y0): the monorail train looping 300 m along x
 *  at 16 m/s; the gondola swinging on the Well's cable (world/wellBounds.ts CABLE) 5 m short of its ends, 0.8 m higher
 *  at its east end; the two drones circling (8, −8), bobbing 1.5 m */
export const MOVERS = {
  train: { x: -100, y: 25.5, z: -27, speed: 16, length: 300 },
  gondola: { margin: 5, rise: 0.8, rate: 0.12, phase: -0.62 },
  drones: [
    { x: 8, y: 58, z: -8, r: 22, rate: 0.045, phase: 0, bob: 1.5, bobRate: 0.3 },
    { x: 8, y: 74, z: -8, r: 36, rate: 0.045, phase: 2.4, bob: 1.5, bobRate: 0.3 },
  ],
} as const;
