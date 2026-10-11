import { SKY_GOAT } from '../species/skyGoat';
import { DRIFT_RAY } from '../species/driftRay';
import { GALE_WISP } from '../species/galeWisp';
import { STORM_ROC } from '../species/stormRoc';
import { homeOf, pushPlayer } from '../species/rig';
import { WINDMILL, RAY_HOMES, DECK, KEEPER } from '../data/layout';
import { apothem } from '../layout';
import { skyBrainCatalogue } from './brainCatalogue';

type Actor = Parameters<NonNullable<typeof SKY_GOAT.think>>[0];
type Context = Parameters<NonNullable<typeof SKY_GOAT.think>>[1];
interface Selection { rows: (typeof SKY_GOAT)[]; witness: (actor: Actor) => string | null }

/** Canonical rows select decisions; each body retains its real floors, home, RNG, flight and contact authority. */
export function declaredSkyRows(): Selection {
  const brains = skyBrainCatalogue();
  const goatHome = (actor: Actor) => homeOf(actor, { x: WINDMILL.x, z: WINDMILL.z, r: apothem(WINDMILL), y: WINDMILL.y });
  const goat = brains.bind('skyGoat', (a, decision) => {
    if (decision.archetype !== 'ram-grazer') throw new Error('Sky goat requires its admitted ram policy');
    const decideGoat = (c: Context): void => { decision.policy.think({ ...c, home: goatHome(a) }); };
    const moveGoat = (c: Context): void => { decision.policy.act({ ...c, home: goatHome(a) }); };
    return { think: decideGoat, act: moveGoat };
  });
  const ray = brains.bind('driftRay', (_actor, decision) => {
    if (decision.archetype !== 'orbit-diver') throw new Error('Sky ray requires its admitted orbit policy');
    const decideRay = (c: Context): void => { decision.policy.think(c); };
    const moveRay = (c: Context): void => { decision.policy.act(c); };
    return { think: decideRay, act: moveRay };
  }, actor => homeOf(actor, RAY_HOMES[0] ?? { x: 0, z: -24, r: 22, y: DECK + 14 }));
  const wisp = brains.bind('galeWisp', (_actor, decision) => {
    if (decision.archetype !== 'burst-flyer') throw new Error('Sky wisp requires its admitted burst policy');
    const decideWisp = (c: Context): void => { decision.policy.think({ ...c, shove: pushPlayer }); };
    const moveWisp = (c: Context): void => { decision.policy.act({ ...c, shove: pushPlayer }); };
    return { think: decideWisp, act: moveWisp };
  }, actor => homeOf(actor, { x: KEEPER.x, z: KEEPER.z, r: 7, y: KEEPER.y + 3 }));
  return { rows: [{ ...DRIFT_RAY, ...ray }, { ...SKY_GOAT, ...goat }, { ...GALE_WISP, ...wisp }, STORM_ROC], witness: brains.witness };
}
