import { parseNativeQuestComposition } from '@wildshard/format/nativeQuestComposition';
import authored from '../data/nativeQuest.json' with { type: 'json' };
import spots from '../data/spots.generated.json' with { type: 'json' };

/** Existing native mechanics retain the world frame and exact legacy save order. */
export const DRIFTWOOD_NATIVE_QUEST = parseNativeQuestComposition({
  step: authored.step, cable: authored.cable, eye: 0, counts: 'declared',
  phases: ['props', 'transitions', 'cable', 'director', 'reward'],
  saved: { names: {}, snapshot: ['key', 'finale', 'iron', 'pack', 'zipline', 'reward', 'counts', 'barrel'],
    restore: ['zipline', 'reward', 'pack', 'finale', 'key', 'iron', 'counts', 'barrel'], optional: [],
  },
  bounds: { rows: authored.limits.rows, items: authored.limits.rows, ordered: true },
  transitions: { ids: spots.rows.map(row => row.id), rowLimit: authored.limits.rows, flagLimit: authored.limits.rows,
    touch: 'graph', pickup: authored.touch, plate: authored.plate },
  props: { barrel: authored.barrelOwner, drop: authored.keyDrop, promptHeight: authored.promptHeight },
  acquisition: { population: authored.population, equipment: authored.equipment, kind: authored.guardKind, slot: authored.heldSlot,
    id: authored.heldId, observation: authored.heldObservation, guardRadius: authored.guardRadius, radius: authored.swordRadius, action: authored.actions.sword },
  reward: { director: authored.director, ...authored.reward, seen: authored.rewardFlag },
  prompts: { talk: { id: authored.talkId, action: authored.actions.talk, radius: authored.talkRadius },
    cable: { id: authored.cableId, action: authored.actions.zipline }, rowBase: authored.actions.row },
});
