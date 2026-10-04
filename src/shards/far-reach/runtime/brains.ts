import { directorVariant } from '@wildshard/game/shardfile/directorClient';
import { RamGrazerBrain } from '@wildshard/engine/ai/ramGrazer';
import { OrbitDiverBrain } from '@wildshard/engine/ai/orbitDiver';
import { BurstFlyerBrain } from '@wildshard/engine/ai/burstFlyer';
import { ramGrazer } from '@wildshard/sdk/grazers';
import { orbitDiver, burstFlyer } from '@wildshard/sdk/flyers';
import { GOAT_BRAIN, RAY_BRAIN, WISP_BRAIN } from '../data/brains';
import { SKY_GOAT, RAM } from '../species/skyGoat';
import { DRIFT_RAY, DIVE } from '../species/driftRay';
import { GALE_WISP, BURST } from '../species/galeWisp';
import { STORM_ROC } from '../species/stormRoc';
import { homeOf, pushPlayer } from '../species/rig';
import { WINDMILL, RAY_HOMES, DECK, KEEPER, apothem } from '../layout';

type Actor = Parameters<NonNullable<typeof SKY_GOAT.think>>[0];
type Context = Parameters<NonNullable<typeof SKY_GOAT.think>>[1];
interface Selection { rows: (typeof SKY_GOAT)[]; witness: (actor: Actor) => string | null }

/** SF27: one set of data-selected policies; native floors, flight, tokens, contact and rigs remain unchanged. */
export function declaredSkyRows(): Selection {
  const goatData = ramGrazer(GOAT_BRAIN);
  const goats = new WeakMap<Actor, RamGrazerBrain<Actor>>();
  const rays = new WeakMap<Actor, OrbitDiverBrain<Actor>>();
  const wisps = new WeakMap<Actor, BurstFlyerBrain<Actor>>();
  const goatHome = (actor: Actor) => homeOf(actor, { x: WINDMILL.x, z: WINDMILL.z, r: apothem(WINDMILL), y: WINDMILL.y });
  const goat = (actor: Actor): RamGrazerBrain<Actor> => {
    let value = goats.get(actor); if (value === undefined) { value = new RamGrazerBrain(actor, goatData, RAM); goats.set(actor, value); } return value;
  };
  const ray = (actor: Actor): OrbitDiverBrain<Actor> => {
    let value = rays.get(actor);
    if (value === undefined) {
      const home = homeOf(actor, RAY_HOMES[0] ?? { x: 0, z: -24, r: 22, y: DECK + 14 });
      value = new OrbitDiverBrain(actor, orbitDiver({ ...RAY_BRAIN, home }), home, DIVE); rays.set(actor, value);
    }
    return value;
  };
  const wisp = (actor: Actor): BurstFlyerBrain<Actor> => {
    let value = wisps.get(actor);
    if (value === undefined) {
      const home = homeOf(actor, { x: KEEPER.x, z: KEEPER.z, r: 7, y: KEEPER.y + 3 });
      value = new BurstFlyerBrain(actor, burstFlyer({ ...WISP_BRAIN, home }), home, BURST); wisps.set(actor, value);
    }
    return value;
  };
  return { rows: [
    { ...DRIFT_RAY, think: (a: Actor, c: Context): void => { ray(a).think(c); }, act: (a: Actor, c: Context): void => { ray(a).act(c); } },
    { ...SKY_GOAT, think: (a: Actor, c: Context): void => { goat(a).think({ ...c, home: goatHome(a) }); }, act: (a: Actor, c: Context): void => { goat(a).act({ ...c, home: goatHome(a) }); } },
    { ...GALE_WISP, think: (a: Actor, c: Context): void => { wisp(a).think({ ...c, shove: pushPlayer }); }, act: (a: Actor, c: Context): void => { wisp(a).act({ ...c, shove: pushPlayer }); } },
    STORM_ROC,
  ], witness: (actor: Actor): string | null => goats.has(actor) ? 'ram-grazer' : rays.has(actor) ? 'orbit-diver' : wisps.has(actor) ? 'burst-flyer' : null };
}

/** The existing shared default-off row selects one immutable set of species callbacks for this session. */
export function selectSkyRows(context: Parameters<typeof directorVariant>[0]): Selection | null { return directorVariant(context) ? declaredSkyRows() : null; }
