import { parseQuestData } from '@wildshard/sdk/quests';

export const TEMPLATE_QUESTS = parseQuestData({
  flags: ['template.hut', 'template.blob', 'template.complete'],
  quests: [{ id: 'template.quest', title: 'A first adventure', completeFlag: 'template.complete', steps: [
    { id: 'hut', objective: 'Reach the hut', done: { all: ['template.hut'] } },
    { id: 'blob', objective: 'Beat the blob', done: { all: ['template.blob'] } },
  ], onComplete: { coins: 5, fact: 'template.quest' } }],
  triggers: [
    { id: 'hut', kind: 'region', flag: 'template.hut', x: 0, z: -9, radius: 3 },
    { id: 'blob', kind: 'death', flag: 'template.blob', tag: 'creature.greyBlob' },
  ], dialogue: [],
});
