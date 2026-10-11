import { parseNpcDialogueRow } from '@wildshard/sdk/questGraph';
import { FLAGS } from '../quest/flags';
import { STRINGS } from './strings';

/** Ordered shipping branches: completed bridge, notes already read, then the first conversation. */
export const KEEPER_NPC = parseNpcDialogueRow({
  id: 'far.keeper', name: STRINGS.keeperName,
  dialogue: [
    { when: { all: [FLAGS.raised] }, lines: [STRINGS.keeperDone] },
    { when: { all: [FLAGS.notes] }, lines: [STRINGS.keeperLater] },
    { lines: [STRINGS.keeperHello, STRINGS.keeperAsk, STRINGS.keeperHow], sets: [FLAGS.notes] },
  ],
});
