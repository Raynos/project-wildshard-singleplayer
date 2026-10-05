import { ChallengeGrazerBrain } from '@wildshard/engine/ai/challengeGrazer';
import { PatrolDiverBrain } from '@wildshard/engine/ai/patrolDiver';
import { challengeGrazer } from '@wildshard/sdk/grazers';
import { patrolDiver } from '@wildshard/sdk/flyers';
import { STRIDER_BRAIN, RAY_BRAIN } from '../data/brains';
import { DUNE_STRIDER, CHARGE, HORNS } from '../species/strider';
import { DUNE_RAY, SWOOP } from '../species/duneRay';
import { SAND_SKITTERER, slot } from '../species/skitterer';
import { DUNE_MATRIARCH } from '../species/matriarch';
import { RAY_HOME } from '../layout';

type Actor = Parameters<NonNullable<typeof DUNE_STRIDER.think>>[0];
type Context = Parameters<NonNullable<typeof DUNE_STRIDER.think>>[1];
interface Selection { rows: (typeof DUNE_STRIDER)[]; witness: (actor: Actor) => string | null }

/** SF27: data-selected ordinary policies; shared steering, flight, tokens, held memory and unique boss stay native. */
export function declaredDuneRows(): Selection {
  const data = challengeGrazer(STRIDER_BRAIN), flight = patrolDiver({ ...RAY_BRAIN, home: { x: RAY_HOME.x, z: RAY_HOME.z } });
  const striders = new WeakMap<Actor, ChallengeGrazerBrain<Actor>>(), rays = new WeakMap<Actor, PatrolDiverBrain<Actor>>();
  const strider = (actor: Actor): ChallengeGrazerBrain<Actor> => {
    let value = striders.get(actor); if (value === undefined) { value = new ChallengeGrazerBrain(actor, data, CHARGE, HORNS); striders.set(actor, value); } return value;
  };
  const ray = (actor: Actor): PatrolDiverBrain<Actor> => {
    let value = rays.get(actor); if (value === undefined) { value = new PatrolDiverBrain(actor, flight, flight.home, SWOOP); rays.set(actor, value); } return value;
  };
  return { rows: [
    { ...DUNE_RAY, think: (a: Actor, c: Context): void => { ray(a).think(c); }, act: (a: Actor, c: Context): void => { ray(a).act(c); } },
    SAND_SKITTERER,
    { ...DUNE_STRIDER, think: (a: Actor, c: Context): void => { strider(a).think({ ...c, phaseOffset: slot(a, 6) }); }, act: (a: Actor, c: Context): void => { strider(a).act({ ...c, phaseOffset: slot(a, 6) }); } },
    DUNE_MATRIARCH,
  ], witness: (actor: Actor): string | null => striders.has(actor) ? 'challenge-grazer' : rays.has(actor) ? 'patrol-diver' : null };
}
