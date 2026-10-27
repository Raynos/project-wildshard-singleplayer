import type { PineSources } from './pineSources';
/** Pine's sources for the script named `label`, read and baked as the program reads them (src/shards/pine-hollow/generators/scriptSources.mjs). */
export function pineScriptSources(label: string): Promise<PineSources>;
