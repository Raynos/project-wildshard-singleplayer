import { cloneFacetedDayPreset as platformCloneFacetedDayPreset, facetedDay as platformFacetedDay, facetedDayPreset as platformFacetedDayPreset, lerpFacetedDayPreset as platformLerpFacetedDayPreset, type DayColour as PlatformDayColour, type FacetedDay as PlatformFacetedDay, type FacetedDayPreset as PlatformFacetedDayPreset, type FacetedDayPresetRow as PlatformFacetedDayPresetRow, type FacetedDayStyle as PlatformFacetedDayStyle } from '@wildshard/game/systems/looks/facetedDay';

/** A colour as data: an sRGB hex number or linear RGB. */
export type DayColour = PlatformDayColour;
/** One keyed light preset, as data. */
export type FacetedDayPresetRow = PlatformFacetedDayPresetRow;
/** A faceted day's row (SHARD-PLATFORM M3, look-family rows): clock, presets, keyframes, arcs and curves. */
export type FacetedDayStyle = PlatformFacetedDayStyle;
/** One live preset (the row's colours as three.js colours). */
export type FacetedDayPreset = PlatformFacetedDayPreset;
/** A faceted day's clock: the engine spec, the bodies' paths and the curves. */
export type FacetedDay = PlatformFacetedDay;
/** The clock a faceted day's row declares (renderer-free). */
export const facetedDay: typeof platformFacetedDay = platformFacetedDay;
/** A row's live preset. */
export const facetedDayPreset: typeof platformFacetedDayPreset = platformFacetedDayPreset;
/** A preset's copy. */
export const cloneFacetedDayPreset: typeof platformCloneFacetedDayPreset = platformCloneFacetedDayPreset;
/** `out` = a -> b at t. */
export const lerpFacetedDayPreset: typeof platformLerpFacetedDayPreset = platformLerpFacetedDayPreset;
