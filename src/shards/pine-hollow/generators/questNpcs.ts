import { PINE_QUESTS } from './quests';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { QUEST_NPCS } from './questTalkPolicy';
import { RANGER_DIALOGUE, MILLER_DIALOGUE, TRADER_DIALOGUE } from './wardensHollow';

interface Point { x: number; z: number }
const front = (site: Point & { rot: number }, distance: number): Point => ({ x: site.x - Math.sin(site.rot) * distance, z: site.z - Math.cos(site.rot) * distance });

/** Static people placement and talk rows from the same cabin frames; ground stays a live native query. */
export function pineQuestNpcs(): Record<string, unknown> {
  const cabin = LAYOUT.CABIN_SITES[0] ?? { x: -14, z: -34, rot: 0.35 };
  const cos = Math.cos(cabin.rot), sin = Math.sin(cabin.rot), local = { x: 6.0, z: 0.2 };
  const ranger = { x: cabin.x + local.x * cos + local.z * sin, z: cabin.z - local.x * sin + local.z * cos };
  return { quests: PINE_QUESTS, ranger: { at: ranger, cos, sin }, rows: [
    { kind: 'posed-talk', npc: RANGER_DIALOGUE, figure: 'ranger', at: ranger, yaw: Math.atan2(cos, -sin), install: QUEST_NPCS.ranger },
    { kind: 'posed-talk', npc: MILLER_DIALOGUE, figure: 'miller', at: front(LAYOUT.HAMLET_SITES.miller, 2.5 + 1.8 + 1.4),
      yaw: LAYOUT.HAMLET_SITES.miller.rot + Math.PI, install: QUEST_NPCS.miller,
      done: { call: 'pay-miller', when: { all: ['errand:thanked'], none: ['errand:paid'] } } },
    { kind: 'posed-talk', npc: TRADER_DIALOGUE, figure: 'trader', at: front(LAYOUT.HAMLET_SITES.trader, 0.55),
      yaw: LAYOUT.HAMLET_SITES.trader.rot + Math.PI, install: QUEST_NPCS.trader,
      prompt: { at: front(LAYOUT.HAMLET_SITES.trader, 2.6), height: 1.4 }, done: { call: 'trade' } },
  ] };
}
