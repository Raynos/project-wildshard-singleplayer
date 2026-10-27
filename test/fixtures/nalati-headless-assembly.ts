import { nalatiHeadlessAssembly, type NalatiHeadlessAssembly } from '../../src/shards/nalati-grasslands/generators/nativeGroups';
import { NALATI_PASTURE } from './nalati-titan';

/** GR6: Nalati's headless assembly around the build's compiled pasture programme (the product builds the same). */
export const NALATI_HEADLESS_ASSEMBLY: NalatiHeadlessAssembly = nalatiHeadlessAssembly(NALATI_PASTURE);
