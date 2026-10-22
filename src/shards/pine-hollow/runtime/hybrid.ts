/** The final transition constructor; every world, kit and play operation is a declared client feature. */
import { ShardPlugin } from '@wildshard/game/plugin/context';

export class PineHollow extends ShardPlugin {}
// oxlint-disable-next-line import/no-default-export -- The trusted loader consumes the transition constructor until built-in entry activation.
export default PineHollow;
