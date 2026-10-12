import { parseNpcRow } from '@wildshard/sdk/questGraph';
import { FLAGS } from '../quest/flags';
import { SPAWN } from './layout';
import { KEEPER_AT } from './quests';
import { KEEPER_NPC } from './keeperDialogue';

/**
 * The bridge-keeper as a pivot NPC row (SHARD-PLATFORM SF27; the shared host in `@wildshard/sdk/looks/modelLibrary` stands
 * and moves him): at Sunrest's north rim, left of the rope bridge's posts, facing the spawn (mockup B, E399), his talk
 * anchor 1.8 m over the deck within 3.5 m. He is not solid (no collider) and never turns: he waves within 16 m, met or
 * not, gestures while he talks and sways a slow breath of a turn.
 *
 * His figure is the textured keeper (E410 row 8, `art/far-reach/round-33-keeper/`: mockup B's keeper modelled in a rig
 * pose, his right arm held out from the coat, the hand open, the staff gripped in his left), fitted 1.95 m tall on his
 * footing: his free right arm (−x) is every triangle outboard of a line slanting from x −0.506 + 0.185·y between y 0.85
 * and 1.6 (the gap between sleeve and coat runs from x −0.34 at y 0.9 to −0.22 at the shoulder), on its shoulder pivot;
 * the forearm and hand (round 8, seat A: 'an open waving hand') are the arm past the plane through the elbow square to
 * the arm's direction, on the elbow pivot. The poses (radians, the shoulder's and the elbow's turns about z): at rest the
 * held-out arm lowers toward his side; waving keeps the upper arm out and down and folds the forearm up so the open
 * hand stands beside his head (mockup B); talking, an open-hand gesture. His arm eases ~0.15 a frame at 60 fps.
 */
export const KEEPER_ROW = parseNpcRow({
  ...KEEPER_NPC, spot: 'keeper', at: { x: KEEPER_AT.x, z: KEEPER_AT.z }, faceHome: { x: SPAWN.x, z: SPAWN.z }, metFlag: FLAGS.notes,
  talkHeight: 1.8, talkRadius: 3.5, faceRange: 16, waveRange: 16,
  figure: { model: 'keeper-hd', height: 1.95, centre: 'base', shoulder: [-0.25, 1.5, 0.03], armBelowX: -0.506, armSlope: 0.185, armAboveY: 0.85, armTopY: 1.6,
    elbow: { at: [-0.5, 1.24, 0], axis: [-0.7, -0.71] }, roughness: 0.85, flat: false },
  motion: { turns: false, waveUntilMet: false, ease: 9, breathe: { yaw: [0.03, 0.6], scale: [0, 0] },
    rest: { lift: [0.3, 0, 0], forward: [0, 0, 0], bend: [0, 0, 0] },
    wave: { lift: [-0.1, -0.05, 3], forward: [0, 0, 0], bend: [-2.3, -0.25, 7] },
    talk: { lift: [0, -0.2, 2.2], forward: [0, 0, 0], bend: [-0.9, 0, 0] } },
});
