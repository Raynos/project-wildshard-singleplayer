import { describe, expect, it } from 'vitest';
import { deathLine } from '../src/ui/HurtArc';

describe('deathLine (the death toast, B2)', () => {
  it('names the killer and the shard\'s respawn point', () => {
    expect(deathLine({ kind: 'boar', label: 'Boar' }, false)).toBe('Gored by a boar — respawning at the south gate');
    expect(deathLine({ kind: 'crab', label: 'Big reef crab' }, true)).toBe('Snapped up by a big reef crab — washed back to the pier');
  });
  it('picks the article and falls back for unknown species / empty labels', () => {
    expect(deathLine({ kind: 'elk', label: 'Elk' }, false)).toBe('Trampled by an elk — respawning at the south gate');
    expect(deathLine({ kind: 'sailor', label: 'The drowned sailor' }, true)).toBe('Cut down by the drowned sailor — washed back to the pier');
    expect(deathLine({ kind: 'wolf', label: '' }, false)).toBe('Killed by a wolf — respawning at the south gate');
  });
  it('a fall has no attacker, and the island never mentions the south gate', () => {
    expect(deathLine(null, true)).toBe('Fell too far — washed back to the pier');
    expect(deathLine({ kind: 'boar', label: 'Boar' }, true)).not.toContain('south gate');
  });
});
