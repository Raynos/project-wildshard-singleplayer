import { createNativeHunt } from '../../src/game/server/plugin/brain';
import { admitNativeRosterServices } from '../../src/game/server/shardfile/homeKeeper';
import { populationEnvironment } from '../../src/game/server/population/environment';
import { flatPopulationEnvironment } from './population-environment';
import type { SimHost } from '../../src/engine/server/sim';
import type { Rng } from '../../src/engine/shared/core/rng';
import { BOAR } from '../../src/game/client/systems/species/boar';
/** Real scoped services for lifecycle tests, without structural callback admission. */
export function fixtureNativeRoster(host: SimHost, rng: Rng) {
  flatPopulationEnvironment(host);
  const { hunt } = createNativeHunt(host, { limit: 64, fight: {}, player: 'host', bands: { states: [], legacyKinds: [] },
    hit: { namespace: 'fixture', tags: [] } }, { rng, ground: populationEnvironment(host, 'fixture.habitat'), nav: null,
    species: new Map([[BOAR.kind, BOAR]]) });
  const services = admitNativeRosterServices(host, 'fixture.roster', hunt);
  return { hunt, services };
}
