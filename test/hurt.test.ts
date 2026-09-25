import { describe, expect, it } from 'vitest';
import { deathLine, respawnWhere } from '../src/ui/HurtArc';

const FOREST = respawnWhere({ slug: 'pine-hollow' });
const ISLAND = respawnWhere({ slug: 'driftwood-isle', ocean: { level: 0 } });
const NALATI = respawnWhere({ slug: 'nalati-grasslands' });

describe('deathLine (the death toast, B2)', () => {
  it('names the killer and the shard\'s respawn point', () => {
    expect(deathLine({ kind: 'boar', label: 'Boar' }, FOREST)).toBe('Gored by a boar — respawning at the south gate');
    expect(deathLine({ kind: 'crab', label: 'Big reef crab' }, ISLAND)).toBe('Snapped up by a big reef crab — washed back to the pier');
  });
  it('picks the article and falls back for unknown species / empty labels', () => {
    expect(deathLine({ kind: 'elk', label: 'Elk' }, FOREST)).toBe('Trampled by an elk — respawning at the south gate');
    expect(deathLine({ kind: 'sailor', label: 'The drowned sailor' }, ISLAND)).toBe('Cut down by the drowned sailor — washed back to the pier');
    expect(deathLine({ kind: 'fox', label: '' }, FOREST)).toBe('Killed by a fox — respawning at the south gate');
  });
  it('a fall has no attacker, and the island never mentions the south gate', () => {
    expect(deathLine(null, ISLAND)).toBe('Fell too far — washed back to the pier');
    expect(deathLine({ kind: 'boar', label: 'Boar' }, ISLAND)).not.toContain('south gate');
  });
  it('Nalati: the north road, its own verbs, and a lightning death named (NALATI-MERGE F3)', () => {
    expect(deathLine({ kind: 'wolf', label: 'Grey wolf' }, NALATI)).toBe('Torn down by a grey wolf — respawning on the north road');
    expect(deathLine({ kind: 'ghost-rider', label: '' }, NALATI)).toBe('Ridden down by a ghost-rider — respawning on the north road');
    expect(deathLine({ cause: 'Struck by lightning' }, NALATI)).toBe('Struck by lightning — respawning on the north road');
    expect(deathLine({ cause: 'Struck by lightning' }, NALATI)).not.toContain('Fell too far');
  });
});
