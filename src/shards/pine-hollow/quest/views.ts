/** G565 / G571: Pine's quest views are the shared quest page views (game/quest/questPageViews) over the story file's view
 * rows; this module carries Pine's quest stylesheet. */
import type { ShardContext } from '@wildshard/game/plugin/context';
import { QuestPageViews } from '@wildshard/game/quest/questPageViews';
import './pinehollow.css';

/** The views chain their own world update after the runtime's, for this scope. */
export async function installPineQuestViews(ctx: ShardContext): Promise<void> {
  await QuestPageViews.install(ctx, await ctx.product.json('quests/forest-story.json'));
}
