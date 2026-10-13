import { installQuestGraph } from '@wildshard/game/plugin/quests';
import { SKY_ACTIONS, SKY_GRAPH } from '../data/questGraph';
import type { SimHost } from '@wildshard/engine/sim';
import type { QuestData } from '@wildshard/format/quests';
import type { DeclaredQuests } from '@wildshard/game/quest/declared';
import { QUEST_STEP, ROOST_IDS, SKY_ACT, SKY_INTERACT, SKY_SPOTS } from '../data/questPrompts';
import { FLAGS } from '../quest/flags';

const MAX_COMMANDS = 1024;
/** The roost's rays and the vanes are finite authored rows; refuse overflow rather than read past the bound. */
const MAX_ROWS = 64;

/** The winch bridge as the quest drives it: queue the winch's raise, and read whether its pose is up. */
export interface SkyWinch { readonly command: () => void; readonly raised: () => boolean }
/** What the quest keeper is lent: the admitted quest rows, the tick's script commands, the effect ports and the winch. */
export interface SkyQuestPorts {
  readonly quests: QuestData;
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  /** The winch bridge's mover. */
  readonly winch: SkyWinch;
}

/** The winch's permission bits, as the browser hands its mover (runtime/index.ts): the roost quiet 1, the vanes turning 2. */
export function skyWinchPermission(flags: Pick<SimHost['flags'], 'has'>): number {
  return Number(flags.has(FLAGS.roost)) + Number(flags.has(FLAGS.vanes)) * 2;
}

/**
 * "The crown bridge" in the renderer-free host (SF72): the declared quest rows through the game's declared quest path
 * (`DeclaredQuests` on `host.flags`, its `far-reach.quest` fact and 10 coins once through the platform's effect ports), and
 * the browser's own step rules (runtime/index.ts): (1) the keeper's talk (his first dialogue sets the notes flag) or the
 * lectern's notes; (2) the roost clears once its three rays are down and the notes are read; (3) the vanes, each turned by
 * a GUST through quest/vanes.ts (runtime/fan.ts), complete the step once all three turn; (4) the winch answers only with
 * the roost quiet and the vanes turning, and the step completes when the winch bridge's pose comes up. Prompts are `script`
 * commands at the browser's radii from the player's eye; their line-of-sight check is not modelled (they stand in the open).
 */
export function installSkyQuest(host: SimHost, ports: SkyQuestPorts): DeclaredQuests {
  if (ROOST_IDS.some(id => host.entities.get(id) === undefined)) throw new Error('Sky Reach installs its quest after the roost rays');
  const graph = installQuestGraph(host, { quests: ports.quests, interactions: SKY_ACTIONS, npcs: [], graph: SKY_GRAPH },
    { spots: { interact: SKY_SPOTS, crack: [] }, commands: ports.commands, fact: ports.fact, coins: ports.coins, drive: 'external' });
  const flags = host.flags;
  const act = (value: number): void => {
    if (value === SKY_ACT.talk) { if (graph.near('keeper')) graph.run('talk'); return; }
    if (value === SKY_ACT.notes) { if (graph.near('notes')) graph.run('notes'); return; }
    if (value !== SKY_ACT.winch || !graph.near('winch') || ports.winch.raised()) return;
    // the browser toasts "locked" otherwise; nothing moves
    if (flags.has(FLAGS.roost) && flags.has(FLAGS.vanes)) ports.winch.command();
  };
  if (ROOST_IDS.length > MAX_ROWS) throw new RangeError('Sky quest rows exceed their finite bound');
  const roostDown = (): boolean => {
    for (let i = 0; i < MAX_ROWS; i++) { const id = ROOST_IDS[i]; if (id === undefined) break; if (host.entities.get(id)?.alive !== false) return false; }
    return true;
  };
  host.onStep(QUEST_STEP, () => {
    const list = ports.commands();
    for (let i = 0; i < MAX_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      if (command.actorId === SKY_INTERACT) act(command.value);
    }
    if (graph.rules.check('roost').ok && roostDown()) graph.run('roost');
    graph.run('vanes');
    if (!flags.has(FLAGS.raised) && ports.winch.raised()) graph.run('raised');
  });
  return graph.quests;
}
