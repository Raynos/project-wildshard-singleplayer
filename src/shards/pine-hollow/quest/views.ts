/** Counted pool, lamp and canoe views. The data-only story host owns play state and draws its puffs. */
import type { ShardContext } from '@wildshard/game/plugin/context';
import type { ForestStory } from '@wildshard/sdk/quest/forestStoryRows';
import { installForestStory } from '@wildshard/sdk/quest/forestStory';
import type { PineLandmarks } from '../runtime/world/landmarks';
import { BeaverPool } from '../world/beaverPool';
import './pinehollow.css';

export class PineQuestViews {
  private canoeAway = false;
  private readonly lit = new Map<string, boolean>();
  private readonly done;
  private constructor(readonly quest: ForestStory, private readonly landmarks: PineLandmarks, private readonly pool: BeaverPool, done: string) {
    this.done = done;
    pool.setOpen(quest.flags.has('open:dam-sluice'), true); this.lamps();
  }
  static async install(ctx: ShardContext, landmarks: PineLandmarks): Promise<PineQuestViews> {
    const quest = await installForestStory(ctx, await ctx.product.json('quests/forest-story.json'));
    const world = ctx.game.runtime?.world, declared = ctx.product.shardfile.quests.quests[0];
    if (world === undefined || world === null || declared === undefined) throw new Error('Missing quest view world');
    const pool = await new BeaverPool(world.sky).build(); landmarks.group.add(pool.group);
    return new PineQuestViews(quest, landmarks, pool, declared.completeFlag);
  }
  private lamps(): void {
    for (const id of ['pond', 'ridge', 'den'] as const) {
      const on = this.quest.flags.has(`lit:${id}`) || this.quest.flags.has(this.done);
      if (this.lit.get(id) !== on) { this.lit.set(id, on); this.landmarks.setLit(id, on); }
    }
  }
  present(dt: number): void {
    const { quest } = this;
    this.pool.setOpen(quest.flags.has('open:dam-sluice')); this.pool.update(dt); this.lamps();
    if (this.canoeAway !== quest.moverAway) { this.canoeAway = quest.moverAway; this.landmarks.setCanoeAway(this.canoeAway); }
  }
}
