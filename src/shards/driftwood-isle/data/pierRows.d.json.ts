import type { PierParams } from '../assets/contracts/pier';
/** Authored JSON row types; no runtime declarations. */
declare const rows: { PENNANT_WIND: readonly [number, number]; PIER_DEFAULTS: PierParams; PIER_VARIANTS: { id: string; label: string; params: Partial<PierParams> }[] };
export = rows;
