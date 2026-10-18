import { parseClientPlan } from '@wildshard/format/clientPlan';
import { parsePersistedQuestPage } from '@wildshard/format/questStory';
import page from '../data/questPage.generated.json' with { type: 'json' };
import { SIGNAL_PAGE_PROGRAM } from './rows/population';
import { WHIP_ITEMS } from './rows/items';
import { SIGNAL_SCENE_MOTION } from './clientMotion';
import { SIGNAL_EMITTERS } from './lightEmitters';
import { SIGNAL_WEATHER_FIELDS } from './weatherFields';
import { FLAG } from './rows/flags';

const { capture, ...quest } = parsePersistedQuestPage(page);
const calls = new Map<string, unknown>([['dusk', { settle: 'weather.fields' }], ['logbook', { action: 'logbook' }],
  ['well.pull', { action: 'crank' }], ['well.take', { action: 'well' }],
  ...[0, 1, 2].flatMap(i => [`pour.${String(i)}`, `light.${String(i)}`].map(action => [action, { action }] as const))]);
/** The original saved checkpoints invoke accepted page rules and native motion. */
export const SIGNAL_CLIENT_PLAN = parseClientPlan({ version: 1, features: [
  { kind: 'strings.register' }, { kind: 'world.scenes', graphs: 'debug' }, { kind: 'motion.channels', rows: SIGNAL_SCENE_MOTION },
  { kind: 'player.enter', pitch: -0.1 },
  { kind: 'light.emitters', rows: SIGNAL_EMITTERS },
  { kind: 'weather.fields', rows: SIGNAL_WEATHER_FIELDS, quest: quest.id },
  { kind: 'held.melee', item: WHIP_ITEMS.loadout.primary, stage: 'equipment', targets: 'raycast' },
  { kind: 'species.program', library: 'models' },
  { kind: 'quest.page', rows: quest, promptOrder: 'page-npc',
    capture: { dusk: [{ settle: 'weather.fields' }], ...Object.fromEntries(Object.entries(capture ?? {}).map(([name, steps]) => [name, steps.map(step => {
      if ('flag' in step) return step;
      const call = calls.get(step.call); if (call === undefined) throw new Error('Unknown authored Signal capture'); return call;
    })])) },
  },
  { kind: 'boss.spawned', actor: SIGNAL_PAGE_PROGRAM.fight.id, armed: { flag: FLAG.lit } },
  { kind: 'boss.telegraph', actor: SIGNAL_PAGE_PROGRAM.fight.id, view: { kind: 'marked', rows: SIGNAL_PAGE_PROGRAM.fight.presentation } },
  { kind: 'population.homes', ...SIGNAL_PAGE_PROGRAM.population },
  { kind: 'debug.expose', name: 'sunscar' },
] });
