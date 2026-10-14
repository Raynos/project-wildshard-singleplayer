import { PIER_START } from '../world/sea';

/** Native admission follows the socket's flare up to the original deck and six metres along it. */
export const ENTRY_WALK = { lanes: 23, start: 1.5, walk: PIER_START + 9 + 6, maxTicks: 900,
  ramp: { at: PIER_START, run: 9, height: 1.2, halfWidths: { south: 2, north: 1.5, east: 1.5, west: 1.5 }, stride: 0.08, look: 1 } } as const;
