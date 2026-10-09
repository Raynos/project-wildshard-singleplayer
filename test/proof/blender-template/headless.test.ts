import { expect, it } from 'vitest';
import { fixture, hall, ticks } from './native';

it('walks the authored hall and emits the two-step reward once without a renderer', async () => {
  const f = await fixture(), host = await f.open();
  try {
    const result = await hall(host), after = await ticks(host, 120);
    expect(result.emissions.filter(row => row.effect.kind === 'coins').map(row => row.effect)).toEqual([{ kind: 'coins', amount: 5, actorId: 'actor.player' }]);
    expect(result.emissions.filter(row => row.effect.kind === 'fact').map(row => row.effect)).toEqual([{ kind: 'fact', name: 'blender.hall', actorId: 'blender.hall' }]);
    expect(after.emissions).toEqual([]); expect(host.quarantined).toBe(false);
    expect(f.shard.runtime).toBeNull(); expect(f.shard.terrain).toBeNull(); expect(f.shard.meshCollision?.panels).toHaveLength(1);
  } finally { await host.dispose(); }
}, 60_000);
