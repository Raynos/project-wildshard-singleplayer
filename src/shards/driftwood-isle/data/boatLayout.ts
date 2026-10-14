/** Original hull stations, shared by the cold mesh recipe and its unchanged live placement/collider owner. */
export const BOAT_LAYOUT = { length: 6.4, beam: 2.2, floor: 0.32, deckThickness: 0.105 } as const;
export interface BoatStation { t: number; z: number; w: number; sheer: number; keel: number; floor: number }

