import { HullLookBook } from '@wildshard/game/looks/speciesBook';
import bake from '../data/creatureBodies.generated.json' with { type: 'json' };

/** One admitted body library owns both page looks and fresh per-creature copies. */
const { fauna, ...body } = bake;
export const FAUNA_LOOKS = new HullLookBook({ ...fauna, body });
export const CREATURE_BODIES = FAUNA_LOOKS.packed;
export const preloadCreatureBodies = CREATURE_BODIES.preload;
export const creatureBody = CREATURE_BODIES.copy;
