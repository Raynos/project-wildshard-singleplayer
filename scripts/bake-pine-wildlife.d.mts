/** The wildlife bake (scripts/bake-pine-wildlife.mjs): its rows and the raw (uninflated, unshuffled) binary. */
export function bakeWildlifeRows(): { rows: { bin: string; bytes: number; kinds: { kind: 0 | 1 | 2 | 4; vertices: number; indices: number }[] }; bin: Uint8Array };
