import { expect, test } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { syncFelledElites } from '../src/shards/nalati-grasslands/adventure';

const saved = { kokbori: { timer: 0, discovered: false, skinTaken: false, kills: 1, retired: false },
  other: { timer: 0, discovered: false, skinTaken: false, kills: 2, retired: false } };

test('elite poll propagates the original flag/save listener failure', () => {
  const flags = new Flags('adventure-error', false), failure = new Error('The quest save listener could not persist');
  const off = flags.onChange(flag => { if (flag === 'felled:kokbori') throw failure; });
  try {
    expect(() => syncFelledElites(flags, [{ id: 'kokbori' }], () => saved)).toThrow(failure);
    expect(flags.has('felled:kokbori')).toBe(true);
    expect(flags.has('felled:other')).toBe(false);
  } finally { off(); }
});

test('elite read failures remain recoverable and only authored dead elites set flags', () => {
  const flags = new Flags('adventure-read-error', false);
  expect(() => syncFelledElites(flags, [{ id: 'kokbori' }], () => { throw new Error('Old save is unavailable'); })).not.toThrow();
  expect(flags.all).toEqual([]);
  syncFelledElites(flags, [{ id: 'kokbori' }], () => saved);
  expect(flags.all).toEqual(['felled:kokbori']);
});
