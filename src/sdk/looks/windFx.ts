import { gustFx as platformGustFx, updraftFx as platformUpdraftFx, type GustFx as PlatformGustFx, type GustRow as PlatformGustRow, type UpdraftFx as PlatformUpdraftFx, type UpdraftRow as PlatformUpdraftRow } from '@wildshard/game/systems/looks/windFx';

/** A gust's rows: streak and petal counts, life, speed, spread, colours and mesh names (SHARD-PLATFORM M3). */
export type GustRow = PlatformGustRow;
/** An updraft's rows: streak and leaf counts, the helix, colours and mesh names. */
export type UpdraftRow = PlatformUpdraftRow;
/** A gust's meshes, disposal, burst and tick. */
export type GustFx = PlatformGustFx;
/** An updraft's meshes and tick. */
export type UpdraftFx = PlatformUpdraftFx;
/** Visible wind: a cone of instanced streaks with tumbling petals, fired from a point along a direction. */
export const gustFx: typeof platformGustFx = platformGustFx;
/** Visible wind: a spiral of instanced streaks with rising leaves round a column's axis. */
export const updraftFx: typeof platformUpdraftFx = platformUpdraftFx;
