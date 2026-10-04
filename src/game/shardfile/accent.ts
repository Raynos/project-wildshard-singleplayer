/**
 * A shard's HUD accent (SHARD-PLATFORM SF28 / G87 / G104; `art/hud/round-20-accent-palette/README.md`): one of the
 * platform's 20 accents, declared as data per shard. The road and the safe zone wear the reserved 21st, the HUD's own
 * cyan `#8fe3ff`, which no shard may declare (nor anything in the cyan band, OKLCH hue ≈ 195–235°, which the palette
 * leaves empty). Inside a grid cell the HUD swaps to that shard's accent; on the road it is the cyan again.
 *
 * The shardfile field is this module's schema (`AccentSchema`); sp-x5 wires it into the format (format-owner rule). Until
 * then each shard declares it in its manifest (`ShardManifest.accent`), validated by the same `parseAccent`.
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
export const ACCENT_IDS = Object.keys(ACCENTS) as readonly AccentId[];
/** The reserved 21st: the road, the safe zone and every menu (no shard may declare it). */
export const ROAD_ACCENT = '#8fe3ff';
const RESERVED = new Set(['cyan', 'road', 'hud-cyan', ROAD_ACCENT]);

const isAccentId = (value: string): value is AccentId => Object.hasOwn(ACCENTS, value);

/** The shardfile field: a palette id; the road's cyan is refused by name or hex. */
export const AccentSchema = v.pipe(v.string(), v.check((value) => !RESERVED.has(value.toLowerCase()), 'The HUD cyan is reserved for the road and the safe zone; pick one of the 20 accents'),
  v.check(isAccentId, 'Not one of the 20 HUD accents (art/hud/round-20-accent-palette/README.md)'));

/** Validate a declared accent (throws with the schema's message), returning its id. */
export function parseAccent(value: unknown): AccentId {
  const parsed = v.parse(AccentSchema, value);
  if (!isAccentId(parsed)) throw new Error('Not one of the 20 HUD accents');
  return parsed;
}

/** The HUD's accent variables for an accent hex (the `--ws-cyan` family in src/engine/ui/styles/base.css). */
export function accentVars(hex: string): Readonly<Record<'--ws-cyan' | '--ws-cyan-dim' | '--ws-cyan-line' | '--ws-cyan-faint', string>> {
  const n = Number.parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return { '--ws-cyan': hex, '--ws-cyan-dim': `rgba(${r}, ${g}, ${b}, 0.55)`, '--ws-cyan-line': `rgba(${r}, ${g}, ${b}, 0.35)`, '--ws-cyan-faint': `rgba(${r}, ${g}, ${b}, 0.14)` };
}
