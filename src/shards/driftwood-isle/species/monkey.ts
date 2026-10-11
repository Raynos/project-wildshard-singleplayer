import { driftwoodSpeciesBrains } from '../runtime/speciesBrains';
import { animateMonkey } from './monkeyPose';
import type { SpeciesRow } from '@wildshard/engine/ai/species';
import { app } from '@wildshard/engine/app/runtime';
import { smoothstep as sstep } from '@wildshard/engine/core/noise';
import type { Rng } from '@wildshard/engine/core/rng';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { loft, skinPlain, S, boneIndex, mix, paletteColors, type Paint, type RGB } from '@wildshard/engine/entities/species/loft';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { AnimalSpecies, BoneDef, VariantDef, ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { MONKEY_VARIANTS } from './monkeyVariants';
import { MonkeyBrain, pickPerch, setPerch, BITE_DAMAGE } from './monkeyPolicy';
import * as THREE from 'three';

/**
 * Coconut Monkey — the palm-grove troop (art/driftwood-isle/round-3-enemies/driftwood-enemy-2-monkey.png): tan faceted fur, a dark face with a pale
 * muzzle, round ears, long arms, a long tail curling up over its back. Troops of 3–4, each in a palm crown. Custom rig:
 * body (pelvis, root) · spine · chest · head · per side arm sh / el / hand, leg hip / knee / foot · tail1..3.
 *
 * Behaviour (`think`): PERCHES in a frond crown (`EnemyWorld.perches` — Enemies.ts hands over the palm crowns; with
 * none it lives on the ground). From the crown it THROWS COCONUTS at you inside 14 m (a 1 s wind-up over its head,
 * then `world.throwCoconut` lobs one on a ballistic arc — 8 damage on a hit, and it is aimed at where you stand
 * when it leaves the hand, so strafing dodges it), every 2.5–4 s. Stand under its palm for more than 2 s and it DROPS
 * on you: chases at 3.2 m/s and BITES (0.7 s lunge, 6 damage within 1.3 m), then runs back to the trunk and CLIMBS
 * (2.2 m/s up the trunk) to its crown. When one of the troop dies the rest drop and flee to another palm 12–45 m
 * away. On the ground it scampers on all fours.
 */

const PALETTE = {
  fur: [0.78, 0.60, 0.36], back: [0.55, 0.40, 0.23], belly: [0.90, 0.80, 0.60],
  face: [0.20, 0.13, 0.09], muzzle: [0.84, 0.70, 0.56], hand: [0.24, 0.16, 0.11], earIn: [0.72, 0.48, 0.42], eye: [0.03, 0.02, 0.02],
} satisfies Record<string, RGB>;

/** the rig's bones by name — exactly the BoneDef list buildMonkey() emits (so the factory's bone map holds every key) */

/** `Animal.mem` as the monkey uses it (numbers only, the registry contract). The first `think` tick writes the first row;
 *  the rest are set as it perches / drops / climbs / bites, and `animate` (which can run first) guards them (`|| 0`, truthiness). */

function monkeyPaint(v: VariantDef): Paint {
  const P = paletteColors(PALETTE, v.tint);
  return (out, x, _y, z, nx, ny, nz, part, t) => {
    switch (part) {
      case 'body': out.copy(P.fur); mix(out, out, P.back, sstep(0.2, -0.9, nz) * 0.8); mix(out, out, P.belly, sstep(0.3, 0.9, nz) * 0.8); break;
      case 'head':
        out.copy(P.fur); mix(out, out, P.back, sstep(0.3, 0.9, ny) * 0.5);
        mix(out, out, P.face, sstep(0.38, 0.46, t) * (1 - sstep(0.82, 0.9, t)) * (1 - sstep(0.5, 0.85, ny)));   // the dark mask: the front of the skull below the brow
        mix(out, out, P.muzzle, sstep(0.86, 0.94, t)); void nz;
        break;
      case 'ear': out.copy(P.back); mix(out, out, P.earIn, sstep(0.1, 0.6, -nx * Math.sign(x)) * 0.8); break;
      case 'arm': case 'leg': out.copy(P.fur); mix(out, out, P.back, sstep(0.4, 1.0, t) * 0.5); break;
      case 'hand': out.copy(P.hand); break;
      case 'tail': out.copy(P.fur); mix(out, out, P.back, sstep(0.3, 1.0, t) * 0.7); void z; break;
      case 'eye': out.copy(P.eye); break;
      default: out.copy(P.fur);
    }
  };
}

function buildMonkey(v: VariantDef, rng: Rng): AnimalSpecies {
  const bones: BoneDef[] = [
    { name: 'body', parent: null, pos: [0, 0.42, 0] },
    { name: 'spine', parent: 'body', pos: [0, 0.52, 0.03] },
    { name: 'chest', parent: 'spine', pos: [0, 0.62, 0.05] },
    { name: 'head', parent: 'chest', pos: [0, 0.72, 0.08] },
    { name: 'tail1', parent: 'body', pos: [0, 0.42, -0.08] },
    { name: 'tail2', parent: 'tail1', pos: [0, 0.48, -0.24] },
    { name: 'tail3', parent: 'tail2', pos: [0, 0.62, -0.36] },
  ];
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    bones.push(
      { name: `arm${side}_sh`, parent: 'chest', pos: [sx * 0.12, 0.64, 0.06] },
      { name: `arm${side}_el`, parent: `arm${side}_sh`, pos: [sx * 0.14, 0.47, 0.10] },
      { name: `arm${side}_hand`, parent: `arm${side}_el`, pos: [sx * 0.15, 0.31, 0.15] },
      { name: `leg${side}_hip`, parent: 'body', pos: [sx * 0.08, 0.40, -0.02] },
      { name: `leg${side}_knee`, parent: `leg${side}_hip`, pos: [sx * 0.11, 0.25, 0.10] },
      { name: `leg${side}_foot`, parent: `leg${side}_knee`, pos: [sx * 0.11, 0.05, 0.02] },
    );
  }
  const B = boneIndex(bones);
  const paint = monkeyPaint(v);
  const fur: THREE.BufferGeometry[] = [], hard: THREE.BufferGeometry[] = [], eyes: THREE.BufferGeometry[] = [];
  const body = B('body'), spine = B('spine'), chest = B('chest'), head = B('head');
  // torso: pelvis → chest, a little pot belly
  fur.push(loft([
    S(0, 0.30, -0.01, 0.09, 0.08, body),
    S(0, 0.40, 0.0, 0.115, 0.10, body, spine, 0.2),
    S(0, 0.52, 0.02, 0.12, 0.10, spine),
    S(0, 0.62, 0.04, 0.115, 0.095, spine, chest, 0.7),
    S(0, 0.70, 0.06, 0.08, 0.07, chest),
  ], 16, 'body', paint, true, true));
  // head: round skull, short muzzle
  fur.push(loft([
    S(0, 0.74, -0.02, 0.085, 0.08, head),
    S(0, 0.755, 0.06, 0.10, 0.095, head),
    S(0, 0.752, 0.10, 0.095, 0.088, head),
    S(0, 0.745, 0.14, 0.085, 0.075, head),
    S(0, 0.735, 0.17, 0.07, 0.06, head),
    S(0, 0.72, 0.195, 0.05, 0.04, head),
    S(0, 0.71, 0.215, 0.02, 0.015, head),
  ], 16, 'head', paint, true, true));
  for (const sx of [1, -1]) {
    fur.push(loft([
      S(sx * 0.085, 0.78, 0.05, 0.03, 0.02, head),
      S(sx * 0.115, 0.80, 0.045, 0.042, 0.03, head),
      S(sx * 0.14, 0.81, 0.04, 0.025, 0.018, head),
    ], 8, 'ear', paint, true, true, 'z'));
    const eye = new THREE.SphereGeometry(0.017, 8, 6);
    eye.translate(sx * 0.036, 0.775, 0.165);
    eyes.push(skinPlain(eye, head, 'eye', paint));
    const side = sx > 0 ? 'L' : 'R';
    const sh = B(`arm${side}_sh`), el = B(`arm${side}_el`), hand = B(`arm${side}_hand`);
    fur.push(loft([
      S(sx * 0.11, 0.66, 0.06, 0.045, 0.045, chest, sh, 0.5),
      S(sx * 0.135, 0.56, 0.08, 0.036, 0.036, sh),
      S(sx * 0.14, 0.47, 0.10, 0.033, 0.033, sh, el, 0.5),
      S(sx * 0.145, 0.39, 0.125, 0.03, 0.03, el),
      S(sx * 0.15, 0.32, 0.15, 0.028, 0.028, el, hand, 0.6),
    ], 8, 'arm', paint, true, false));
    hard.push(loft([S(sx * 0.15, 0.32, 0.15, 0.03, 0.03, hand), S(sx * 0.155, 0.27, 0.17, 0.038, 0.03, hand), S(sx * 0.16, 0.22, 0.18, 0.02, 0.016, hand)], 8, 'hand', paint, false, true));
    const hip = B(`leg${side}_hip`), knee = B(`leg${side}_knee`), foot = B(`leg${side}_foot`);
    fur.push(loft([
      S(sx * 0.08, 0.42, -0.02, 0.055, 0.055, body, hip, 0.5),
      S(sx * 0.10, 0.33, 0.04, 0.045, 0.045, hip),
      S(sx * 0.11, 0.25, 0.10, 0.038, 0.038, hip, knee, 0.5),
      S(sx * 0.11, 0.15, 0.06, 0.033, 0.033, knee),
      S(sx * 0.11, 0.06, 0.02, 0.03, 0.03, knee, foot, 0.6),
    ], 8, 'leg', paint, true, false));
    hard.push(loft([S(sx * 0.11, 0.045, 0.0, 0.035, 0.028, foot), S(sx * 0.11, 0.035, 0.09, 0.04, 0.025, foot), S(sx * 0.11, 0.03, 0.14, 0.02, 0.014, foot)], 8, 'hand', paint, true, true));
  }
  const t1 = B('tail1'), t2 = B('tail2'), t3 = B('tail3');
  fur.push(loft([
    S(0, 0.40, -0.06, 0.03, 0.03, body, t1, 0.3),
    S(0, 0.44, -0.16, 0.026, 0.026, t1),
    S(0, 0.50, -0.26, 0.022, 0.022, t1, t2, 0.5),
    S(0, 0.58, -0.33, 0.019, 0.019, t2),
    S(0, 0.66, -0.35, 0.016, 0.016, t2, t3, 0.5),
    S(0, 0.74, -0.30, 0.012, 0.012, t3),
    S(0, 0.77, -0.24, 0.006, 0.006, t3),
  ], 8, 'tail', paint, false, true));
  void rng;
  return {
    bones, furParts: fur, hardParts: hard, eyeParts: eyes,
    dims: { bodyY: 0.42, bodyHalfLen: 0.2, bodyRadius: 0.16, headRadius: 0.12, legLen: 0.36, feet: [[0.11, 0.06], [-0.11, 0.06], [0.11, -0.04], [-0.11, -0.04]], halfWidth: 0.16, capsuleAxis: 'y' },
  };
}

// ── animation ────────────────────────────────────────────────────────────────────────────




// ── AI ───────────────────────────────────────────────────────────────────────────────────


/** G51: preserve the existing shared cooldown stream and its lazy creation order. */
export function monkeyAttackRandom(): Pick<Rng, 'range'> { return app.rng.stream('ai'); }

export const MONKEY: SpeciesRow = {
  lockable: true,
  id: 'creature.monkey',
  kind: 'monkey',
  label: 'Coconut monkey',
  aggressive: true,
  walkSpeed: 1.2,
  chargeDamage: BITE_DAMAGE,
  sounds: { call: 'monkey_chatter', hurt: 'monkey_shriek', callEvery: [6, 18] },
  variants: MONKEY_VARIANTS,
  tick: 'ai',
  act: actMonkey,
  think: thinkMonkey,
};

export const MONKEY_LOOK: SpeciesLook = {
  rigContract: { skeleton: 'monkey.v1', clips: [], sockets: ['body', 'head'] },
  id: 'driftwood.look.monkey', species: MONKEY.id, kind: 'monkey',
  fur: NO_FUR,
  rig: 'custom',
  build: buildMonkey,
  animate: animateMonkey,
  variants: { elder: { tint: { fur: [0.62, 0.58, 0.50], back: [0.40, 0.37, 0.32], belly: [0.85, 0.82, 0.74] } } },
};

const brains = new WeakMap<Animal, MonkeyBrain<Animal, ThinkCtx>>();
function brain(a: Animal, ctx: ThinkCtx): MonkeyBrain<Animal, ThinkCtx> {
  let value = brains.get(a);
  if (value === undefined) {
    const decision = driftwoodSpeciesBrains.decision('monkey', a);
    if (decision.archetype !== 'perch-hunter') throw new Error('Driftwood monkey requires its authored perch guardian row');
    // Allocate native recipe ports once per animal, preserving the lazy shared attack stream.
    let current = ctx;
    const ports = { ...ctx,
      attackRandom: { range: (min: number, max: number): number => monkeyAttackRandom().range(min, max) },
      pickPerch: (actor: Animal, min: number, max: number, away?: Animal['position']): number => pickPerch(actor, current, min, max, away),
      setPerch: (actor: Animal, index: number): void => { setPerch(actor, current, index); },
    };
    value = new MonkeyBrain<Animal, ThinkCtx>(a, (_actor, context) => {
      current = context; Object.assign(ports, context); decision.policy.think(ports);
    });
    brains.set(a, value);
  }
  return value;
}
function thinkMonkey(a: Animal, ctx: ThinkCtx): void { brain(a, ctx).think(ctx); }
function actMonkey(a: Animal, ctx: ThinkCtx): void { brain(a, ctx).act(ctx); }
