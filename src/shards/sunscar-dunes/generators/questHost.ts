import { SIGNAL_QUEST_PAGE_INTERACTIONS } from './questPageInteractions';
import { SIGNAL_GRAPH } from './signalGraph';
import { SIGNAL_INTERACTIONS } from './signalInteractions';
import { SCOUT_ROW } from './questPresentation';
import signalStages from '../data/signalStages.json' with { type: 'json' };
import { FLAG } from './rows/flags';

/** The accepted fire edge retains its original quiet loaded seed and individual saved cursor. */
export const QUEST_HOST: { version: number; page: typeof SIGNAL_QUEST_PAGE_INTERACTIONS; graph: typeof SIGNAL_GRAPH; interactions: typeof SIGNAL_INTERACTIONS; npcs: (typeof SCOUT_ROW)[]; drive: string; actors: { ids: never[]; error: string }; observations: never[]; stages: { row: typeof signalStages; initial: { lit: boolean }[]; seed: { flag: typeof FLAG.lit; initial: { lit: boolean }[] }; tick: boolean; continuation: { step: string; error: string } }[]; summons: { target: string; director: string }[]; commands: { step: null; inputs: NonNullable<unknown>; routes: never[] } } = {
  version: 1, page: SIGNAL_QUEST_PAGE_INTERACTIONS, graph: SIGNAL_GRAPH, interactions: SIGNAL_INTERACTIONS, npcs: [SCOUT_ROW], drive: 'commands',
  actors: { ids: [], error: 'Missing Signal quest body' }, observations: [],
  stages: [{ row: signalStages, initial: [{ lit: false }],
    seed: { flag: FLAG.lit, initial: [{ lit: false }, { lit: true }] }, tick: false,
    continuation: { step: 'sunscar.signal-fire', error: 'Invalid Signal fire continuation' } }],
  summons: [{ target: 'sunscar.matriarch', director: signalStages.id }],
  commands: { step: null, inputs: {}, routes: [] },
};
