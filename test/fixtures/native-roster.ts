import { createNativeHunt } from '../../src/game/plugin/brain';
import { admitNativeRosterServices } from '../../src/game/shardfile/homeKeeper';
import { populationEnvironment } from '../../src/game/population/environment';
import { flatPopulationEnvironment } from './population-environment';
import type { SimHost } from '../../src/engine/sim';
import type { Rng } from '../../src/engine/core/rng';
import { BOAR } from '../../src/game/systems/species/boar';
/** Real scoped services for lifecycle tests, without structural callback admission. */
export function fixtureNativeRoster(host: SimHost, rng: Rng) {
  flatPopulationEnvironment(host);
  const { hunt } = createNativeHunt(host, { limit: 64, fight: {}, player: 'host', bands: { states: [], legacyKinds: [] },
    hit: { namespace: 'fixture', tags: [] } }, { rng, ground: populationEnvironment(host, 'fixture.habitat'), nav: null,
    species: new Map([[BOAR.kind, BOAR]]) });
  const services = admitNativeRosterServices(host, 'fixture.roster', hunt);
  return { hunt, services };
}
