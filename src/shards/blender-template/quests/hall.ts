import { parseQuestData } from '@wildshard/sdk/quests';

/** A two-step loop through the real hall door; the normal quest ledger owns the one-time reward. */
export const HALL_QUEST = parseQuestData({
  flags: ['blender.door', 'blender.guardian', 'blender.complete'],
  quests: [{ id: 'blender.hall', title: 'The clay hall', track: true, completeFlag: 'blender.complete', steps: [
    { id: 'door', objective: 'Open the hall door', done: { all: ['blender.door'] },
      markers: [{ id: 'door', label: 'Hall door', at: { poi: 'world', x: 0, z: 15.6 } }] },
    { id: 'guardian', objective: 'Meet the hall guardian', done: { all: ['blender.guardian'] },
      markers: [{ id: 'guardian', label: 'Hall guardian', at: { poi: 'world', x: 0, z: 32 } }] },
  ], onComplete: { coins: 5, fact: 'blender.hall' } }],
  triggers: [{ id: 'door', kind: 'script', flag: 'blender.door', condition: 'blender.door.open' },
    { id: 'guardian', kind: 'region', flag: 'blender.guardian', x: 0, z: 32, radius: 4, when: { all: ['blender.door'] } }],
  dialogue: [],
});
