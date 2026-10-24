import type { PierParams } from './pierContract';
/** Authored JSON row types; no runtime declarations. */
declare const rows: { PENNANT_WIND: readonly [number, number]; PIER_DEFAULTS: PierParams; PIER_VARIANTS: { id: string; label: string; params: Partial<PierParams> }[] };
// oxlint-disable-next-line import/no-default-export -- JSON modules expose a default payload; this is a type-only declaration.
export default rows;
