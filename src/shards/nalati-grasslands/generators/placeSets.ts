import content from '../data/questContent.json' with { type: 'json' };

interface PlaceRow {
  /** the named place (`nalati-grasslands/<content.places id>`) */
  readonly place: string;
  /** the set's id (a POI's set keeps the id it had) and name */
  readonly id: string;
  readonly name: string;
  /** the module that composes it */
  readonly file: string;
  /** the POIs (NalatiPOIs' piece names) whose placed models are this place's, whole */
  readonly pois?: readonly string[];
}

/** every named place's set (the place ids are string literals: scripts/check-models.mjs reads them) */
export const PLACE_SETS: readonly PlaceRow[] = [
  { place: 'nalati-grasslands/nomad-camp', id: 'nalati-grasslands/spring-camp', name: 'Spring camp', file: 'src/shards/nalati-grasslands/world/NomadCamp.ts', pois: ['camp'] },
  { place: 'nalati-grasslands/sheep-pasture', id: 'nalati-grasslands/sheep-pasture', name: 'Sheep pasture', file: 'src/shards/nalati-grasslands/generators/placeSets.ts' },
  { place: 'nalati-grasslands/bridge', id: 'nalati-grasslands/bridge', name: 'The Kunes bridge', file: 'src/shards/nalati-grasslands/world/Bridge.ts', pois: ['bridge'] },
  { place: 'nalati-grasslands/kunes-river', id: 'nalati-grasslands/kunes-river', name: 'The Kunes river', file: 'src/shards/nalati-grasslands/generators/placeSets.ts' },
  { place: 'nalati-grasslands/sky-road', id: 'nalati-grasslands/sky-road', name: 'The sky road', file: 'src/shards/nalati-grasslands/generators/placeSets.ts' },
  { place: 'nalati-grasslands/eagle-rock', id: 'nalati-grasslands/eagle-rock-knoll', name: 'Eagle Rock', file: 'src/shards/nalati-grasslands/generators/places.ts', pois: ['eagleRock'] },
  { place: 'nalati-grasslands/horse-plains', id: 'nalati-grasslands/horse-plains', name: 'The horse plains', file: 'src/shards/nalati-grasslands/generators/placeSets.ts' },
  { place: 'nalati-grasslands/kokpar-field', id: 'nalati-grasslands/kokpar-field', name: 'Kokpar field', file: 'src/shards/nalati-grasslands/world/Bowl.ts', pois: ['kokpar'] },
  { place: 'nalati-grasslands/kurgan-field', id: 'nalati-grasslands/kurgan-field', name: 'Kurgan field', file: 'src/shards/nalati-grasslands/generators/places.ts', pois: ['kurgans', 'balbals'] },
  { place: 'nalati-grasslands/great-kurgan', id: 'nalati-grasslands/great-kurgan', name: 'The great kurgan', file: 'src/shards/nalati-grasslands/generators/placeSets.ts' },
  { place: 'nalati-grasslands/summer-camp', id: 'nalati-grasslands/summer-camp', name: 'Summer camp', file: 'src/shards/nalati-grasslands/world/SummerCamp.ts', pois: ['summerCamp'] },
  { place: 'nalati-grasslands/watchtower', id: 'nalati-grasslands/watchtower-hill', name: 'Watchtower hill', file: 'src/shards/nalati-grasslands/world/Bowl.ts', pois: ['watchtower'] },
  { place: 'nalati-grasslands/wind-cairn', id: 'nalati-grasslands/wind-cairn-rise', name: 'The Wind Cairn', file: 'src/shards/nalati-grasslands/world/Cairn.ts', pois: ['cairn'] },
  { place: 'nalati-grasslands/glacier', id: 'nalati-grasslands/glacier', name: 'The glacier', file: 'src/shards/nalati-grasslands/generators/placeSets.ts' },
  { place: 'nalati-grasslands/snow-leopard-cave', id: 'nalati-grasslands/crags', name: "Aqbars' ledges and cave", file: 'src/shards/nalati-grasslands/generators/places.ts', pois: ['crags'] },
  { place: 'nalati-grasslands/the-crags', id: 'nalati-grasslands/the-crags', name: 'The Crags', file: 'src/shards/nalati-grasslands/generators/placeSets.ts' },
  { place: 'nalati-grasslands/snow-lotus', id: 'nalati-grasslands/snow-lotus-meadow', name: 'Snow lotus meadow', file: 'src/shards/nalati-grasslands/world/Bowl.ts', pois: ['snowLotus'] },
];


/** Fixed named sets and spatial selectors; the page borrows the existing placement views. */
export const NALATI_PLACE_SETS = PLACE_SETS.map(row => {
  const where = content.places.find(point => `nalati-grasslands/${point.id}` === row.place);
  if (where === undefined) throw new Error(`Missing named place ${row.place}`);
  return { place: row.place, id: row.id, name: row.name, file: row.file, pois: row.pois ?? [], x: where.x, z: where.z, r: where.r };
});
