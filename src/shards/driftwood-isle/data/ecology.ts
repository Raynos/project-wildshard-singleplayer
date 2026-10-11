/** One authored respawn range and its existing night gate, consumed by both native queues. */
export interface RespawnRule { delay: [number, number]; night?: boolean }

/** seconds until a kind comes back (rolled in the range), and whether it only comes back at night */
export const RESPAWN: Record<string, RespawnRule> = {
  crab: { delay: [240, 360] },
  monkey: { delay: [300, 420] },
  boar: { delay: [300, 420] },
  bear: { delay: [600, 900] },
  sailor: { delay: [180, 180], night: true },
};

/** Minimum existing player clearance before a queued replacement can appear. */
export const OUT_OF_SIGHT = 60;

