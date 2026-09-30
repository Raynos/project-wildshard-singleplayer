// E315 M12 / M8 rule 9: every named place is a Set. Each shard's list of named places (NAMED_PLACES in
// scripts/check-models.mjs) is read from its own source, and every place in it must be named by some set's
// `place: '<slug>/<id>'`; once a shard is enforced (PLACES_ENFORCED), a place without one fails check-models.
import { describe, expect, it } from 'vitest';
import { checkModels, NAMED_PLACES, PLACES_ENFORCED } from '../scripts/check-models.mjs';
import { DRIFTWOOD_PLACES } from '../src/game/quest/Places';
import { NALATI_PLACES } from '../src/game/quest/nalati';
import { PINE_HOLLOW_POIS } from '../src/chunks/pineHollowLayout';

describe('every named place is a set (E315 M12)', () => {
  it('reads each shard\'s named places from its own list, as the game does', () => {
    const { places } = checkModels();
    expect(places['driftwood-isle']?.named).toBe(DRIFTWOOD_PLACES.length);
    expect(places['nalati-grasslands']?.named).toBe(NALATI_PLACES.length);
    expect(places['pine-hollow']?.named).toBeGreaterThanOrEqual(PINE_HOLLOW_POIS.length);
    expect(Object.keys(NAMED_PLACES).sort()).toEqual(['driftwood-isle', 'nalati-grasslands', 'nine-dragon-stack', 'pine-hollow']);
  });

  it('an enforced shard has a set for every named place, and every set names a real place', () => {
    const { places, violations } = checkModels();
    for (const shard of PLACES_ENFORCED) expect(places[shard]?.missing ?? ['(no list)']).toEqual([]);
    expect(violations).toEqual([]);
  });

  it('fails a place with no set, and a set naming a place that is not there, on an enforced shard', () => {
    const list = "export const DRIFTWOOD_PLACES: PlaceDef[] = [\n  { id: 'pier', label: 'THE PIER', at: { poi: 'world', x: 0, z: 0 }, r: 40 },\n  { id: 'hut', label: 'HUT', at: { poi: 'hut', x: 0, z: 0 }, r: 26 },\n];\n";
    const sets = "placeSet({ id: 'driftwood-isle/pier-landing', name: 'Pier', file: 'x', place: 'driftwood-isle/pier', members });\nplaceSet({ id: 'x', name: 'x', file: 'x', place: 'driftwood-isle/pierr', members });\n";
    const r = checkModels({ 'src/game/quest/Places.ts': list, 'src/world/x.ts': sets });
    expect(r.places['driftwood-isle']).toEqual({ named: 2, sets: 1, missing: ['hut'] });
    expect(r.placeProblems.some((p) => p.includes("'hut' has no set"))).toBe(true);
    expect(r.placeProblems.some((p) => p.includes("'driftwood-isle/pierr', which is not"))).toBe(true);
  });
});
