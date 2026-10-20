import { installEnteredRuntimeService, retainsRuntimeServices } from '@wildshard/game/shard/retainedHooks';
import type { ShardContext } from '@wildshard/game/shard/context';
import { wildEnv } from '@wildshard/game/population/pageGroups';

/** Lend the entered page's admitted population observations for its scope. */
export function bindEnteredEnvironment(ctx: ShardContext,input: unknown): void {
  if (retainsRuntimeServices(ctx)) installEnteredRuntimeService(ctx,scope => { wildEnv.enter(scope,input); });
  else wildEnv.enter(ctx.scope,input);
}
