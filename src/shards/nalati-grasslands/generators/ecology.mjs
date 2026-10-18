import aqbars from '../data/aqbarsProfile.json' with { type: 'json' };
import kokbori from '../data/kokboriProfile.json' with { type: 'json' };
import author from '../data/ecology.json' with { type: 'json' };
import * as world from './layout.ts';
import * as places from './poiLayout.ts';
import { flock } from '@wildshard/sdk/crowds';
import { species } from '@wildshard/sdk/species';
import { SpeciesSchema } from '@wildshard/format/speciesPrograms';
import * as v from 'valibot';

/** Resolve symbolic placement once; no native clock, id allocation or RNG runs here. */
export function ecologyRows() {
  const anchors = { ...world, ...places };
  const at = name => {
    const point = anchors[name];
    if (point === undefined || typeof point.x !== 'number' || typeof point.z !== 'number') throw new Error(`Unknown ecology anchor: ${name}`);
    return point;
  };
  const wildlife = { ...author.wildlife,
    packs: author.wildlife.packs.map(({ at: name, offset, ...row }) => ({ x: at(name).x + offset[0], z: at(name).z + offset[1], ...row })),
    herds: author.wildlife.herds.map(({ at: name, ...row }) => ({ x: at(name).x, z: at(name).z, ...row })),
    flocks: author.wildlife.flocks.map(({ at: name, ...row }) => ({ x: at(name).x, z: at(name).z, ...row, range: at(name).r })),
  };
  const rows = layout => layout.map((row, index) => flock({ ...author.flock, id: `nalati.flock.${String(index)}`,
    x: row.x, z: row.z, count: row.count, seed: index * 101, range: row.range ?? 45 }));
  const gameplay = { ...author.gameplay, horse: { ...author.gameplay.horse, walkSpeed: author.modes.ride[0].gaits.walk } };
  // Validate the existing full native species admission without material/view fields.
  for (const row of Object.values(author.species)) species(row);
  const fields = v.pick(SpeciesSchema, ['aggressive', 'walkSpeed', 'chargeSpeed', 'chargeDamage', 'sounds', 'tuning', 'tick', 'trampleRadius']);
  for (const row of Object.values(gameplay)) v.parse(fields, row);
  return { argymaq: author.argymaq, profiles: { aqbars, kokbori },
    elites: Object.fromEntries(Object.entries(author.elites).map(([id, row]) => [id, { ...row, lair: { x: at(row.lair.at).x, z: at(row.lair.at).z, r: row.lair.r } }])),
    wildlife, mareVariants: author.mareVariants, modes: author.modes, gameplay, species: author.species,
    flocks: { world: rows(wildlife.flocks), specimen: rows(author.specimenFlocks) } };
}
