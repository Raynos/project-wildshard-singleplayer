/** Shipping chamber dungeon declaration, shared by the native chamber and arena row. */
export const DUNGEON = { x: -40, y: 140, z: -95 };

/** Shipping chamber ch declaration, shared by the native chamber and arena row. */
export const CH = 10;

/** Shipping chamber dromos end declaration, shared by the native chamber and arena row. */
export const DROMOS_END = 22.5;

/** Shipping chamber dromos spawn declaration, shared by the native chamber and arena row. */
export const DROMOS_SPAWN = { x: 0, z: 20.3, yaw: 0 };

/** Shipping chamber checkpoint declaration, shared by the native chamber and arena row. */
export const CHECKPOINT = { x: 0, z: 15.5, yaw: 0 };

/** Shipping chamber coffin declaration, shared by the native chamber and arena row. */
export const COFFIN = { x: 0, z: -0.6, plinthH: 0.45, len: 3.2, wid: 1.3, h: 0.85 };

/** Shipping chamber pedestal declaration, shared by the native chamber and arena row. */
export const PEDESTAL = { x: 0, z: -8.3, h: 0.95 };

/** Shipping chamber niches declaration, shared by the native chamber and arena row. */
export const NICHES = [
  { x: -CH + 0.2, z: 4.6, yaw: Math.PI / 2 }, { x: CH - 0.2, z: 4.6, yaw: -Math.PI / 2 },
  { x: -CH + 0.2, z: -4.2, yaw: Math.PI / 2 }, { x: CH - 0.2, z: -4.2, yaw: -Math.PI / 2 },
];

/** Shipping chamber streams declaration, shared by the native chamber and arena row. */
export const STREAMS: { x: number; z: number }[] = [
  { x: -5.2, z: 3.4 }, { x: 4.8, z: 4.6 }, { x: -3.6, z: -5.0 }, { x: 5.6, z: -3.2 },
  { x: -7.0, z: -0.6 }, { x: 1.8, z: 6.6 }, { x: 7.2, z: 1.2 }, { x: -1.6, z: -6.8 },
];
