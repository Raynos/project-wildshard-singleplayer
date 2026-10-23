import type { SpeciesCatalogue } from '../../src/game/looks/speciesBook';

let catalogue: SpeciesCatalogue | null = null;
export function prepareNalatiSpecies(species: SpeciesCatalogue): void { catalogue ??= species; }
export function nalatiSpeciesCatalogue(): SpeciesCatalogue {
  if (catalogue === null) throw new Error('Species fixture is not prepared');
  return catalogue;
}
