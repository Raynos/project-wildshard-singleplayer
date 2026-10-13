import { installDeclaredQuestHost } from '../../../src/game/plugin/simulation';
import type { SimHost } from '../../../src/engine/sim';
import type { SkyQuestPorts } from '../quest-oracle/sky-bridge';
import source from '../../../src/shards/far-reach/shard.config';
import { SKY_SPOTS } from '../../../src/shards/far-reach/data/questPrompts';

/** The real admitted shipping root, with only the actual native owner ports supplied by the frozen oracle. */
export function installSkyQuest(host: SimHost, ports: SkyQuestPorts) {
  return installDeclaredQuestHost(host, { ...source, quests: ports.quests }, { ...ports, spots: { interact: SKY_SPOTS, crack: [] },
    observations: new Map([['winch-up', ports.winch.raised]]), actions: new Map([['winch', ports.winch.command]]), directorActions: new Map() }).quests;
}
