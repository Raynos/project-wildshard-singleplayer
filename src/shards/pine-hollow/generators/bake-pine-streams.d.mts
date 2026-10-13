import type { PineStreamGround } from './streams';

/** The streams bake (src/shards/pine-hollow/generators/bake-pine-streams.mjs): its rows and the raw (uninflated, unshuffled) binary. */
export function bakeStreamRows(): { rows: { bin: string; bytes: number; vertices: number; indices: number; wide: boolean; plunge: [number, number, number]; faceFoot: [number, number, number] }; bin: Uint8Array };

/** The retained original renderer queries, read explicitly without installing a page field. */
export function pineStreamGround(): PineStreamGround;
