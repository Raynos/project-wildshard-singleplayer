import type { CardGroupRow, CardRow } from '@wildshard/sdk/looks/cardField';
import type { EffectFieldRow } from '@wildshard/sdk/looks/effectField';

/**
 * Signal Dunes' fires as rows (review R5 / TOP-15 #8, style bible FX) on the platform's fire effect
 * (`@wildshard/game/systems/looks/fireFx`): each fire's size, and the one look every fire shares, tuned against the mockups.
 */

/** A waymark's roaring log fire (mockup C: about one and a half bowls tall; round 9: taller, more embers). */
export const WAYMARK_FIRE = { flame: 3.4, glow: 1.7, smoke: 11, embers: 260 } as const;
/** A smouldering cookfire beside the caravan: no flame to speak of, a thin pale wisp that curls, widens and fades (mockup B, round 10). */
export const COOKFIRE = { flame: 0.35, glow: 0.6, smoke: 14, embers: 12, wisp: true } as const;
/** The keeper's lamp in the tower's top (mockup dusk-fire): a small open flame in its cage (round 12: readable at 145 m). */
export const KEEPER_LAMP = { flame: 2.6, glow: 1.2, smoke: 0.01, embers: 4 } as const;
/** The signal fire on the tower's deck. */
export const SIGNAL_FIRE = { flame: 3.6, glow: 5, smoke: 48, embers: 160 } as const;

/** The look every Signal fire shares (linear RGB). */
export const FIRE_STYLE = {
  // round 18b (mockup C's thin plume drifts LEFT with the sparks): a light dusk breeze from the south-east, not the dune-forming wind
  breeze: [-0.5, -0.866],
  // E407 row 6 ('real fire'): a Blender gas sim's burning log pile, 32 frames emission-only, 8 x 4 cells (art/sunscar-dunes/round-26-fire)
  book: { url: '/assets/sunscar-dunes/fx/fire-book.webp', columns: 8, rows: 4, fps: 16, name: 'sunscar.fire.book' },
  // mockup C: saturated orange tongues, white only in the core (round 21: the core gated by its place, not its brightness)
  bookGrade: { power: [1, 1.35, 1.9], tint: [1.2, 0.95, 0.75], core: 5 },
  // rounds 8-12 (mockup C: a ragged log fire): the flame billboards lean little on the breeze
  flame: { drift: { lean: 0.06, widen: 0, sway: 0.15 } },
  // rounds 8-21 (mockup C: a grey-brown billow lit warm at its foot, dark against the night above; round 21: wider, leaning downwind)
  plume: { drift: { lean: 0.36, widen: 2.6, sway: 0.15 }, foot: [0.3, 0.14, 0.06], top: [0.024, 0.02, 0.022], fade: 0.18, alpha: 0.9 },
  // mockup B / round 21: the cookfire's pale wisp barely leans on the breeze, it curls
  wisp: { drift: { lean: 0.025, widen: 6, sway: 2.4 }, foot: [0.16, 0.11, 0.1], top: [0.09, 0.08, 0.12], fade: 0.5, alpha: 0.55 },
  // loop 5 / round 8: a halo, not a wash, dimmer and redder; round 9 / 11: a lamp's own brighter, depth-tested halo
  glow: { colour: [1, 0.32, 0.06], gain: 0.14, lampGain: 0.42 },
  // round 8 / 9 (mockup C: short orange-red streaks)
  embers: { hot: [1, 0.42, 0.06], cool: [0.8, 0.1, 0], gain: 1.5 },
  // loop 5 / E399 (mockup C): the fire floods the sand round it orange, hot near the brazier (round 8: redder; round 10: dimmer)
  pool: { colour: [1, 0.3, 0.04], wide: 0.1, hot: 0.24 },
} as const;

/** One fire's scale (metres): the flame's height, the glow's radius, the smoke column's height, the ember count. */
export interface FireSize { readonly flame: number; readonly glow: number; readonly smoke: number; readonly embers: number; /** a thin pale wisp (a cookfire), not the dark plume */ readonly wisp?: boolean }

/** The admitted look ids of the seven fire programs (data/fireLook.ts), each a `look.materials` graph. */
export const FIRE_GRAPH_IDS = { flame: 'fire-flame', smoke: 'fire-smoke', wisp: 'fire-wisp', glow: 'fire-glow', lampGlow: 'fire-lamp-glow', embers: 'fire-embers', pool: 'fire-pool' } as const;
/** The fire's card programs (the camera-facing quads on the SDK's card host). */
export type FireCard = 'flame' | 'smoke' | 'wisp' | 'glow' | 'lampGlow';
/** A warm pool on the ground: its radius (m) and its grid's quads a side. */
export interface FirePool { readonly r: number; readonly n: number }

/**
 * A fire's parts as rows (world/fireFx.ts builds them): the flame cards (the main and inner tongues, two narrower side
 * tongues offset and phase-shifted by their place, the glow round them), the ember field (scaled and lifted in the fire's
 * frame), the smoke card (the dark plume, or a cookfire's curling wisp on its 16-row quad) and the warm pool.
 */
export function fireRows(size: FireSize): { readonly fire: CardGroupRow<FireCard>; readonly smoke: CardGroupRow<FireCard>; readonly embers: EffectFieldRow & { readonly scale: number; readonly y: number }; readonly pool: FirePool } {
  const fh = size.flame, wisp = size.wisp === true;
  const tongue = (sx: number, sy: number, at: readonly [number, number, number]): CardRow<FireCard> => ({ program: 'flame', quad: 'flame', scale: [fh * sx, fh * sy, 1], at });
  return {
    fire: { name: 'fire', order: 0, cards: [tongue(0.56, 1, [0, -0.1, 0]), tongue(0.34, 0.8, [0.05, -0.05, 0.05]), tongue(0.26, 0.62, [-fh * 0.11, -0.08, -0.07]), tongue(0.26, 0.72, [fh * 0.11, -0.08, 0.07]),
      { program: 'glow', quad: 'glow', scale: size.glow, at: [0, fh * 0.4, 0], order: 2 }] },
    smoke: { name: 'smoke', order: 1, cards: [{ program: wisp ? 'wisp' : 'smoke', quad: wisp ? 'wisp' : 'flame', scale: [size.smoke * (wisp ? 0.03 : 0.2), size.smoke, 1], at: [0, fh * 0.7, 0] }] },
    embers: { name: 'fire.embers', shape: 'point', count: size.embers, scale: fh * 0.9, y: fh * 0.3 },
    pool: { r: Math.max(size.glow * 2.3, size.flame * 2.4), n: 16 },
  };
}

/** A lamp's halo card `glow` wide (no light, no flame) and its pool. */
export function lampRows(glow: number): { readonly halo: CardGroupRow<FireCard>; readonly pool: FirePool } {
  return { halo: { name: 'lamp', order: 2, cards: [{ program: 'lampGlow', quad: 'glow', scale: glow }] }, pool: { r: glow * 1.6, n: 10 } };
}
