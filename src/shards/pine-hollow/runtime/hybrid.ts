/** Counted custom view binding: the King's model views and Pine's quest views. The forest page, its cave, weather and
 * life are declared client features (data/clientPlan.json: world.forest-page, weather.forest, page.life). */
import { ShardPlugin, type ShardContext } from '@wildshard/game/plugin/context';
import { prepareHullBookKit } from '@wildshard/game/models/socketRigCreature';
import { ANTLER_KING } from './models/antlerKing';
import { installPineQuestViews } from '../quest/views';

export class PineHollow extends ShardPlugin {
  override async kit(ctx: ShardContext): Promise<void> { await prepareHullBookKit(ctx, [ANTLER_KING]); }
  override async play(ctx: ShardContext): Promise<void> { await installPineQuestViews(ctx); }
}
// oxlint-disable-next-line import/no-default-export -- The trusted loader consumes the counted view constructor.
export default PineHollow;
