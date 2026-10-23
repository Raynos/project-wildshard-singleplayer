import type { SpeciesCatalogue } from '@wildshard/game/looks/speciesBook';

let catalogue: SpeciesCatalogue | null = null;
/** Product JSON is admitted before the first creature build or frame: the species are the hull book's catalogue. */
export function prepareNalatiSpecies(species: SpeciesCatalogue): void { catalogue ??= species; }
export function nalatiSpeciesCatalogue(): SpeciesCatalogue { if (catalogue === null) throw new Error('Species are not prepared'); return catalogue; }
