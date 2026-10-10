import { eliteThink, eliteAct, eliteDamageMul } from '@wildshard/engine/entities/eliteBrain';
import type { SpeciesDef, AnimalSpecies, VariantDef, RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR, smooth01, clamp } from '@wildshard/engine/entities/species/rigs';
import { engineString } from '@wildshard/engine/strings';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

import type * as THREE from 'three';
import { nalatiBody } from './bodies';







/**
 * Golden eagle (Nalati named elite E3 — Qyran the Storm-Wing, Berkut of the High Wind; row B12; mockup
 * art/nalati-grasslands/round-2/4-named-elites/elite-3-qyran-storm-wing.jpg). A berkut: dark chocolate body and coverts,
 * near-black primaries spread like fingers, the golden nape (glowing faintly — it is a storm bird), a pale-banded tail
 * fan, a heavy yellow-based hooked beak, feathered trousers and yellow talons. 2.3 m across at scale 1 (Qyran ×3: ~6.7 m, so he reads 30 m up in a storm).
 *
 * A CUSTOM rig: body · neck · head · tail · per side wing1 (shoulder) / wing2 (wrist) · leg. It flies: the elite's brain
 * moves it and writes `animal.mem` (numbers):
 *   altY   absolute world y of the body (the animal's yOffset follows it, smoothed)
 *   flap   0..1 wingbeat amplitude (0 = soaring)         fold  0..1 wings swept back and tucked (the STOOP)
 *   bank   roll (rad, + = left wing down)                ground 0..1 grounded: wings half open, beating hard (the punish window)
 */

export const EAGLE = 'eagle';

type Side = 'L' | 'R';
type EagleBones = Record<'body' | 'neck' | 'head' | 'tail' | `wing${Side}1` | `wing${Side}2` | `leg${Side}`, THREE.Bone>;

/** the eagle's body: the variant's baked lofts (`generators/eagleBody.ts` -> `species/bodies.ts`) */
const buildEagle = (v: VariantDef): AnimalSpecies => nalatiBody('eagle', v);

function animateEagle(c: RigAnimCtx): void {
  const b = c.bones as EagleBones, m = c.mem, a = c.animal, dt = c.dt;
  // altitude: the brain's absolute y, smoothed
  const alt = m['altY'] ?? heightAt(a.position.x, a.position.z) + 20;
  m['altS'] = (m['altS'] ?? alt) + (alt - (m['altS'] ?? alt)) * Math.min(1, dt * 6);
  a.yOffset = (m['altS'] ?? alt) - heightAt(a.position.x, a.position.z);
  const dead = c.deathT >= 0 ? smooth01(c.deathT) : 0;
  const flap = clamp(m['flap'] ?? 0.3, 0, 1) * (1 - dead), fold = clamp(m['fold'] ?? 0, 0, 1), ground = clamp(m['ground'] ?? 0, 0, 1);
  const f = c.t * (4.5 + 3 * ground) + c.seed * 7;
  const beat = Math.sin(f) * (0.55 * flap + 0.5 * ground);
  const lag = Math.sin(f - 0.8) * (0.35 * flap + 0.3 * ground);
  const dihedral = 0.12 * (1 - fold) * (1 - ground);
  b.body.rotation.set(1.1 * fold - 0.5 * ground + 0.8 * dead, 0, (m['bank'] ?? 0) * (1 - ground));
  b.body.position.y = -0.03 * beat;
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    // spread: shoulder up / down with the beat; fold: swept back and tucked; grounded: half open, mantling
    b[`wing${side}1`].rotation.set(0, sx * (1.25 * fold + 0.35 * ground), sx * (beat + dihedral - 0.25 * fold + 0.35 * ground - 0.6 * dead));
    b[`wing${side}2`].rotation.set(0, sx * (0.9 * fold + 0.6 * ground), sx * (lag - 0.1 * fold - 0.5 * ground));
    b[`leg${side}`].rotation.set(0.9 * (1 - ground) * (1 - fold * 0.5) - 0.2 * ground, 0, 0);
  }
  b.tail.rotation.set(-0.1 * fold + 0.3 * ground, 0, -0.3 * (m['bank'] ?? 0));
  b.neck.rotation.set(-0.3 * fold + 0.4 * ground, 0, 0);
  b.head.rotation.set(0.2 * fold - 0.3 * ground + 0.1 * Math.sin(c.t * 2 + c.seed), 0.3 * Math.sin(c.t * 0.7 + c.seed), 0);
}

export const EAGLE_SPECIES: SpeciesDef = {
  lockable: true,
  rigContract: { skeleton: 'eagle.v1', clips: [], sockets: ['body', 'head'] },
  kind: EAGLE,
  label: engineString('s_c0752fe7f23a'),
  fur: NO_FUR,
  rig: 'custom',
  aggressive: true,
  walkSpeed: 0.5,
  chargeDamage: 30,
  sounds: { call: 'eagle_cry', hurt: 'eagle_cry', callEvery: [8, 18] }, // its own cry, not Driftwood's monkey (NALATI-MERGE F6)
  variants: [
    { id: 'qyran', label: engineString('s_d1761c145199'), weight: 1, rarity: 'legendary', scale: [3, 3], hp: 600 },
  ],
  build: buildEagle,
  animate: animateEagle,
  tick: 'ai',
  act: eliteAct,
  think: eliteThink,
  damageMul: eliteDamageMul,
};
