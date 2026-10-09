import { createFireFx as platformCreateFireFx, type FireDrift as PlatformFireDrift, type FireFx as PlatformFireFx, type FireRgb as PlatformFireRgb, type FireSize as PlatformFireSize, type FireSmoke as PlatformFireSmoke, type FireStyle as PlatformFireStyle } from '@wildshard/game/systems/looks/fireFx';

/** RGB, linear. */
export type FireRgb = PlatformFireRgb;
/** One fire's scale: the flame's height, the glow's radius, the smoke column's height, the ember count, `wisp` for a thin pale column. */
export type FireSize = PlatformFireSize;
/** A billboard column's drift: lean downwind, widening with height, wander. */
export type FireDrift = PlatformFireDrift;
/** A smoke column's drift, colours, fade and opacity. */
export type FireSmoke = PlatformFireSmoke;
/** One look of fire as data: the breeze, an optional flipbook, the flame, smoke, glow, embers and ground pool. */
export type FireStyle = PlatformFireStyle;
/** A built fire look: adds fires and lamp halos, firelight slots, the shared clock and resources. */
export type FireFx = PlatformFireFx;
/** Builds one look of fire's shared GPU effect from its rows (SHARD-PLATFORM SF72, effect rows); each fire adds ~4 draws. */
export const createFireFx: typeof platformCreateFireFx = platformCreateFireFx;
