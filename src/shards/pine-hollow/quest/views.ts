/** Counted beaver pool view. The data-only story host owns play state, its puffs, lanterns and canoe. */
import type { ShardContext } from '@wildshard/game/plugin/context';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { installForestStory } from '@wildshard/sdk/quest/forestStory';
import type { PineLandmarks } from '../runtime/world/landmarks';
import { BeaverPool } from '../world/beaverPool';
import './pinehollow.css';

export class PineQuestViews {
  private constructor(readonly flags: Flags, private readonly pool: BeaverPool) { pool.setOpen(flags.has('open:dam-sluice'), true); }
  static async install(ctx: ShardContext, landmarks: PineLandmarks): Promise<PineQuestViews> {
    const flags = await installForestStory(ctx, await ctx.product.json('quests/forest-story.json'));
    const world = ctx.game.runtime?.world;
    if (world === undefined || world === null) throw new Error('Missing quest view world');
    const pool = await new BeaverPool(world.sky).build(); landmarks.group.add(pool.group);
    return new PineQuestViews(flags, pool);
  }
  present(dt: number): void {
    this.pool.setOpen(this.flags.has('open:dam-sluice')); this.pool.update(dt);
  }
}
