import { NPC_FOCUS_PROGRAMS } from '../../src/shards/driftwood-isle/generators/npcFocusPrograms';
import { CASTAWAY } from '../../src/shards/driftwood-isle/generators/questStory';
import { DRIFTWOOD_GRAPH, DRIFTWOOD_ACTIONS } from '../../src/shards/driftwood-isle/generators/questGraph';
import { EXPLORER_CATALOGUE as driftwood } from '../../src/shards/driftwood-isle/generators/explorerCatalogue';
import { EXPLORER_CATALOGUE as nalati } from '../../src/shards/nalati-grasslands/generators/explorerCatalogue';
import { peoplePrograms } from '../../src/shards/nalati-grasslands/generators/peopleMotion';
import { NALATI_WEATHER_PROGRAMS, NALATI_TINT_PROGRAMS } from '../../src/shards/nalati-grasslands/generators/weatherChannels';
import { hashImmutableBytes } from '../../src/sdk/immutable';

/** Full original program/dialogue/interaction/catalogue wires before SDK import migration. */
export function channelQuestAuthorObservation() {
  return Object.entries({ focus: NPC_FOCUS_PROGRAMS, dialogue: CASTAWAY, graph: DRIFTWOOD_GRAPH, actions: DRIFTWOOD_ACTIONS,
    driftwood, nalati, people: peoplePrograms, weather: NALATI_WEATHER_PROGRAMS, tint: NALATI_TINT_PROGRAMS }).map(([name, row]) => {
      const bytes = new TextEncoder().encode(JSON.stringify(row)); return { name, bytes: bytes.length, hash: hashImmutableBytes(bytes) };
    });
}
