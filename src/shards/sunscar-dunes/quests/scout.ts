import { parseNpcRow } from '@wildshard/sdk/questGraph';
import { SPAWN } from '../data/layout';
import { SCOUT_AT, SCOUT_FLAG } from '../data/flags';
import { STRINGS } from '../data/strings';
import { COMPLETE_FLAG } from './signal';

/** Sefa's generated model (data/files.ts DUNE_MODELS). */
export const SCOUT_MODEL = 'caravan-scout';
/**
 * Sefa, the caravan scout (P4, Driftwood's Wendell), as a quest-giver row: she stands on the spawn crest facing the spawn,
 * turns to you within 12 m, waves within 16 m until you have talked and gestures as she talks; her first talk is the
 * quest's first step. The figure is the generated one (loop 2: `art/sunscar-dunes/round-11-loop-2/ref-scout.jpg` →
 * Hunyuan3D-2, painted facets), 1.7 m, on pivots: the head at the neck, the right arm (her right is −X) at the shoulder.
 * She is solid: a 0.6 m column you walk round (loop 3). Her prompt stands at her head, 1.62 m, and reaches 3.5 m.
 */
export const SCOUT_NPC = parseNpcRow({
  id: 'sunscar.scout', name: STRINGS.scoutName, spot: 'scout', at: SCOUT_AT, faceHome: { x: SPAWN.x, z: SPAWN.z }, metFlag: SCOUT_FLAG,
  talkHeight: 1.62, talkRadius: 3.5, faceRange: 12, waveRange: 16,
  collider: { half: 0.3, below: 0.3, above: 1.7, surface: 'flesh' },
  figure: { model: SCOUT_MODEL, height: 1.7, neck: [0, 1.43, 0], shoulder: [-0.21, 1.36, 0], armBelowX: -0.2, armAboveY: 0.78, roughness: 0.9, flat: true },
  dialogue: [
    { when: { all: [COMPLETE_FLAG] }, lines: [STRINGS.scoutDone] },
    { when: { all: [SCOUT_FLAG] }, lines: [STRINGS.scoutLater] },
    { lines: [STRINGS.scoutHello, STRINGS.scoutAsk, STRINGS.scoutHow], sets: [SCOUT_FLAG] },
  ],
});
