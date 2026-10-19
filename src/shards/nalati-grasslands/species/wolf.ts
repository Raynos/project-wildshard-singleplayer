import ecology from '../data/ecology.generated.json' with { type: 'json' };
import type { RGB } from '@wildshard/engine/entities/species/loft';
import type { SpeciesDef, AnimalSpecies, VariantDef, RigAnimCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { engineString } from '@wildshard/engine/strings';





import { nalatiBody, poseNalatiCreature } from './presentation';
import { Pack } from '../runtime/groupRegistry';

/**
 * Steppe wolf (Nalati, row B4) — grey-tawny, a dark saddle over a buff coat, cream mask / throat / belly, a thick ruff on
 * the neck, amber eyes, a bushy black-tipped tail. 0.78 m at the shoulder. Pack hunter: the AI is `src/shards/nalati-grasslands/runtime/groupDispatch.ts`
 * (roles alpha / flankers / lunger / scout; roam → scent → shadow → encircle → lunge → howl regroup → break).
 *
 * The same canid build makes the camp's sheepdog (`species/sheepdog.ts`, trait `dog`): a black-and-white collie.
 *
 * Rig: the quadruped skeleton (Animal.ts poses it) + extra bones `jaw` (bite / snarl / howl), `tail2` (the brush).
 * `postPose` (SpeciesDef hook) layers the species' own motion from `animal.mem` (numbers 0..1 the Pack writes):
 *   mem.low    shadowing crouch — belly to the grass, head level and forward
 *   mem.snarl  lips back, jaw a crack open, ears flat (the 0.4 s lunge telegraph)
 *   mem.howl   head thrown back, jaw open — the regroup call (wolf-2 mockup)
 *   attackPhase (Animal.startAttack) the lunge: coil (0–0.3) → spring (0.3–0.7) → bite snap (0.7–1)
 * Stats: 70 hp (alpha 110); trot 4.0, run 9.5 m/s; bite 12 (alpha 18).
 * Palette keys (VariantDef.tint): back side cream leg dark nose earIn eye mouth scar.
 */

export const WOLF = {   // exported: glbCreatures.ts recolours the rigged hull per variant from it
  back: [0.20, 0.185, 0.175], side: [0.60, 0.52, 0.42], cream: [0.90, 0.86, 0.78], leg: [0.66, 0.55, 0.41],
  dark: [0.14, 0.12, 0.11], nose: [0.05, 0.045, 0.045], earIn: [0.82, 0.70, 0.58], eye: [0.86, 0.60, 0.16],
  mouth: [0.42, 0.10, 0.10], scar: [0.80, 0.55, 0.52],
} satisfies Record<string, RGB>;

/** Greymane, the pack alpha: silver back, pale ruff */
const ALPHA_TINT: Record<string, RGB> = { back: [0.34, 0.34, 0.36], side: [0.72, 0.70, 0.66], cream: [0.95, 0.94, 0.91], leg: [0.70, 0.66, 0.60] };
const TAWNY_TINT: Record<string, RGB> = { back: [0.30, 0.24, 0.19], side: [0.72, 0.55, 0.34], leg: [0.72, 0.56, 0.37], cream: [0.92, 0.84, 0.70] };
const DARK_TINT: Record<string, RGB> = { back: [0.15, 0.14, 0.14], side: [0.32, 0.30, 0.28], leg: [0.36, 0.33, 0.30], cream: [0.62, 0.58, 0.52] };
const SCOUT_TINT: Record<string, RGB> = { back: [0.32, 0.29, 0.25], side: [0.72, 0.62, 0.48], leg: [0.74, 0.64, 0.50] };

/** the sheepdog: a black-and-white collie (species/sheepdog.ts) */
export const COLLIE_TINT: Record<string, RGB> = {
  back: [0.06, 0.06, 0.065], side: [0.08, 0.075, 0.08], cream: [0.93, 0.92, 0.89], leg: [0.92, 0.91, 0.88],
  dark: [0.05, 0.05, 0.05], earIn: [0.30, 0.22, 0.20], eye: [0.30, 0.18, 0.08],
};
/** The camp's sheepdog's one variant (species/sheepdog.ts): here, beside its tint, so the spawn rolls read it renderer-free. */
export const SHEEPDOG_VARIANTS: VariantDef[] = [{ id: 'collie', label: engineString('s_062ffea0e911'), weight: 1, rarity: 'common', scale: [0.7, 0.72], hp: 60, tint: COLLIE_TINT, traits: { dog: 1, ruff: 1.1 } }];

/**
 * The canid skeleton + lofts (wolf proportions at scale 1; `v.traits.dog` = the collie): its variant's baked body
 * (`generators/canidBody.ts` -> `species/bodies.ts`). Used by wolf.ts, sheepdog.ts and kokbori.ts.
 */
export const buildCanid = (v: VariantDef): AnimalSpecies => nalatiBody('canid', v);

export function canidPostPose(c: RigAnimCtx): void { poseNalatiCreature(c.alive ? 'canid' : 'canidDead', c); }

export const WOLF_SPECIES: SpeciesDef = {
  ...ecology.gameplay.wolf,
  lockable: true,
  rigContract: { skeleton: 'wolf.v1', clips: [], sockets: ['body', 'head'] },
  kind: 'wolf',
  label: 'Steppe wolf',
  fur: NO_FUR,
  pose: { grazeNeck: 0.5, gallopTail: 0.3 },
  gait: { trot: 1.8, gallop: 5.6 },
  variants: [
    { id: 'grey', label: 'Steppe wolf', weight: 50, rarity: 'common', scale: [0.95, 1.05] },
    { id: 'tawny', label: 'Steppe wolf', weight: 30, rarity: 'common', scale: [0.92, 1.02], tint: TAWNY_TINT },
    { id: 'dark', label: 'Dark wolf', weight: 8, rarity: 'uncommon', scale: [1.0, 1.08], tint: DARK_TINT },
    { id: 'scout', label: 'Young wolf', weight: 12, rarity: 'common', scale: [0.84, 0.86], hp: 55, tint: SCOUT_TINT, traits: { ruff: 0.8 } },
    {
      id: 'alpha', label: engineString('s_92e75ea269b1'), weight: 0, rarity: 'rare', scale: [1.16, 1.16], hp: 110, tint: ALPHA_TINT,
      traits: { scar: 1, ruff: 1.25 }, mods: { chargeDamage: 18 },
    },
  ],
  build: buildCanid,
  postPose: canidPostPose,
  act: (a, c) => { const pack = Pack.of(a); if (pack !== null && a.alive) { pack.drive(a, c, true); c.confine(a); } },
  think: (a, c) => {
    const pack = Pack.of(a); if (pack === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
    const last = a.mem['groupThinkAt']; if (last !== undefined && c.t - last < .1 - 1e-9) return;
    a.mem['groupThinkAt'] = c.t; const step = { ...c, dt: last === undefined ? c.dt : c.t - last }; pack.tick(step); pack.drive(a, step); c.confine(a);
  },
};
