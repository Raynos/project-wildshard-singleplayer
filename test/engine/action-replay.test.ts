import { expect, it } from 'vitest';
import { InputService, type ActionCommand } from '../../src/engine/input/InputService';
import { GameClock } from '../../src/engine/core/clock';
import { Rng, RngService, fnv1a32 } from '../../src/engine/core/rng';
import { Scope } from '../../src/engine/app/scope';

function fixture() {
  const clock = new GameClock(), rng = new RngService(435), input = new InputService(() => clock.now * 1000), scope = new Scope('action-session');
  const state = { mounted: false, chest: 0, coins: 0, swaps: 0, released: 0, derived: 0 };
  input.register({ id: 'onFoot', actions: ['use', 'ride.whistle', 'swap', 'attack'], keys: { use: ['KeyE'], 'ride.whistle': ['KeyF'] } }, scope);
  input.push('onFoot', scope);
  input.bind('use', () => { state.chest++; state.coins += rng.stream('gameplay').int(1, 10); input.press('confirm'); }, scope);
  input.bind('confirm', () => { state.derived++; }, scope);
  input.bind('ride.whistle', () => { state.mounted = !state.mounted; }, scope);
  input.bind('swap', () => { state.swaps++; }, scope);
  input.bindRelease('attack', () => { state.released++; }, scope);
  const hash = () => fnv1a32(JSON.stringify({ state, input: input.snapshot(), rng: rng.snapshot(), clock: clock.snapshot() }));
  return { clock, rng, input, scope, state, hash };
}

it('records and replays interact, mount, held releases and UI selection through the same action boundary', () => {
  const original = fixture(), replay = fixture(), recording: ActionCommand[] = [];
  try {
    original.input.recordCommand = (command) => { recording.push(command); };
    const sessions: ActionCommand[] = [
      { kind: 'physical', code: 'KeyE', on: true, at: 0 }, { kind: 'physical', code: 'KeyE', on: false, at: 16 },
      { kind: 'press', action: 'ride.whistle', at: 32 }, { kind: 'held', action: 'attack', on: true, at: 48 },
      { kind: 'axis', action: 'move', x: 0.2, y: 1, at: 64 }, { kind: 'press', action: 'swap', at: 80 },
      { kind: 'held', action: 'attack', on: false, at: 96 }, { kind: 'press', action: 'ride.whistle', at: 112 },
      { kind: 'press', action: 'use', at: 128 },
    ];
    for (const command of sessions) { original.clock.tick(command.at / 1000 - original.clock.now); original.input.executeCommand(command); }
    expect(recording).toHaveLength(sessions.length); // derived confirm is reproduced by the use handler, once
    expect(original.state).toMatchObject({ chest: 2, derived: 2, mounted: false, swaps: 1, released: 1 });
    for (const command of recording) { replay.clock.tick(command.at / 1000 - replay.clock.now); replay.input.executeCommand(command); }
    expect(replay.hash()).toBe(original.hash());
  } finally { original.scope.dispose(); replay.scope.dispose(); }
});

it('restores buffered input and clock/RNG state into a fresh session before replaying interactions', () => {
  const original = fixture(), replay = fixture();
  try {
    original.input.setHeld('attack', true); original.input.queue('use'); original.clock.tick(0.06);
    original.rng.stream('ai').next(); original.rng.stream('cosmetic').next();
    const inputState = original.input.snapshot(), rngState = original.rng.snapshot(), clockState = original.clock.snapshot();
    replay.input.restore(inputState); replay.rng.restore(rngState); replay.clock.restore(clockState);
    expect(replay.input.held('attack')).toBe(true); expect(replay.input.pressed('use')).toBe(true);
    for (const f of [original, replay]) { f.input.press('use'); f.input.setHeld('attack', false); f.clock.tick(1 / 60); }
    expect(replay.hash()).toBe(original.hash());
    expect(replay.rng.stream('spawn').next()).toBe(original.rng.stream('spawn').next());
  } finally { original.scope.dispose(); replay.scope.dispose(); }
});

it('restores scrambled RNG forks and named stream references without consuming extra draws', () => {
  const original = Rng.scrambled(123); original.next(); const state = original.snapshot(), replay = new Rng(999); replay.restore(state);
  expect(replay.fork('named').next()).toBe(original.fork('named').next());
  expect(replay.fork(8).next()).toBe(original.fork(8).next()); expect(replay.next()).toBe(original.next());
  const streams = new RngService(4), ref = streams.stream('ai'); ref.next(); const checkpoint = streams.snapshot();
  const expected = ref.next(); streams.seed(999); streams.restore(checkpoint); expect(streams.stream('ai').next()).toBe(expected);
  const retained = streams.stream('ai'), saved = streams.snapshot(); retained.next(); streams.restore(saved);
  expect(streams.stream('ai')).toBe(retained);
});

it('rejects invalid snapshots atomically and preserves pause/capture/scale state', () => {
  const clock = new GameClock(); clock.setCapture(30); clock.timeScale = 0.5; clock.tick(10); clock.paused = true;
  const saved = clock.snapshot(), replay = new GameClock(); replay.restore(saved); replay.tick(99); clock.tick(0);
  expect(replay.snapshot()).toEqual(clock.snapshot());
  const before = clock.snapshot(); expect(() => clock.restore({ ...before, wall: Number.NaN })).toThrow('Invalid'); expect(clock.snapshot()).toEqual(before);
  const rng = new RngService(7), state = rng.snapshot();
  expect(() => rng.restore({ ...state, seed: -1 })).toThrow('Invalid'); expect(rng.snapshot()).toEqual(state);
  const f = fixture();
  try { const inputState = f.input.snapshot(); expect(() => f.input.restore({ ...inputState, contexts: ['missing'] })).toThrow('Invalid'); expect(f.input.snapshot()).toEqual(inputState); }
  finally { f.scope.dispose(); }
});
