import type { CabinSceneSources } from './cabinScenes';
import type { PineSources } from './pineSources';
/** Original cabin pack and glTF hierarchy, without a browser/image host. */
export function cabinSceneSources(tier: 'phone' | 'desktop', sources: PineSources): Promise<CabinSceneSources>;
