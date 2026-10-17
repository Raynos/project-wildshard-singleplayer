import { parsePopulationShelter } from '@wildshard/format/herdShelter';
import { HerdShelter as PlatformShelter, installNativeHerdShelter as platformInstallNative } from '@wildshard/game/population/shelter';

/** The platform's wet/dry herd owner; no tree, weather, stream or actor service is installed on import. */
export type HerdShelterInstance<T extends { x: number; z: number; r: number; height: number; cover: number }> = PlatformShelter<T>;
export const HerdShelter: typeof PlatformShelter = PlatformShelter;

/** Bind the native shelter to its actual herd/weather owners from admitted rows. */
export const installNativeHerdShelter: typeof platformInstallNative = platformInstallNative;

/** Read native shelter rows and the page look from the admitted product. */
export const populationShelter: typeof parsePopulationShelter = parsePopulationShelter;
