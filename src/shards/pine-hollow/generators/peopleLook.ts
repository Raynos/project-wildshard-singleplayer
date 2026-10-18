/**
 * The people's numbers (@wildshard/game/systems/npc/figureRows): a 0.56 m square collider from 0.3 m under the feet to 1.8 m
 * over them, the talk prompt at 1.6 m, drawn inside 140 m and casting a shadow inside 45 m, turning to face you inside
 * 9 m; the stand-in walks at 0.72 m/s, 0.72 m a cycle; the lantern's flame a small over-bright sphere; the ranger points
 * toward the old-growth 5.5 – 8 s into every 9 s of talk; the stand-in breathes and sways as it talks. Encoded into the
 * product's people/catalogue.json; the shared figure host admits the same rows.
 */
import * as v from 'valibot';
import { NpcFigureRowsSchema } from '@wildshard/format/figures';

export const NPC_FIGURE = v.parse(NpcFigureRowsSchema, {
  collider: { half: 0.28, top: 1.8, bottom: 0.3 },
  talkHeight: 1.6,
  drawDistance: 140,
  shadowDistance: 45,
  noticeRadius: 9,
  walk: { speed: 0.72, cycle: 0.72 },
  flame: { radius: 0.035, widthSegments: 8, heightSegments: 6, color: [2.4, 1.35, 0.45] },
  point: { period: 9, from: 5.5, to: 8 },
  sway: { breathe: 0.006, breatheRate: 1.7, talk: 0.025, talkRate: 2.3 },
});
