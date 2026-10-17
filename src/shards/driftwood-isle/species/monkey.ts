import type { SpeciesBrains } from '@wildshard/sdk/speciesBrains';
import { app } from '@wildshard/engine/app/runtime';
import type { Rng } from '@wildshard/engine/core/rng';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { creatureBody } from './bodies';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { biteMonkey, throwMonkeyCoconut, pickPerch, setPerch } from './monkeyPolicy';
import { createMemoryActionBrain } from '@wildshard/game/plugin/brain';
import { MONKEY_ACTIONS } from '../data/speciesActions';

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

// ── animation ────────────────────────────────────────────────────────────────────────────




// ── AI ───────────────────────────────────────────────────────────────────────────────────


/** G51: preserve the existing shared cooldown stream and its lazy creation order. */
export function monkeyAttackRandom(): Pick<Rng, 'range'> { return app.rng.stream('ai'); }

export function monkeyCallbacks(brains: SpeciesBrains): ReturnType<SpeciesBrains['bind']> { return brains.bind('monkey', (actor, decision, ctx) => {
  if (decision.archetype !== 'perch-hunter') throw new Error('Driftwood monkey requires its authored perch guardian row');
  if (ctx === undefined) throw new Error('Driftwood monkey requires its first callback context');
  let current = ctx;
  const ports = { ...ctx,
    attackRandom: { range: (min: number, max: number): number => monkeyAttackRandom().range(min, max) },
    pickPerch: (a: Animal, min: number, max: number, away?: Animal['position']): number => pickPerch(a, current, min, max, away),
    setPerch: (a: Animal, index: number): void => { setPerch(a, current, index); },
  };
  return createMemoryActionBrain<Animal, ThinkCtx>(actor, MONKEY_ACTIONS, { decide: (_actor, context) => {
    current = context; Object.assign(ports, context); decision.policy.think(ports);
  }, effects: new Map([['bite', biteMonkey], ['throw', throwMonkeyCoconut]]) });
}); }

export const MONKEY_LOOK: SpeciesLook = {
  rigContract: { skeleton: 'monkey.v1', clips: [], sockets: ['body', 'head'] },
  id: 'driftwood.look.monkey', species: 'creature.monkey', kind: 'monkey',
  fur: NO_FUR,
  rig: 'custom',
  // the lofted body, baked offline (generators/creatureBodies.ts, the elder's grey coat included)
  build: (v) => creatureBody('monkey', v.id),
};
