import { parsePopulationShelter } from '@wildshard/format/herdShelter';
import { HerdShelter as PlatformShelter, installNativeHerdShelter as platformInstallNative } from '@wildshard/game/population/shelter';

export const HerdShelter: typeof PlatformShelter = PlatformShelter;

/** Bind the native shelter to its actual herd/weather owners from admitted rows. */
export const installNativeHerdShelter: typeof platformInstallNative = platformInstallNative;

/** Read native shelter rows and the page look from the admitted product. */
export const populationShelter: typeof parsePopulationShelter = parsePopulationShelter;
