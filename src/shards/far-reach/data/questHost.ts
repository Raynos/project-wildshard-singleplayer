import { SKY_QUEST_PAGE_INTERACTIONS } from './questPageInteractions';
import { SKY_ACTIONS, SKY_GRAPH } from './questGraph';
import { SKY_QUEST_STAGES, SKY_QUEST_STAGE_INITIAL } from './questStages';
import { ROOST_IDS, SKY_ACT, QUEST_STEP } from './questPrompts';
import { FLAGS } from '../quest/flags';

/** The keeper, roost, vanes and winch retain their original command and fixed-step order. */
export const QUEST_HOST = {
  version: 1, page: SKY_QUEST_PAGE_INTERACTIONS, graph: SKY_GRAPH, interactions: SKY_ACTIONS, npcs: [], drive: 'external',
  actors: { ids: ROOST_IDS, error: 'Sky Reach installs its quest after the roost rays' },
  observations: [
    { binding: 'event:quest.roost-down', kind: 'all-dead', actors: ROOST_IDS },
    { binding: 'event:quest.winch-up', kind: 'owner', owner: 'winch-up' },
  ],
  stages: [
    { row: SKY_QUEST_STAGES.roost, initial: SKY_QUEST_STAGE_INITIAL.roost, tick: true },
    { row: SKY_QUEST_STAGES.vanes, initial: SKY_QUEST_STAGE_INITIAL.vanes, tick: true },
    { row: SKY_QUEST_STAGES.raised, initial: SKY_QUEST_STAGE_INITIAL.raised, tick: true },
  ],
  summons: [], commands: { step: QUEST_STEP,
    inputs: { roost: `flag:${FLAGS.roost}`, vanes: `flag:${FLAGS.vanes}`, up: 'event:quest.winch-up' }, routes: [
      { value: SKY_ACT.talk, spot: 'keeper', when: 'true', action: { kind: 'row', id: 'talk' } },
      { value: SKY_ACT.notes, spot: 'notes', when: 'true', action: { kind: 'row', id: 'notes' } },
      { value: SKY_ACT.winch, spot: 'winch', when: '!up && roost && vanes', action: { kind: 'owner', id: 'winch' } },
    ] },
};
