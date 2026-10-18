import { RAY_WAKE } from './rows/rayWakeLook';
import wind from '../data/wind.generated.json' with { type: 'json' };
import { FAN_ROW } from './rows/equipment';
import { parseClientPlan } from '@wildshard/format/clientPlan';
import { parsePersistedQuestPage } from '@wildshard/format/questStory';
import page from '../data/questPage.generated.json' with { type: 'json' };
import { SKY_PAGE_PROGRAM } from './rows/population';
import { FAN_ID } from './rows/items';
import { SKY_SCENE_MOTION } from './clientMotion';
import STRINGS from '../data/strings.json' with { type: 'json' };
import { SKY_RUNTIME_BOOT } from './rows/runtimeBoot';

const { capture, ...quest } = parsePersistedQuestPage(page);
/** Build-only lowering removes the old borrowed methods and owner paths. */
const calls = { finish: { finish: true }, raise: { mover: 'far.winch.bridge', command: 3 } } as const;
export const SKY_CLIENT_PLAN = parseClientPlan({ version: 1, features: [
  { kind: 'strings.register' }, { kind: 'world.scenes', graphs: 'required' }, { kind: 'motion.channels', rows: SKY_SCENE_MOTION },
  { kind: 'player.enter', bounds: SKY_RUNTIME_BOOT.bounds, columns: { enabledMode: 'board' } },
  { kind: 'held.melee', item: FAN_ID, stage: 'kit', targets: 'scan', composed: true, stowedMode: 'board',
    finish: { part: 'silk', look: 'fan-silk', image: 'leaf', library: 'sky' } },
  { kind: 'audio.cues', secondary: { item: FAN_ID, cue: 'cue.far-gust' }, rows: { version: 1,
    fields: Object.entries(wind.WIND_FIELDS).map(([id, field]) => Object.assign(structuredClone(field), { id, library: 'sky', look: wind.WIND_LOOKS[id as keyof typeof wind.WIND_LOOKS] },
      id.startsWith('updraft') ? { place: wind.UPDRAFT_AXIS } : {})),
    rows: [{ id: 'cue.far-gust', sound: FAN_ROW.cues.heavy, soundPhase: 'heavy', vfx: [
      { kind: 'field', field: 'gustStreaks', ahead: 0.2, offset: [0, -0.25, 0] },
      { kind: 'field', field: 'gustPetals', ahead: 0.2, offset: [0, -0.25, 0] },
    ] }],
  } },
  { kind: 'species.program', library: 'sky', homes: SKY_PAGE_PROGRAM.species.homes, shove: true },
  { kind: 'quest.page', rows: quest, progress: true, promptOrder: 'npc-page',
    endpoints: [{ mover: 'far.winch.bridge', stage: 'far.quest.raised', toast: STRINGS.raised }],
    capture: Object.fromEntries(Object.entries(capture ?? {}).map(([name, steps]) => [name, steps.map(step => {
      if ('flag' in step) return step;
      if (!Object.hasOwn(calls, step.call)) throw new Error('Unknown authored Sky capture');
      return calls[step.call as keyof typeof calls];
    })])),
  },
  { kind: 'population.homes', ...SKY_PAGE_PROGRAM.population,
    groups: Object.fromEntries(Object.entries(SKY_PAGE_PROGRAM.population.groups).map(([id, rows]) => [id, rows.map(row => row.id)])) },
  { kind: 'boss.held', actor: SKY_PAGE_PROGRAM.fight.id, armed: true,
    again: SKY_PAGE_PROGRAM.fight.victory.again, rewardLabel: SKY_PAGE_PROGRAM.fight.victory.rewardLabel },
  { kind: 'boss.telegraph', actor: SKY_PAGE_PROGRAM.fight.id, view: { kind: 'lane-sheet', strike: 'far.roc.galeWall', system: 'far.galeWall',
    height: 5, thickness: 0.4, y: 2.5, ahead: 2, opacity: [0.06, 0.22], color: 0xc8f1f8 } },
  { kind: 'fx.trail', rows: [{ id: 'far.rayWake', group: 'rays', library: 'sky', look: 'ray-wake', name: RAY_WAKE.name, points: RAY_WAKE.samples, every: RAY_WAKE.every, width: RAY_WAKE.width, minimum: 0.05, movementSq: 0 }] },
  { kind: 'debug.expose', name: 'farReach' },
] });
