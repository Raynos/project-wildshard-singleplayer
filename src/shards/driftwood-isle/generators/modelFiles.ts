import inventory from '../data/fixedGeometry.json' with { type: 'json' };

/** One authored inventory supplies build assets and inert client geometry declarations. */
export const FIXED_MODEL_FILES: Record<string, string> = Object.fromEntries(inventory.draws.map(row => [row.slot, row.source]));
export const FIXED_DRAW_ROWS: { slot: string; channels: string[][]; }[] = inventory.draws.map(({ slot, channels }) => ({ slot, channels }));
