import type { LookStrategy } from '@wildshard/engine/render/look';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { toonLook } from '@wildshard/game/looks/toonLook';
import { admitDriftwoodRows } from '../boot/rows';

/** The product supplies its complete toon look; legacy native readers share its admitted rows. */
export function shardRender(product: ShardProduct): LookStrategy { admitDriftwoodRows(product); return toonLook(product); }
