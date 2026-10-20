import ecology from '../data/ecology.generated.json' with { type: 'json' };
import { eliteThink, eliteAct, eliteDamageMul } from '@wildshard/game/quest/elitePage';
import type { SpeciesDef, AnimalSpecies, VariantDef, RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';

import { nalatiBody, poseNalatiCreature } from './presentation';







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

/** the eagle's body: the variant's baked lofts (`generators/eagleBody.ts` -> `species/bodies.ts`) */
const buildEagle = (v: VariantDef): AnimalSpecies => nalatiBody('eagle', v);

function animateEagle(c: RigAnimCtx): void {
  const m = c.mem, a = c.animal, dt = c.dt;
  // altitude: the brain's absolute y, smoothed
  const alt = m['altY'] ?? heightAt(a.position.x, a.position.z) + 20;
  m['altS'] = (m['altS'] ?? alt) + (alt - (m['altS'] ?? alt)) * Math.min(1, dt * 6);
  a.yOffset = (m['altS'] ?? alt) - heightAt(a.position.x, a.position.z);
  poseNalatiCreature('eagle', c);
}

const { id: _id, brain: _brain, ...body } = ecology.species.eagle;
export const EAGLE_SPECIES: SpeciesDef = {
  ...body,
  rigContract: { skeleton: 'eagle.v1', clips: [], sockets: ['body', 'head'] },
  kind: EAGLE,
  fur: NO_FUR,
  rig: 'custom',
  build: buildEagle,
  animate: animateEagle,
  tick: 'ai',
  act: eliteAct,
  think: eliteThink,
  damageMul: eliteDamageMul,
};
