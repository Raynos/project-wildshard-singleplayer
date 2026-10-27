import { installDeclaredQuestHost } from '../../../src/game/plugin/simulation';
import type { DeclaredQuests } from '../../../src/game/quest/declared';
import type { SimHost } from '../../../src/engine/sim';
import type { SkyQuestPorts } from '../quest-oracle/sky-bridge';
import { skyProductRows } from '../../../src/shards/far-reach/generators/product';
import { originalSkyNavigation } from '../sky-navigation';
import { originalSkyMovers } from '../sky-movers';
import { SKY_SPOTS } from '../../../src/shards/far-reach/generators/questPrompts';

const source = skyProductRows(originalSkyNavigation(), originalSkyMovers());

/** The real admitted shipping root, with only the actual native owner ports supplied by the frozen oracle. */
export function installSkyQuest(host: SimHost, ports: SkyQuestPorts): DeclaredQuests {
  return installDeclaredQuestHost(host, { ...source, quests: ports.quests }, { ...ports, spots: { interact: SKY_SPOTS, crack: [] },
    observations: new Map([['winch-up', ports.winch.raised]]), actions: new Map([['winch', ports.winch.command]]), directorActions: new Map() }).quests;
}
