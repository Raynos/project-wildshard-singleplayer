import type { EffectFieldRow } from '@wildshard/sdk/looks/effectField';
import { UPDRAFT } from './layout';

/**
 * Sky Reach's visible wind (style bible §7, loop 3; drawn on @wildshard/sdk/looks/effectField): the fan's GUST, a cone of
 * 30 streaks with 14 tumbling petals (0.6 s life), and the updraft's column, a soft spiral of 24 streaks with 14 rising
 * leaves up the ramp. How each moves and paints is its graph in data/lookGraphs.json (`wind-*`).
 */

/** The updraft column's axis (the ramp's line 2.2 m up): its foot and its aim (foot to top), where its fields stand. */
export const UPDRAFT_AXIS = { at: [UPDRAFT.x0, UPDRAFT.y + 2.2, UPDRAFT.z0], aim: [UPDRAFT.x1 - UPDRAFT.x0, UPDRAFT.y1 - UPDRAFT.y, UPDRAFT.z1 - UPDRAFT.z0] } as const;

/**
 * The wind's seeded effect fields: the GUST's streaks and petals are bursts (hidden between them; a little longer than
 * their life, for the copies' start delays), the updraft's streaks and leaves loop.
 */
export const WIND_FIELDS = {
  gustStreaks: { name: 'far.gust.streaks', shape: 'streak', count: 30, life: 0.7 },
  gustPetals: { name: 'far.gust.petals', shape: 'flake', count: 14, palette: [0xffd4dc, 0xfff1e0, 0xffc6a8, 0xf5b8d0], life: 0.88 },
  updraftStreaks: { name: 'far.updraft.streaks', shape: 'streak', count: 24 },
  updraftLeaves: { name: 'far.updraft.leaves', shape: 'flake', count: 14, palette: [0xb9c868, 0xd9c060, 0x93b552, 0xf0d488] },
} as const satisfies Record<string, EffectFieldRow>;

/** each WIND_FIELDS row's look id */
export const WIND_LOOKS = { gustStreaks: 'wind-gust-streak', gustPetals: 'wind-gust-petal', updraftStreaks: 'wind-updraft-streak', updraftLeaves: 'wind-updraft-leaf' } as const satisfies Record<keyof typeof WIND_FIELDS, string>;
