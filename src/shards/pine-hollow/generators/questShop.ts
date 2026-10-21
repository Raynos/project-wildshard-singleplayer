import * as v from 'valibot';
import { QuestTraderSchema } from '@wildshard/format/namedJsonContracts';
import stall from '../data/traderStall.json' with { type: 'json' };
import { TRADES } from './trades';

/** The original barter grants precede wear, the trader's bark, chime and toast. */
export const TRADER_STALL = v.parse(QuestTraderSchema, { ...stall, shop: {
  place: 'Pine Hollow', barter: true, ammunition: { loadout: 'pine.loadout', bolts: 'iron' },
  after: Object.fromEntries(TRADES.map(trade => [trade.id, [
    ...('skin' in trade.get ? [{ kind: 'wear', finish: trade.get.skin }] : []),
    { kind: 'bark', audio: 'ambience', group: 'trader', figure: 'trader' }, { kind: 'chime', at: 'none', gain: 1 },
    { kind: 'toast', text: `Traded · ${trade.label}` },
  ]])),
} });
