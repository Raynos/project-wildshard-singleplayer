import { expect, test } from 'vitest';
import { createFindsCatalogue } from '../src/game/bag/findsCatalogue';
import type { OwnedId } from '../src/game/loot/Owned';
import { DRIFTWOOD_FINDS } from '../src/shards/driftwood-isle/generators/finds';
import { DRIFTWOOD_PLACES } from '../src/shards/driftwood-isle/generators/discovery';
import { SHARD_FLAGS } from '../src/shards/driftwood-isle/data/interactables';
import { FINDS_ELITES, elitePrize, nalatiFinds } from '../src/shards/nalati-grasslands/bag';
import { NALATI_ELITE_DEFS } from '../src/shards/nalati-grasslands/data/eliteEncounters';
import content from '../src/shards/nalati-grasslands/data/questContent.json' with { type: 'json' };

const islandCatalogue = createFindsCatalogue(DRIFTWOOD_FINDS);
const driftwoodFinds = (flags: { has: (id: string) => boolean }, owned: { has: (id: OwnedId) => boolean }) => islandCatalogue({ flags, owned });

test('Driftwood reads live flags and owned trophies while preserving milestones and chip colors', () => {
  const set = new Set<string>(), have = new Set<OwnedId>();
  const flags = { has: (flag: string) => set.has(flag) }, owned = { has: (id: OwnedId) => have.has(id) };
  for (const [n, next] of [[0, 5], [4, 5], [5, 10], [9, 10], [10, 15], [14, 15], [15, null]] as const) {
    set.clear(); for (let i = 1; i <= n; i++) set.add(`glass:${String(i)}`);
    set.add('glass:16');
    const view = driftwoodFinds(flags, owned);
    expect(view.counters[0]).toEqual({ label: 'Sea glass', n, of: 15 });
    expect(view.next).toBe(next === null ? null : `Next charm at ${String(next)}`);
    expect(view.glass).toHaveLength(15);
    expect(view.glass.filter(chip => chip.found)).toHaveLength(n);
    expect(view.glass.map(chip => chip.color)).toEqual(Array.from({ length: 15 }, (_, i) => DRIFTWOOD_FINDS.glass.colors[i % 5]));
  }
  have.add('bear-claw'); have.add('captain-hat'); set.add('found:reef-treasure');
  for (const place of DRIFTWOOD_PLACES) set.add(`seen:${place.id}`);
  for (const flag of SHARD_FLAGS) set.add(flag);
  const full = driftwoodFinds(flags, owned);
  expect(full.counters.slice(1)).toEqual([{ label: 'Places', n: 9, of: 9 }, { label: 'Glyph shards', n: 3, of: 3 }]);
  expect(full.sections[0]?.items.map(item => item.found)).toEqual([true, false, true]);
  expect(full.sections[1]?.items[0]?.found).toBe(true);
  have.delete('bear-claw'); expect(driftwoodFinds(flags, owned).sections[0]?.items[0]?.found).toBe(false);
});

test('the named Nalati W3 flag and prize catalogue fits its current Bag owner', () => {
  const catalogue = createFindsCatalogue({ counters: [
    { label: 'Elites', flags: FINDS_ELITES.map(row => `felled:${row.id}`) },
    { label: 'Places', flags: content.places.map(row => `seen:${row.id}`) },
  ], sections: [
    { title: 'Elites', wide: true, items: FINDS_ELITES.map(({ id, icon }) => {
      const { prize, title } = elitePrize(id);
      return { label: NALATI_ELITE_DEFS[id]?.name ?? id, icon, flag: `felled:${id}`, prize: title === null ? [prize] : [prize, title] };
    }) },
    { title: 'Places', dense: true, items: content.places.map(row => ({ label: row.label, icon: 'pin' as const, flag: `seen:${row.id}` })) },
  ] });
  const set = new Set<string>(), flags = { has: (flag: string) => set.has(flag) };
  expect(catalogue({ flags })).toEqual(nalatiFinds(flags));
  for (const row of FINDS_ELITES) set.add(`felled:${row.id}`);
  for (const row of content.places) set.add(`seen:${row.id}`);
  expect(catalogue({ flags })).toEqual(nalatiFinds(flags));
});

test('catalogues refuse unbounded metadata, invalid milestones and missing ownership', () => {
  expect(() => createFindsCatalogue({ ...DRIFTWOOD_FINDS, counters: Array.from({ length: 33 }, () => ({ label: 'No', flags: [] })) })).toThrow('capacity');
  expect(() => createFindsCatalogue({ ...DRIFTWOOD_FINDS, glass: { ...DRIFTWOOD_FINDS.glass, colors: [] } })).toThrow('colors');
  expect(() => createFindsCatalogue({ ...DRIFTWOOD_FINDS, next: { ...DRIFTWOOD_FINDS.next, every: 0 } })).toThrow('milestone');
  expect(() => createFindsCatalogue({ ...DRIFTWOOD_FINDS, counters: [{ label: 'No', flags: { prefix: 'a', count: 257 } }] })).toThrow('range');
  const refusingCatalogue = createFindsCatalogue(DRIFTWOOD_FINDS);
  expect(() => refusingCatalogue({ flags: { has: () => false } })).toThrow('ownership');
});
