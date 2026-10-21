import * as v from 'valibot';
import { QuestTraderSchema } from '@wildshard/format/namedJsonContracts';
import stall from '../data/traderStall.json' with { type: 'json' };
import { GOODS } from './economy';

/** The original coin counter keeps its exact purchase words and cue order. */
export const TRADER_STALL = v.parse(QuestTraderSchema, { ...stall, shop: {
  place: 'Driftwood Isle', barter: false, modal: { restartOnClose: true, stow: true, resumeSwimming: true },
  after: Object.fromEntries(GOODS.map(good => [good.id, [
    { kind: 'chime', at: 'counter', gain: .8 }, { kind: 'offer' },
    { kind: 'toast', text: `Bought · ${good.name} — ${good.id === 'cape' ? 'wear it from GEAR' : good.does.toLowerCase()}` },
  ]])),
} });
