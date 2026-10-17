import FLAGS from '../data/flags.json' with { type: 'json' };
import STRINGS from '../data/strings.json' with { type: 'json' };

/** Ordered shipping branches: completed bridge, notes already read, then the first conversation. */
export const KEEPER_NPC = {
  id: 'far.keeper', name: STRINGS.keeperName,
  dialogue: [
    { when: { all: [FLAGS.raised] }, lines: [STRINGS.keeperDone] },
    { when: { all: [FLAGS.notes] }, lines: [STRINGS.keeperLater] },
    { lines: [STRINGS.keeperHello, STRINGS.keeperAsk, STRINGS.keeperHow], sets: [FLAGS.notes] },
  ],
};
