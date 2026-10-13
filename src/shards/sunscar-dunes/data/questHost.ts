import { SIGNAL_GRAPH } from './signalGraph';
import { SIGNAL_INTERACTIONS } from './signalInteractions';
import { SCOUT_ROW } from './questPresentation';
import signalStages from './signalStages.json' with { type: 'json' };
import { FLAG } from './flags';

/** The accepted fire edge retains its original quiet loaded seed and individual saved cursor. */
export const QUEST_HOST = {
  version: 1, graph: SIGNAL_GRAPH, interactions: SIGNAL_INTERACTIONS, npcs: [SCOUT_ROW], drive: 'commands',
  actors: { ids: [], error: 'Missing Signal quest body' }, observations: [],
  stages: [{ row: signalStages, initial: [{ lit: false }],
    seed: { flag: FLAG.lit, initial: [{ lit: false }, { lit: true }] }, tick: false,
    continuation: { step: 'sunscar.signal-fire', error: 'Invalid Signal fire continuation' } }],
  summons: [{ target: 'sunscar.matriarch', director: signalStages.id }],
  commands: { step: null, inputs: {}, routes: [] },
};
