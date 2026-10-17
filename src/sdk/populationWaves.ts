import { parsePopulationWaves } from '@wildshard/format/populationWaves';
import { installNativePopulationWaves as platformInstallNative } from '@wildshard/game/population/nativeWaves';
import { PopulationWaveDirector as PlatformDirector, preparePopulationModule as platformPrepare,
  type PopulationActor as PlatformActor } from '@wildshard/game/population/waves';

/** The platform wave director on caller-owned actor bodies; the SDK owns no second scheduler or continuation. */
export type PopulationWaveDirectorInstance<T extends PlatformActor> = PlatformDirector<T>;
export const PopulationWaveDirector: typeof PlatformDirector = PlatformDirector;
/** Admit the declared script once and return independent population lanes. */
export const preparePopulationModule: typeof platformPrepare = platformPrepare;

/** Page presentation consumes effects; native population uses the admitted roster owners. */
export const installNativePopulationWaves: typeof platformInstallNative = platformInstallNative;

/** Read the shared admitted wave data without installing gameplay. */
export const populationWaves: typeof parsePopulationWaves = parsePopulationWaves;
