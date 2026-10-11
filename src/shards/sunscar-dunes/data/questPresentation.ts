import { BASIN, CARAVAN, SPAWN, WELL, TOWER } from './layout';
import { SCOUT_AT, SCOUT_FLAG } from './flags';
import { STRINGS } from './strings';
import { COMPLETE_FLAG } from '../data/signalQuest';

/** Sefa's authored quest-giver, figure pivots, native column and ordered dialogue. */
export const SCOUT_ROW = {
  id: 'sunscar.scout', name: STRINGS.scoutName, spot: 'scout', at: SCOUT_AT, faceHome: { x: SPAWN.x, z: SPAWN.z }, metFlag: SCOUT_FLAG,
  talkHeight: 1.62, talkRadius: 3.5, faceRange: 12, waveRange: 16,
  collider: { half: 0.3, below: 0.3, above: 1.7, surface: 'flesh' },
  figure: { model: 'caravan-scout', height: 1.7, neck: [0, 1.43, 0], shoulder: [-0.21, 1.36, 0], armBelowX: -0.2, armAboveY: 0.78, roughness: 0.9, flat: true },
  dialogue: [
    { when: { all: [COMPLETE_FLAG] }, lines: [STRINGS.scoutDone] },
    { when: { all: [SCOUT_FLAG] }, lines: [STRINGS.scoutLater] },
    { lines: [STRINGS.scoutHello, STRINGS.scoutAsk, STRINGS.scoutHow], sets: [SCOUT_FLAG] },
  ],
} as const;

/** The named places: walking into one toasts "Discovered · …" once and names it on the full map (review R4, R11). */
export const DISCOVERY_PLACES = [
  { id: 'sunscar.crest', label: STRINGS.placeCrest, x: SPAWN.x, z: SPAWN.z, r: 14 },
  { id: 'sunscar.caravan', label: STRINGS.caravan, x: CARAVAN.x, z: CARAVAN.z, r: 18 },
  { id: 'sunscar.well', label: STRINGS.well, x: WELL.x, z: WELL.z, r: 16 },
  { id: 'sunscar.tower', label: STRINGS.tower, x: TOWER.x, z: TOWER.z, r: 18 },
  { id: 'sunscar.basin', label: STRINGS.placeBasin, x: BASIN.x, z: BASIN.z, r: BASIN.r - 4 },
] as const;

