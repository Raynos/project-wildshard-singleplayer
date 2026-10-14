import { FLAGS } from '../quests/flags';
import { VANES } from './layout';

/** Independent stage rows preserve the original same-tick roost, vane and raised effects.
 * Both stages dispatch the same guarded edge, so resetting/restoring flags needs no extra cursor. */
export const SKY_QUEST_STAGES = {
  roost: { version: 2, script: null, id: 'far.quest.roost', inputs: { notes: `flag:${FLAGS.notes}`, done: `flag:${FLAGS.roost}`, dead: 'event:quest.roost-down' },
    stages: [
      { id: 'waiting', do: [], next: [{ target: 'set', when: 'notes && !done && dead' }] },
      { id: 'set', do: [{ flag: { key: FLAGS.roost, value: true } }], next: [
        { target: 'set', when: 'notes && !done && dead' }, { target: 'waiting', when: '!(notes && !done && dead)' }] },
    ] },
  vanes: { version: 2, script: null, id: 'far.quest.vanes', inputs: { done: `flag:${FLAGS.vanes}`,
    ...Object.fromEntries(VANES.map((vane, index) => [`vane${index}`, `flag:${vane.flag}`])) },
    stages: [
      { id: 'waiting', do: [], next: [{ target: 'set', when: '!done && vane0 && vane1 && vane2' }] },
      { id: 'set', do: [{ flag: { key: FLAGS.vanes, value: true } }], next: [
        { target: 'set', when: '!done && vane0 && vane1 && vane2' }, { target: 'waiting', when: '!(!done && vane0 && vane1 && vane2)' }] },
    ] },
  raised: { version: 2, script: null, id: 'far.quest.raised', inputs: { done: `flag:${FLAGS.raised}`, up: 'event:quest.winch-up' },
    stages: [
      { id: 'waiting', do: [], next: [{ target: 'set', when: '!done && up' }] },
      { id: 'set', do: [{ flag: { key: FLAGS.raised, value: true } }], next: [
        { target: 'set', when: '!done && up' }, { target: 'waiting', when: '!(!done && up)' }] },
    ] },
};
/** Quiet initial observations enter only waiting stages; native flags remain the sole continuation owner. */
export const SKY_QUEST_STAGE_INITIAL = {
  roost: [{ notes: false, done: false, dead: false }],
  vanes: [{ done: false, vane0: false, vane1: false, vane2: false }],
  raised: [{ done: false, up: false }],
};
