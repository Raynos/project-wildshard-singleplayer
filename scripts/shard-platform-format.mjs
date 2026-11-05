// Node census tools use the defining format contract without booting application services.
import '../src/sdk/bake/format-hook.mjs';

export const outputFormat=await import('@wildshard/format/outputIndex');
export const gridReadinessFormat=await import('@wildshard/format/gridReadiness');
export const discoveryFormat=await import('@wildshard/format/discoveryValues');
export const platformFileFamiliesFormat=await import('@wildshard/format/platformFileFamilies');
