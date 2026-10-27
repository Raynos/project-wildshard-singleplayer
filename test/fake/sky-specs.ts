import { bakedSpecs } from '../../src/game/plugin/brain';
import { skyPhysicsActors } from '../../src/shards/far-reach/generators/physics';

/** Test-only access to the actual native recipes; production preparation owns no redundant oracle export. */
export const skySpecs = (): ReturnType<typeof bakedSpecs> => bakedSpecs(skyPhysicsActors());
