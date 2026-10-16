import type { SkyBackdropFactory } from '@wildshard/engine/render/look';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { DRIFTWOOD_FACETED_DAY } from '../../look/dayKeys';
import { facetedDayBackdrop } from '../looks/facetedDayBackdrop';

/** Driftwood's sky backdrop: the faceted day (runtime/looks/facetedDayBackdrop.ts) on the island's clock (look/dayKeys.ts). */
export const stylizedBackdrop = (product: ShardProduct): SkyBackdropFactory => facetedDayBackdrop(product, DRIFTWOOD_FACETED_DAY);
