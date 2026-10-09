import { expect, it } from 'vitest';
import { decodeSimSnapshot } from '../../../src/engine/sim/snapshot';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import { fixture, ticks, door, walk } from './native';

it('restores one mid-hall checkpoint in a fresh Node host and replays the exact suffix', async () => {
  const f = await fixture(), host = await f.open();
  try {
    await ticks(host, 1, door);
    const prefix = await ticks(host, 100, walk), suffix = await ticks(host, 200, walk);
    const restored = await f.open(prefix.commit.snapshot);
    try {
      const replay = await ticks(restored, 200, walk);
      expect(replay.emissions).toEqual(suffix.emissions);
      expectSameSimSnapshot(decodeSimSnapshot(replay.commit.snapshot), decodeSimSnapshot(suffix.commit.snapshot));
      expect(replay.emissions.some(row => row.effect.kind === 'fact' && row.effect.name === 'blender.hall')).toBe(true);
    } finally { await restored.dispose(); }
  } finally { await host.dispose(); }
}, 60_000);
