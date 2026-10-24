/** Authored JSON row types; no runtime declarations. */
declare const rows: { "DRY_ENTRIES": ["north", "east", "south", "west"]; "LANDING_RUN": number; "LANDING_HALF": number; "DECK_SLAB": number };
// oxlint-disable-next-line import/no-default-export -- JSON modules expose a default payload; this is a type-only declaration.
export default rows;
