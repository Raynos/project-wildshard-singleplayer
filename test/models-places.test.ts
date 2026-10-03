// E315 M12 / M8 rule 9: every named place is a Set. Each shard's list of named places (NAMED_PLACES in
// scripts/check-models.mjs) is read from its own source, and every place in it must be named by some set's
// `place: '<slug>/<id>'`; once a shard is enforced (PLACES_ENFORCED), a place without one fails check-models.
import { describe, expect, it } from 'vitest';
import { SHARDS } from '../src/shards.generated';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test checks optional authored lists against the exported tree.
import { existsSync } from 'node:fs';
import { checkModels, NAMED_PLACES, PLACES_ENFORCED } from '../scripts/check-models.mjs';
import { DRIFTWOOD_PLACES } from '#shards/driftwood-isle/quest/Places';
import { NALATI_PLACES } from '#shards/nalati-grasslands/quest';
import { PINE_HOLLOW_POIS } from '#shards/pine-hollow/layout';

describe('every named place is a set (E315 M12)', () => {
  it('reads each shard\'s named places from its own list, as the game does', () => {
    const { places } = checkModels();
    expect(places['driftwood-isle']?.named).toBe(DRIFTWOOD_PLACES.length);
    expect(places['nalati-grasslands']?.named).toBe(NALATI_PLACES.length);
    expect(places['pine-hollow']?.named).toBeGreaterThanOrEqual(PINE_HOLLOW_POIS.length);
    // Include experimental and hidden shards: a present named-place list must obey the model contract on either.
    expect(Object.keys(NAMED_PLACES).sort()).toEqual(SHARDS.map((shard) => shard.slug).sort());
    expect([...PLACES_ENFORCED].sort()).toEqual(Object.keys(NAMED_PLACES).sort());
  });

  it('an enforced shard has a set for every named place, and every set names a real place', () => {
    const { places, violations } = checkModels();
    for (const shard of PLACES_ENFORCED) expect(places[shard]?.missing ?? ['(no list)']).toEqual([]);
    expect(violations).toEqual([]);
  });

  it('optional lists may be absent, but a present list still needs its sets and valid place ids', () => {
    const { places } = checkModels();
    const optional = Object.entries(NAMED_PLACES).filter(([, lists]) => lists.every((list) => list.optional === true));
    for (const [slug, lists] of optional) {
      if (lists.every((list) => !existsSync(new URL(`../${list.file}`, import.meta.url)))) {
        expect(places[slug], slug).toEqual({ named: 0, sets: 0, missing: [] });
      }
      const list = lists[0];
      if (list === undefined) throw new Error(`${slug}: missing list spec`);
      const source = `export const ${list.list} = [{ id: 'beacon' }];`;
      const file = `src/shards/${slug}/models/places.ts`;
      const bad = checkModels({ [list.file]: source });
      expect(bad.violations, slug).toContain(`${slug}: the named place 'beacon' has no set — placeSet({ … place: '${slug}/beacon' … }) with the models placed there`);
      const good = checkModels({ [list.file]: source, [file]: `placeSet({ place: '${slug}/beacon' });` });
      expect(good.placeProblems, slug).toEqual([]);
      expect(good.places[slug], slug).toEqual({ named: 1, sets: 1, missing: [] });
      const wrong = checkModels({ [list.file]: source, [file]: `placeSet({ place: '${slug}/typo' });` });
      expect(wrong.violations.some((problem) => problem.includes(`'${slug}/typo', which is not`)), slug).toBe(true);
      const malformed = checkModels({ [list.file]: 'export const NOT_PLACES = [];' });
      expect(malformed.violations, slug).toContain(`${list.file}: no ${list.list} array — ${slug}'s named places`);
    }
  });

  it('fails a place with no set, and a set naming a place that is not there, on an enforced shard', () => {
    const list = "export const DRIFTWOOD_PLACES: PlaceDef[] = [\n  { id: 'pier', label: 'THE PIER', at: { poi: 'world', x: 0, z: 0 }, r: 40 },\n  { id: 'hut', label: 'HUT', at: { poi: 'hut', x: 0, z: 0 }, r: 26 },\n];\n";
    const sets = "placeSet({ id: 'driftwood-isle/pier-landing', name: 'Pier', file: 'x', place: 'driftwood-isle/pier', members });\nplaceSet({ id: 'x', name: 'x', file: 'x', place: 'driftwood-isle/pierr', members });\n";
    const r = checkModels({ 'src/shards/driftwood-isle/quest/Places.ts': list, 'src/world/x.ts': sets });
    expect(r.places['driftwood-isle']).toEqual({ named: 2, sets: 1, missing: ['hut'] });
    expect(r.placeProblems.some((p) => p.includes("'hut' has no set"))).toBe(true);
    expect(r.placeProblems.some((p) => p.includes("'driftwood-isle/pierr', which is not"))).toBe(true);
  });
});
