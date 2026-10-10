import { coneFanType, type ConeFanWeapon } from '@wildshard/sdk/items/coneFan';
import { FAN_STRIKES } from '../data/items';
import { FAN_VIEW } from '../data/fanView';
import { FAN_ROW } from './rows';
import { fanParts, type FanParts } from './fanModel';

/**
 * The war fan (rung 3) as a row over the platform's cone fan (SHARD-PLATFORM M3): SWING is an arc slash through the
 * damage pipeline; holding it (touch) or HEAVY (mouse 2) gives the heavy slash. GUST (`far.gust`) blows a cone of wind:
 * every creature in it takes an impulse away from the player and a little damage, which throws it off an island edge when
 * it stands near one. Its numbers are data/items.ts FAN_STRIKES (the renderer-free host runs them too, runtime/fan.ts),
 * its viewmodel data/fanView.ts FAN_VIEW over the model of weapons/fanModel.ts (the tassel its pendant).
 */
export const WarFan = coneFanType({ row: FAN_ROW, strikes: FAN_STRIKES, view: FAN_VIEW, gustAction: 'far.gust', parts: fanParts });
/** A built war fan. */
export type WarFanWeapon = ConeFanWeapon<FanParts>;
