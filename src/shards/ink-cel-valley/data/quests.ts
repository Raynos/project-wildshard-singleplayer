import { parseQuestData } from '@wildshard/sdk/quests';

export const INK_QUESTS = parseQuestData({
  flags: ['ink.hut', 'ink.blob', 'ink.complete'],
  quests: [{ id: 'ink.quest', title: 'A first adventure', track: false, completeFlag: 'ink.complete', steps: [
    { id: 'hut', objective: 'Reach the hut', done: { all: ['ink.hut'] } },
    { id: 'blob', objective: 'Beat the blob', done: { all: ['ink.blob'] } },
  ], onComplete: { coins: 5, fact: 'ink.quest' } }],
  triggers: [
    { id: 'hut', kind: 'region', flag: 'ink.hut', x: 0, z: -9, radius: 3 },
    { id: 'blob', kind: 'death', flag: 'ink.blob', tag: 'creature.greyBlob' },
  ], dialogue: [],
});
