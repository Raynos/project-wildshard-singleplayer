import type { ShardContext } from '@wildshard/game/shard/context';
import { bindRuntimeActor, type RuntimeActor } from '@wildshard/game/shardfile/hybridRows';
import { setHome } from '../species/rig';
import type { Home } from '../layout';
import source from '../shard.config';

/** Validate and prepare a finite body before fixed-step placement; keep native allocated identities and flight homes. */
export function bindSkyActor(ctx: ShardContext, id: string, home: Home): RuntimeActor {
  return bindRuntimeActor(ctx, source, id, animal => { setHome(animal, home); }, { identity: 'runtime' });
}
