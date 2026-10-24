import type { StrikeData } from '@wildshard/sdk/species';
/** Authored JSON row types; no runtime declarations. */
declare const rows: Record<"snap" | "bite" | "coconut" | "sailor" | "swing" | "second" | "burst", StrikeData>;
// oxlint-disable-next-line import/no-default-export -- JSON modules expose a default payload; this is a type-only declaration.
export default rows;
