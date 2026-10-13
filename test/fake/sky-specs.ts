import { bakedSpecs } from '../../src/game/plugin/brain';
import baked from '../../src/shards/far-reach/data/physics.generated.json' with { type: 'json' };

/** Test-only access to the actual native recipes; production preparation owns no redundant oracle export. */
export const skySpecs = (): ReturnType<typeof bakedSpecs> => bakedSpecs(baked.actors);
