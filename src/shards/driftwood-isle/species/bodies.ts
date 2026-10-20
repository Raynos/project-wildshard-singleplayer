import { packedCreatureBodies } from '@wildshard/game/plugin/geometry';
import bake from '../data/creatureBodies.generated.json' with { type: 'json' };

/** One admitted body library owns both page looks and fresh per-creature copies. */
export const CREATURE_BODIES = packedCreatureBodies(bake);
export const preloadCreatureBodies = CREATURE_BODIES.preload;
export const creatureBody = CREATURE_BODIES.copy;
