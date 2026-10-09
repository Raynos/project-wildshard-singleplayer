import { parseQuestData } from '@wildshard/sdk/quests';
import { DECK, ROOST, SPAWN, VANES, WINCH } from './layout';
import { STRINGS } from './strings';
import { FLAGS, vaneFlag } from '../quest/flags';

/** Authored keeper placement shared by the declared marker and the native view. */
export const KEEPER_AT = { x: -2.4, z: -13.6, yaw: Math.atan2(SPAWN.x + 2.4, SPAWN.z + 13.6) };
const at = (x: number, y: number, z: number) => ({ poi: 'world', x, y, z });
/** The existing four steps, chips and exact world marker heights; presentation remains the native held beat. */
export const SKY_QUESTS = parseQuestData({ flags: [...Object.values(FLAGS), ...VANES.map(vane => vaneFlag(vane.id))],
  quests: [{ id: 'far.quest', title: STRINGS.quest, completeFlag: FLAGS.complete, steps: [
    { id: 'notes', objective: STRINGS.talkKeeperStep, chip: STRINGS.chipKeeper, hint: STRINGS.hintKeeper, done: { all: [FLAGS.notes] },
      markers: [{ id: 'keeper', label: STRINGS.keeperPin, short: STRINGS.keeperShort, at: at(KEEPER_AT.x, DECK, KEEPER_AT.z) }] },
    { id: 'roost', objective: STRINGS.roostQuest, chip: STRINGS.chipRoost, hint: STRINGS.hintRoost, done: { all: [FLAGS.roost] },
      markers: [{ id: 'roost', label: STRINGS.roost, short: STRINGS.roostShort, at: at(ROOST.x, ROOST.y, ROOST.z) }] },
    { id: 'vanes', objective: STRINGS.vanes, chip: STRINGS.chipVanes, hint: STRINGS.hintVanes, done: { all: [FLAGS.vanes] },
      count: VANES.map(vane => vaneFlag(vane.id)), markers: VANES.map(vane => ({ id: `vane.${vane.id}`, label: STRINGS.vane,
        short: STRINGS.vaneShort, at: at(vane.x, vane.y + 1.4, vane.z), hideWhen: { all: [vaneFlag(vane.id)] } })) },
    { id: 'raise', objective: STRINGS.raise, chip: STRINGS.chipRaise, hint: STRINGS.hintRaise, done: { all: [FLAGS.raised] },
      markers: [{ id: 'winch', label: STRINGS.winch, short: STRINGS.winchShort, at: at(WINCH.x, WINCH.y, WINCH.z) }] },
  ], onComplete: { coins: 10, fact: 'far-reach.quest' } }], triggers: [], dialogue: [] });
