import type { RigAnimCtx, VariantDef } from './registry';

/**
 * The Antler King's thralls (PINE-HOLLOW-REMASTER PH-U9 / PH-M2): moss-grown, glassy-eyed elk and boar he calls from the
 * fog. Not a species — a spawn-only variant of the elk and the boar (SpeciesDef.spawnOnly, so a herd never rolls one: the
 * King's fight / the old-growth at night spawns them by id, `animals.spawn(kind, x, z, yaw, 'thrall')` — the id as a string). They wear the
 * regular hull in the "Overgrown" coat (board B3 pick A: pineCoats.ts `thrall`, glass eyes + fern clumps in
 * pineCreatures.ts) and walk with `thrallPose`: a stiffer gait on the same rig.
 */
export const THRALL_TRAITS = { thrall: 1 } as const satisfies VariantDef['traits'];

const STIFF: readonly string[] = ['FL_carpus', 'FR_carpus', 'FL_fetlock', 'FR_fetlock', 'BL_stifle', 'BR_stifle', 'BL_hock', 'BR_hock'];

/**
 * SpeciesDef.postPose for a species with a thrall variant: on a thrall only, the knees and hocks barely bend (the legs
 * swing stiff from the shoulder and the hip, a dead thing walking), the head hangs a little low and twitches aside every
 * second or so, and the body lurches with the stride. Additive on the pose Animal.ts wrote this frame.
 */
export function thrallPose(c: RigAnimCtx): void {
  if (c.animal.variant !== 'thrall' || !c.alive) return;
  const b = c.bones;
  for (const n of STIFF) { const bone = b[n]; if (bone) bone.rotation.x *= 0.3; }
  const twitch = Math.max(0, Math.sin(c.t * 4.6 + c.seed * 7.1)) ** 14;   // a sharp jerk, ~every 1.4 s
  const side = Math.sin(c.seed * 13.7) > 0 ? 1 : -1;
  const neck = b['neck1'], head = b['head'], body = b['body'];
  if (neck) neck.rotation.x += 0.1;
  if (head) { head.rotation.x += 0.08 + 0.1 * twitch; head.rotation.y += 0.35 * twitch * side; head.rotation.z += 0.3 * twitch * side; }
  const moving = Math.min(1, Math.abs(c.speed) / 1.2);
  if (body) body.rotation.z += 0.05 * moving * Math.sin(c.phase * Math.PI * 2);
}
