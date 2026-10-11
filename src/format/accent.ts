/**
 * A shard's HUD accent (SHARD-PLATFORM SF28 / G87 / G104; `art/hud/round-20-accent-palette/README.md`): one of the
 * platform's 20 accents, declared as data per shard. The road and the safe zone wear the reserved 21st, the HUD's own
 * cyan `#8fe3ff`, which no shard may declare (nor anything in the cyan band, OKLCH hue ≈ 195–235°, which the palette
 * leaves empty). Inside a grid cell the HUD swaps to that shard's accent; on the road it is the cyan again.
 *
 * The shardfile and author manifest use this defining `AccentSchema` and `parseAccent`. Game maps the admitted
 * palette hex into HUD variables without redefining the palette or its admission rules.
 */
import * as v from 'valibot';

/** The 20 accents in palette order (01 EMBER … 20 SAND), sRGB hex. */
export const ACCENTS = {
  ember: '#fe8169', coral: '#fe9b98', tangerine: '#ff9550', apricot: '#f8bd84', marigold: '#fbbb2d',
  citron: '#efe345', lime: '#ade74e', moss: '#89c06a', jade: '#59e1a2', mint: '#99f0ca',
  teal: '#54cec2', azure: '#5ca3fd', cornflower: '#a5acfe', periwinkle: '#ccccf8', iris: '#bc8bfe',
  lilac: '#dda9f7', orchid: '#e989e1', pink: '#f9add0', rose: '#fc7b9d', sand: '#beaf91',
} as const;
/** A palette id (`marigold`, `moss` …). */
export type AccentId = keyof typeof ACCENTS;
/** The admitted palette IDs, in the same fixed order as the palette. */
export const ACCENT_IDS = Object.keys(ACCENTS) as readonly AccentId[];
/** The reserved 21st: the road, the safe zone and every menu (no shard may declare it). */
export const ROAD_ACCENT = '#8fe3ff';
const RESERVED = new Set(['cyan', 'road', 'hud-cyan', ROAD_ACCENT]);

const isAccentId = (value: string): value is AccentId => Object.hasOwn(ACCENTS, value);

/** The shardfile field: a palette id; the road's cyan is refused by name or hex. */
export const AccentSchema = v.pipe(v.string(), v.check((value) => !RESERVED.has(value.toLowerCase()), 'The HUD cyan is reserved for the road and the safe zone; pick one of the 20 accents'),
  v.custom<AccentId>((value) => typeof value === 'string' && isAccentId(value), 'Not one of the 20 HUD accents (art/hud/round-20-accent-palette/README.md)'));

/** Validate a declared accent (throws with the schema's message), returning its id. */
export function parseAccent(value: unknown): AccentId {
  return v.parse(AccentSchema, value);
}

