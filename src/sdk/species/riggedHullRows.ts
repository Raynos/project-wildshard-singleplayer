import type { HullCoatRow as PlatformHullCoatRow, HullFlapRow as PlatformHullFlapRow, HullFurRow as PlatformHullFurRow, HullPalette as PlatformHullPalette, HullRgb as PlatformHullRgb, RiggedHullsRow as PlatformRiggedHullsRow } from '@wildshard/game/systems/looks/riggedHullRows';

/** sRGB 0..1. */
export type HullRgb = PlatformHullRgb;
/** The species palettes a hull's coat recolours from. */
export type HullPalette = PlatformHullPalette;
/** One hull's coat recipe. */
export type HullCoatRow = PlatformHullCoatRow;
/** One hull's generator flap, pressed onto its body at load. */
export type HullFlapRow = PlatformHullFlapRow;
/** A fur sheen and backlit rim a coat wears. */
export type HullFurRow = PlatformHullFurRow;
/** A shard's rigged-hull family, as data (SHARD-PLATFORM M3). */
export type RiggedHullsRow = PlatformRiggedHullsRow;
