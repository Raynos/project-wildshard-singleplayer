import { ENEMY_SPECIES_METADATA } from '../data/enemySpecies';
import { animateCaptain } from './captainPose';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { skinPlain, boneIndex, srgb, type Paint } from '@wildshard/engine/entities/species/loft';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies, BoneDef, ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import * as THREE from 'three';
import { captainMesh, type CaptainMesh } from './captainMesh';
import { CaptainBrain } from './captainPolicy';

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

/** the glowing eye spheres' colour (the generated head's painted eyes sit under them) */
const EYE = srgb(0.35, 1.0, 1.0);
const eyePaint: Paint = (out) => { out.copy(EYE); };

const CAPTAIN_DIMS: AnimalSpecies['dims'] = { bodyY: 0.95, bodyHalfLen: 0.5, bodyRadius: 0.3, headRadius: 0.16, legLen: 0.85, feet: [[0.12, 0.05], [-0.12, 0.05], [0.12, -0.05], [-0.12, -0.05]], halfWidth: 0.28, capsuleAxis: 'y' };

/** The captain's rig: the sailor's bones, the limb joints fitted to the generated mesh (measured band by band, E70 round
 *  3: he hangs his arms lower and wider than the sailor and stands wider), so the elbows and shoulders pivot where his
 *  arms bend. */
function captainBones(): BoneDef[] {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.95, 0] },
    { name: 'spine', parent: 'body', pos: [0, 1.12, 0] },
    { name: 'chest', parent: 'spine', pos: [0, 1.32, 0] },
    { name: 'head', parent: 'chest', pos: [0, 1.56, 0.02] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.26, 1.42, 0] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.40, 1.12, 0.02] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.47, 0.84, 0.05] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.12, 0.90, 0] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.16, 0.48, 0.01] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.17, 0.08, 0.02] },
    );
  }
  return bones;
}

/** The generated captain (codex concept → Hunyuan3D-2, ./captainMesh.ts) bound to his bones, so animateCaptain() drives
 *  it unchanged, with the glowing eye spheres on top (the generated head's painted cyan eyes sit at x 0.022 ± 0.034,
 *  y 1.70, z 0.084 of its 1.9 m frame — measured off the file's texture, E343). The play installer awaits the file; a
 *  build before it refuses. */
function buildCaptain(mesh: CaptainMesh = captainMesh): AnimalSpecies {
  const bones = captainBones(), head = boneIndex(bones)('head');
  const eyes = [1, -1].map((sx) => skinPlain(new THREE.SphereGeometry(0.02, 8, 6).translate(0.022 + sx * 0.034, 1.70, 0.092), head, 'eye', eyePaint));
  const generated = mesh.meshFor(bones);
  return { bones, furParts: [generated.parts[0]], hardParts: [generated.parts[1]], eyeParts: eyes, dims: CAPTAIN_DIMS, ...(generated.map ? { map: generated.map, selfLight: 0.5 } : {}), facetJitter: 0 };
}

// ── animation (the sailor's rig language, heavier) ────────────────────────────────────────




export const CAPTAIN: SpeciesRow = { ...ENEMY_SPECIES_METADATA.captain, act: actCaptain, think: thinkCaptain };

/** the captain's look over a mesh (the page's by default; a test passes its own) */
export function captainLook(mesh: CaptainMesh = captainMesh): SpeciesLook { return {
  rigContract: { skeleton: 'captain.v1', clips: [], sockets: ['body', 'head'] },
  id: 'driftwood.look.captain', species: CAPTAIN.id, kind: 'captain',
  standMem: { init: 1, rise: 1 }, // it waits sunk in its pool until woken: the Explorer shows it risen
  fur: NO_FUR,
  rig: 'custom',
  eyeGlow: [0.2, 1.0, 1.0], eyeGlowIntensity: 1.4,
  build: () => buildCaptain(mesh),
  animate: animateCaptain,
}; }
export const CAPTAIN_LOOK: SpeciesLook = captainLook();

const brains = new WeakMap<Animal, CaptainBrain<Animal>>();
function brain(a: Animal): CaptainBrain<Animal> {
  let value = brains.get(a);
  if (value === undefined) { value = new CaptainBrain(a); brains.set(a, value); }
  return value;
}
function thinkCaptain(a: Animal, ctx: ThinkCtx): void { brain(a).think(ctx); }
function actCaptain(a: Animal, ctx: ThinkCtx): void { brain(a).act(ctx); }
