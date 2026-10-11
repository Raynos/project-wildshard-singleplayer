import { describe, expect, it } from 'vitest';
import { SCOUT_ROW, DISCOVERY_PLACES } from '../../../src/shards/sunscar-dunes/data/questPresentation';
import { SCOUT_NPC, SCOUT_MODEL } from '../../../src/shards/sunscar-dunes/quests/scout';
import { SCOUT_AT, SCOUT_FLAG } from '../../../src/shards/sunscar-dunes/data/flags';
import { STRINGS } from '../../../src/shards/sunscar-dunes/data/strings';
import { COMPLETE_FLAG } from '../../../src/shards/sunscar-dunes/data/signalQuest';

describe('Signal authored quest presentation rows', () => {
  it('keeps the scout column, pivots and ordered dialogue on its real validated binding', () => {
    expect(SCOUT_NPC).toMatchObject({ id: 'sunscar.scout', name: STRINGS.scoutName, spot: 'scout', at: SCOUT_AT,
      faceHome: { x: 0, z: 70 }, metFlag: SCOUT_FLAG, talkHeight: 1.62, talkRadius: 3.5, faceRange: 12, waveRange: 16,
      collider: { half: 0.3, below: 0.3, above: 1.7, surface: 'flesh' },
      figure: { model: 'caravan-scout', height: 1.7, neck: [0, 1.43, 0], shoulder: [-0.21, 1.36, 0], armBelowX: -0.2, armAboveY: 0.78, roughness: 0.9, flat: true },
      dialogue: [
        { when: { all: [COMPLETE_FLAG] }, lines: [STRINGS.scoutDone] },
        { when: { all: [SCOUT_FLAG] }, lines: [STRINGS.scoutLater] },
        { lines: [STRINGS.scoutHello, STRINGS.scoutAsk, STRINGS.scoutHow], sets: [SCOUT_FLAG] },
      ],
    });
    expect(SCOUT_MODEL).toBe(SCOUT_ROW.figure.model);
  });
  it('keeps every discovery identity, label, order and strict reach parameter', () => {
    expect(DISCOVERY_PLACES).toEqual([
      { id: 'sunscar.crest', label: STRINGS.placeCrest, x: 0, z: 70, r: 14 },
      { id: 'sunscar.caravan', label: STRINGS.caravan, x: -78, z: 28, r: 18 },
      { id: 'sunscar.well', label: STRINGS.well, x: 84, z: -6, r: 16 },
      { id: 'sunscar.tower', label: STRINGS.tower, x: 8, z: -75, r: 18 },
      { id: 'sunscar.basin', label: STRINGS.placeBasin, x: -14, z: -150, r: 52 },
    ]);
  });
});
