import { expect, test } from 'vitest';
import { CHECKPOINT_TICKS, clientCheckpointCadence } from './clientState';

/** a client's checkpoint ports over a fake clock: the player's input count and position, coins, progress and a portal */
function rig() {
  const state = { activity: 0, x: 0, y: 0, z: 0, unsaved: false, blocked: false, progress: 1, writes: [] as number[], tick: 0 };
  const cadence = clientCheckpointCadence({ blocked: () => state.blocked, unsaved: () => state.unsaved, activity: () => state.activity,
    position: () => ({ x: state.x, y: state.y, z: state.z }),
    mark: () => state.unsaved ? undefined : String(state.progress), write: () => { state.writes.push(state.tick); return true; } });
  const run = (ticks: number, each?: (tick: number) => void): void => {
    for (let i = 0; i < ticks; i++) { state.tick++; each?.(state.tick); cadence.step(state.tick); }
  };
  return { state, cadence, run };
}

test('G816: an idle player writes nothing, however long the page stays open', () => {
  const { state, run } = rig();
  // the shard's own script state changes every tick (the Template's door witness): idle still skips
  run(CHECKPOINT_TICKS * 20, () => { state.progress++; });
  expect(state.writes).toEqual([]);
});

test('G816: a playing player is checkpointed every 30 s, never in between', () => {
  const { state, run } = rig();
  run(CHECKPOINT_TICKS * 4, tick => { state.x = tick * 0.05; state.progress++; });
  expect(state.writes).toEqual([1, 2, 3, 4].map(n => n * CHECKPOINT_TICKS));
  // input alone (a look, a press) is activity too: a still player who only looked around while the world moved is written
  run(CHECKPOINT_TICKS - 1, tick => { state.progress++; if (tick % 600 === 0) state.activity++; });
  run(1);
  expect(state.writes.at(-1)).toBe(5 * CHECKPOINT_TICKS);
  // then idle again: nothing more
  run(CHECKPOINT_TICKS * 3);
  expect(state.writes).toHaveLength(5);
});

test('G816: unsaved coins or a ledger fact are written at the next 30 s step even while idle; a portal holds the step', () => {
  const { state, run } = rig();
  run(CHECKPOINT_TICKS); expect(state.writes).toEqual([]);
  state.unsaved = true; state.blocked = true;
  run(CHECKPOINT_TICKS); expect(state.writes).toEqual([]);
  state.blocked = false;
  run(CHECKPOINT_TICKS); expect(state.writes).toEqual([3 * CHECKPOINT_TICKS]);
});

test('G816: an active player whose progress matches the last periodic write is skipped (only the clock moved)', () => {
  const { state, run } = rig();
  run(CHECKPOINT_TICKS, tick => { state.activity = tick; });
  run(CHECKPOINT_TICKS * 2, tick => { state.activity = tick; });
  expect(state.writes).toEqual([CHECKPOINT_TICKS]);
  state.progress++;
  run(CHECKPOINT_TICKS, tick => { state.activity = tick; });
  expect(state.writes).toEqual([CHECKPOINT_TICKS, 4 * CHECKPOINT_TICKS]);
});

test('G816: the lifecycle saves (pagehide, hidden, dispose, a crossing) always write, idle or not, and reset the marks', () => {
  const { state, cadence, run } = rig();
  run(10);
  expect(cadence.now()).toBe(true);
  expect(cadence.now()).toBe(true);
  expect(state.writes).toEqual([10, 10]);
  // after a lifecycle write the same progress, moved, is written again at the next step (the mark was cleared)
  run(CHECKPOINT_TICKS - 10, tick => { state.x = tick; });
  expect(state.writes).toEqual([10, 10, CHECKPOINT_TICKS]);
});
