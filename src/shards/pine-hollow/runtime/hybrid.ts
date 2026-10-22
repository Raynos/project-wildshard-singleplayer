/** Counted custom view binding: the King's model kit. The forest page, its cave, weather and
 * life are declared client features (data/clientPlan.json: world.forest-page, weather.forest, page.life). */
import { ShardPlugin, type ShardContext } from '@wildshard/game/plugin/context';
import { prepareHullBookKit } from '@wildshard/game/models/socketRigCreature';
import { ANTLER_KING } from './models/antlerKing';

export class PineHollow extends ShardPlugin {
  override async kit(ctx: ShardContext): Promise<void> { await prepareHullBookKit(ctx, [ANTLER_KING]); }
}
// oxlint-disable-next-line import/no-default-export -- The trusted loader consumes the counted view constructor.
export default PineHollow;
