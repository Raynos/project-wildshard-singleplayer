import type { BodyRows } from '../src/shards/nalati-grasslands/species/bodyKey';
/** The bodies bake (scripts/bake-nalati-bodies.mjs): its rows and the raw (uncompressed, unshuffled) binary. */
export function bakeBodyRows(): { rows: BodyRows; bin: Uint8Array };
/** The binary in four byte lanes, as the bake ships it. */
export function shuffleBodyLanes(bin: Uint8Array): Uint8Array;
