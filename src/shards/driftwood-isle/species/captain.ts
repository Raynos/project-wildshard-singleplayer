import { animateCaptain } from './captainPose';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies } from '@wildshard/engine/entities/species/registry';
import { bindCreatureBrain } from '@wildshard/game/plugin/brain';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { creatureBody } from './bodies';
import { captainMesh, type CaptainMesh } from './captainMesh';
import { createCaptainBrain } from './captainPolicy';

/**
 * The Drowned Captain — Driftwood Isle's guardian boss (DRIFTWOOD-REMASTER A6, D5): Captain Brine of the Gull's Lament,
 * who sank with the Ring Shrine's secret. He sleeps under the shrine's spring pool until the three glyph shards are set
 * in the altar, then rises out of the water — a tall bone-white skeleton (1.35× the drowned sailor) in a rotted navy
 * frock coat with tarnished gold trim and epaulettes, a battered tricorn, a beard of kelp, barnacles on the shoulders,
 * glowing cyan eyes and a heavy boarding cutlass. Humanoid custom rig (the sailor's bones). 320 hp.
 *
 * The mesh is the generated hull of ./captainMesh.ts on the sailor's humanoid rig (the rig contract is the bone list +
 * the animate() of ./captainPose.ts).
 *
 * The fight (`think`), three phases by hp:
 *   I   (100–66 %) — he wades after you (1.2 m/s) and swings: a 0.7 s over-the-head wind-up (a readable telegraph),
 *                    the cut hits 24 inside 2.5 m. 1.4 s between swings.
 *   II  (66–33 %)  — every ~7 s he SINKS (1 s, untouchable: his hit capsule goes under the ground), a ring of bubbles
 *                    marks where he will come up — near you — for 1.1 s, and he BURSTS up there: 16 to anything within
 *                    3 m (step out of the bubbles). Then he fights on.
 *   III (< 33 %)   — enraged: faster (1.7 m/s), shorter wind-ups (0.5 s) and a second cut straight after the first;
 *                    he still sinks and bursts, every ~5 s.
 * He never leaves the arena (`mem.arena` m around the pool, default 22) — outside it he wades back and waits.
 * Before `mem.awake` is set (Adventure.ts sets it when the altar is used) he stays hidden under the pool.
 * `mem.poolX / poolZ` = where he rises (default: where he was spawned).
 */

/** The prepared body retains the original groups, skin indices, eyes and texture. */
function buildCaptain(mesh: CaptainMesh = captainMesh): AnimalSpecies {
  const map = mesh.textureFor();
  return { ...creatureBody('captain', 'captain'), ...(map ? { map, selfLight: 0.5 } : {}), facetJitter: 0 };
}

export const captainCallbacks = bindCreatureBrain(createCaptainBrain).callbacks;

/** the captain's look over a mesh (the page's by default; a test passes its own) */
export function captainLook(mesh: CaptainMesh = captainMesh): SpeciesLook { return {
  rigContract: { skeleton: 'captain.v1', clips: [], sockets: ['body', 'head'] },
  id: 'driftwood.look.captain', species: 'creature.captain', kind: 'captain',
  standMem: { init: 1, rise: 1 }, // it waits sunk in its pool until woken: the Explorer shows it risen
  fur: NO_FUR,
  rig: 'custom',
  eyeGlow: [0.2, 1.0, 1.0], eyeGlowIntensity: 1.4,
  build: () => buildCaptain(mesh),
  animate: animateCaptain,
}; }
export const CAPTAIN_LOOK: SpeciesLook = captainLook();
