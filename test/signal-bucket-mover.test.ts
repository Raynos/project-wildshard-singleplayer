import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { createMoverHost, MoverRuntime } from '../src/game/plugin/mover';
import { SIGNAL_BUCKET_MOVERS, SIGNAL_BUCKET_CHANNELS } from '../src/shards/sunscar-dunes/generators/bucket';
import signalFlags from '../src/shards/sunscar-dunes/data/flags.generated.json' with { type: 'json' };

const { FLAG } = signalFlags;

async function bucket(flags: ReadonlySet<string>) {
  const scope = new Scope('signal-bucket'), host = await createMoverHost(SIGNAL_BUCKET_MOVERS, new Map(), () => []);
  const mover = new MoverRuntime(SIGNAL_BUCKET_MOVERS, { host, scope, restoreFlags: flags,
    physics: () => { throw new Error('Cosmetic bucket must allocate no physics body'); } });
  return { scope, host, mover };
}

test('Signal bucket has one admitted native clock and oil restores its endpoint without commands or effects', async () => {
  const row = SIGNAL_BUCKET_MOVERS[0]; if (row === undefined) throw new Error('Missing Signal bucket');
  const live = await bucket(new Set()), loaded = await bucket(new Set([FLAG.oil]));
  try {
    expect(row.kind).toBe('channel'); expect(row.execution).toBe('native');
    expect(SIGNAL_BUCKET_CHANNELS[0]?.reads).toEqual(['position.y', 'field.5']);
    expect(loaded.host.checkpoint().tick).toBe(-1); expect(loaded.mover.atEnd(row.id)).toBe(true);
    expect(loaded.mover.pose(row.id).position.y).toBe(1.35); expect(loaded.mover.drainEndEvents()).toEqual([]);
    expect(loaded.mover.snapshotBodies()).toEqual([]);
    live.mover.command(row.id, 1);
    for (let tick = 1; tick <= 73; tick++) { live.host.beginTick(tick); live.mover.step(tick); }
    expect(live.mover.pose(row.id).position).toEqual(loaded.mover.pose(row.id).position);
    expect(live.mover.pose(row.id).enabled).toBe(loaded.mover.pose(row.id).enabled);
    expect(live.mover.drainEndEvents()).toEqual([{ mover: row.id, atEnd: true }]);
    loaded.host.beginTick(1); loaded.mover.step(1); expect(loaded.mover.drainEndEvents()).toEqual([]);
  } finally { live.scope.dispose(); loaded.scope.dispose(); }
});
