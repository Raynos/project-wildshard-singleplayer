import { WHIP_HELD_RECIPE } from './heldWeapon';
import { SIGNAL_QUEST_PAGE } from './questPage';
import { STRINGS } from './strings';
import { WHIP_ROW } from './equipment';
import { SIGNAL_RUNTIME_BOOT } from './runtimeBoot';
import { SIGNAL_PAGE_PROGRAM } from './population';

/** Discovery, boot and population facts; the native plugin supplies only its admitted source. */
export const SIGNAL_RUNTIME_ROWS = { pageFight: { kind: 'spawned', armed: { owner: 'plugin', path: ['places', 'fire', 'lit'] }, bindStages: true, dress: { owner: 'looks', path: ['dress'] } } as const, melee: { recipe: WHIP_HELD_RECIPE, stage: 'equipment', targets: 'raycast', expose: 'whip' } as const, expose: 'sunscar', strings: STRINGS, weapon: WHIP_ROW, encounters: [{ id: 'sunscar.matriarch', displayName: STRINGS.matriarch }],
  pageQuest: { stages: {actions:[{id:'sunscar.signal-fire',action:{spawn:'sunscar.matriarch'},owner:'fight',path:['summon']}],events:[{id:'sunscar.signal-fire',owner:'plugin',path:['places','fire','onLight']}]}, data: SIGNAL_QUEST_PAGE, flags: { owner: 'plugin', path: ['places', 'flags'] },
    model: { kind: 'mesh', read: { owner: 'models', path: ['mesh'] } },
    dress: [{ call: { owner: 'scope', path: ['ownPrimitives'] }, args: ['group'] },
      { call: { owner: 'looks', path: ['dress'] }, args: ['group', 'scope'] }],
    capture: { dusk: { owner: 'plugin', path: ['settleQuestDusk'] }, logbook: { owner: 'plugin', path: ['places', 'logbook', 'onInteract'] },
      'well.pull': { owner: 'plugin', path: ['places', 'well', 'pull'] }, 'well.take': { owner: 'plugin', path: ['places', 'well', 'spot', 'onInteract'] },
      'pour.0': { owner: 'plugin', path: ['places', 'braziers', 0, 'spot', 'onInteract'] }, 'light.0': { owner: 'plugin', path: ['places', 'braziers', 0, 'light'] },
      'pour.1': { owner: 'plugin', path: ['places', 'braziers', 1, 'spot', 'onInteract'] }, 'light.1': { owner: 'plugin', path: ['places', 'braziers', 1, 'light'] },
      'pour.2': { owner: 'plugin', path: ['places', 'braziers', 2, 'spot', 'onInteract'] }, 'light.2': { owner: 'plugin', path: ['places', 'braziers', 2, 'light'] } },
  } as const,
  complete: 'sunscar.complete', boot: SIGNAL_RUNTIME_BOOT, ...SIGNAL_PAGE_PROGRAM };
