import { duskDomeFragment as platformDuskDomeFragment, duskDomeMaterial as platformDuskDomeMaterial, duskDomeSun as platformDuskDomeSun, DUSK_DOME_VERTEX as PLATFORM_DUSK_DOME_VERTEX, type DomeRgb as PlatformDomeRgb, type DomeStage as PlatformDomeStage, type DuskDomeStyle as PlatformDuskDomeStyle } from '@wildshard/game/systems/looks/duskDome';

/** RGB in the dome's authored space. */
export type DomeRgb = PlatformDomeRgb;
/** A colour at the dusk's start and at its end. */
export type DomeStage = PlatformDomeStage;
/** One procedural dusk dome as data (SHARD-PLATFORM SF72, look-family rows). */
export type DuskDomeStyle = PlatformDuskDomeStyle;
/** The dome's vertex shader. */
export const DUSK_DOME_VERTEX: string = PLATFORM_DUSK_DOME_VERTEX;
/** The dome's fragment shader for one style. */
export const duskDomeFragment: typeof platformDuskDomeFragment = platformDuskDomeFragment;
/** The set sun's direction for a style, normalized. */
export const duskDomeSun: typeof platformDuskDomeSun = platformDuskDomeSun;
/** The dome's material for one style over the shard's dusk uniform. */
export const duskDomeMaterial: typeof platformDuskDomeMaterial = platformDuskDomeMaterial;
