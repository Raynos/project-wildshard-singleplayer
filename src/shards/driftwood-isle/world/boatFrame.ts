import { BOAT_LAYOUT, type BoatStation } from '../data/boatLayout';

/** The retained authored hull equation; moving it out of the live model is not a custom-runtime cut. */
export function boatStation(t: number): BoatStation {
  const W = BOAT_LAYOUT.beam / 2 - 0.03, FLOOR = BOAT_LAYOUT.floor, DECK_T = BOAT_LAYOUT.deckThickness;
  const fore = Math.min(1, t / 0.42), aft = Math.max(0, (t - 0.55) / 0.45);
  const w = W * Math.sin(fore * Math.PI / 2) ** 0.85 * (1 - 0.3 * aft ** 1.5);
  const sheer = 0.7 + 0.46 * Math.max(0, 1 - t / 0.5) ** 2.2 + 0.2 * aft ** 2;
  const keel = -0.52 + 0.34 * Math.max(0, 1 - t / 0.35) ** 2 + 0.14 * aft ** 2;
  return { t, z: -BOAT_LAYOUT.length / 2 + t * BOAT_LAYOUT.length, w, sheer, keel, floor: t <= DECK_T ? sheer : FLOOR };
}
