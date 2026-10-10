import { duskLook as platformDuskLook, loadDuskSandMaps as platformLoadDuskSandMaps, type DuskLookParts as PlatformDuskLookParts, type DuskLookRow as PlatformDuskLookRow, type DuskSandMaps as PlatformDuskSandMaps, type DuskTintRow as PlatformDuskTintRow } from '@wildshard/game/systems/looks/duskLook';

/** One dusk look as data: fog, key light, held clock, dusk curves, sand tint, skirt, dome, sand / sky family rows and painted stages. */
export type DuskLookRow = PlatformDuskLookRow;
/** A dusk look's sand tint by height against a ring mean. */
export type DuskTintRow = PlatformDuskTintRow;
/** What a dusk look reads live: the dusk and fire uniforms, the wind, the analytic field, the sand maps, the tiles and the skirt. */
export type DuskLookParts = PlatformDuskLookParts;
/** The sand's three baked maps a dusk look draws with. */
export type DuskSandMaps = PlatformDuskSandMaps;
/** A dusk look's baked sand maps, the grain tile carrying its own means. */
export const loadDuskSandMaps: typeof platformLoadDuskSandMaps = platformLoadDuskSandMaps;
/** A dusk look (`extend`) from its row and live parts. */
export const duskLook: typeof platformDuskLook = platformDuskLook;
