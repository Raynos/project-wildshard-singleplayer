import * as v from 'valibot';
import { FigureCatalogueSchema } from '@wildshard/format/figures';
import castaway from '../data/castawayFigure.json' with { type: 'json' };
import trader from '../data/traderFigure.json' with { type: 'json' };
import scenes from '../data/npcScenes.generated.json' with { type: 'json' };
import { CASTAWAY_POSE, TRADER_POSE } from './npcPose';
import { TRADER_FACING } from './npcFocus';

const breathe = (rate: number, offset: number) => ({ bone: 'body', channel: 'scale', cases: [{ sum: [1, { of: [{ wave: 't', rate, offset }, 0.006] }] }] });
/** Wendell turns on his figure pivot, breathes, waves on the quest's signal (the clip memory `gesture`) and his fire flickers. */
const CASTAWAY_KIT = { scene: scenes.castaway, material: 'still', neck: 1.52, hide: false,
  pose: [{ bone: 'figure', channel: 'rotation.y', cases: [{ sum: [{ of: [{ mem: 'turn' }] }] }] }, breathe(1.6, 0),
    ...CASTAWAY_POSE,
    { bone: 'flames', channel: 'scale', cases: [{ sum: [1, { of: [{ wave: 't', rate: 13 }, 0.1] }, { of: [{ wave: 't', rate: 31, offset: 2 }, 0.06] }] }] }],
  gestures: [{ id: 'wave', code: 1, seconds: 2.2, eased: false, starts: [{ kind: 'signal' }], turns: true }] };
/** The trader beckons you over, tidies her goods when you are away and offers them at the counter (or on the shop's signal). */
const TRADER_KIT = { scene: scenes.trader, material: 'default', neck: 1.48, hide: true,
  pose: [breathe(1.5, 0.7), ...TRADER_POSE],
  gestures: [{ id: 'beckon', code: 1, seconds: 2.4, eased: true, starts: [{ kind: 'approach', inside: 11, beyond: TRADER_FACING.range * 0.6, rearm: 18 }], turns: true },
    { id: 'tidy', code: 2, seconds: 2.6, eased: true, starts: [{ kind: 'every', base: 8, span: 2, frequency: 0.83, first: 6, from: 11, to: 1e6 }], turns: false, look: { yaw: -0.25, pitch: 0.45 } },
    { id: 'offer', code: 3, seconds: 1.8, eased: true, starts: [{ kind: 'signal' }, { kind: 'every', base: 5, span: 1.5, frequency: 1.31, first: 3, from: 0, to: TRADER_FACING.range }], turns: true,
      offer: { yaw: -0.35, pitch: 0.3, within: 11 } }] };

/** The same figure-row admission as skinned people, over the existing pivot kit, with each figure's kit rows. */
export const FIGURE_CATALOGUE = v.parse(FigureCatalogueSchema, { figures: {
  castaway: { phone: castaway, desktop: castaway, kit: CASTAWAY_KIT }, trader: { phone: trader, desktop: trader, kit: TRADER_KIT },
} });
