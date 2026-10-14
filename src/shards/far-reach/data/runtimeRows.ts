import { FAN_HELD_RECIPE } from './heldWeapon';
import { SKY_QUEST_PAGE } from './questPage';
import { STRINGS } from './strings';
import { FAN_ROW, FAN_PRESENTATION } from './equipment';
import { SKY_RUNTIME_BOOT } from './runtimeBoot';
import { SKY_PAGE_PROGRAM } from './population';
import { ROC_ID } from './rocFight';
import { FLAGS } from '../quests/flags';
import { SKY_NATIVE_WORLD } from './nativeWorld';

/** Discovery, boot and population facts; the native plugin supplies only its admitted source. */
export const SKY_RUNTIME_ROWS = { clientMotion: SKY_NATIVE_WORLD.motion, melee: { recipe: FAN_HELD_RECIPE, stage: 'kit', targets: 'scan', expose: 'fan', composed: true, stowedMode: 'board',
  presentation: FAN_PRESENTATION, legacySlot: 'far-fan', decorate: { call: { owner: 'heldStyle', path: ['paint'] }, value: { owner: 'plugin', path: ['leaf'] } } } as const, expose: 'farReach', strings: STRINGS, weapon: FAN_ROW, encounters: { id: ROC_ID, displayName: STRINGS.roc },
  pageQuest: { stages:{observations:[{id:'winch-up',owner:'plugin',path:['built','state','raised']}]}, data: SKY_QUEST_PAGE, progress: true,
    model: { kind: 'pivots', read: { owner: 'models', path: ['painted'] }, material: { owner: 'looks', path: ['mapped'] } },
    dress: [{ call: { owner: 'scope', path: ['ownPrimitives'] }, args: ['group', { instances: true }] }],
    capture: { finish: { owner: 'quest', path: ['finished'] }, raise: { owner: 'plugin', path: ['finishRaise'] } },
  } as const,
  complete: FLAGS.complete, boot: SKY_RUNTIME_BOOT, ...SKY_PAGE_PROGRAM };
