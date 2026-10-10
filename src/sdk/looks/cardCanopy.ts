import {
  buildCardCanopy as platformBuildCardCanopy, coveragePass as platformCoveragePass, loadLeafAtlas as platformLoadLeafAtlas, plateauPass as platformPlateauPass,
  type CanopyGeometry as PlatformCanopyGeometry, type CardCanopyRow as PlatformCardCanopyRow,
} from '@wildshard/game/systems/looks/cardCanopy';

/** A crown's baked geometry: the painted cards and the darker core. */
export type CanopyGeometry = PlatformCanopyGeometry;
/** A card canopy as data: the shader family's programs for its three draws, its uniforms, its atlas. */
export type CardCanopyRow<P extends string> = PlatformCardCanopyRow<P>;
/** A tree crown of painted leaf cards (coverage + plateau passes) over a darker core (SHARD-PLATFORM M3). */
export const buildCardCanopy: typeof platformBuildCardCanopy = platformBuildCardCanopy;
/** Alpha to coverage, colour written, target alpha kept. */
export const coveragePass: typeof platformCoveragePass = platformCoveragePass;
/** Depth-equal, alpha only. */
export const plateauPass: typeof platformPlateauPass = platformPlateauPass;
/** A painted leaf atlas, mipmapped and anisotropic. */
export const loadLeafAtlas: typeof platformLoadLeafAtlas = platformLoadLeafAtlas;
