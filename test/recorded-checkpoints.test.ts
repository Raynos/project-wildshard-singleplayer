import { expect, test } from 'vitest';
import { recordedCheckpoints } from './fixtures/headless/recordedCheckpoints';
import type { HeadlessCommand } from '../src/sdk/tickProtocol';

test('the real recorder advances only after its preceding checkpoint is offered', async () => {
  const stepped: number[] = [], flags: string[] = [];
  const recording = recordedCheckpoints(async (tick, mark) => {
    const command: HeadlessCommand = { kind: 'script', actorId: 'first', value: 1 };
    tick([command]); command.value = 9; flags.push('earned:first'); await mark('first');
    tick([{ kind: 'script', actorId: 'second', value: 2 }]); flags.push('earned:second'); await mark('second');
  }, commands => { stepped.push(commands.length); }, () => flags);
  try {
    const first = await recording.parts.next(); expect(first.value).toMatchObject({ id: 'first', ticks: 1 });
    if (first.done) throw new Error('Missing first recorded part');
    expect(first.value.frames?.[0]?.[0]).toMatchObject({ value: 1 });
    expect(recording.ticks()).toBe(1); expect(stepped).toEqual([1]);
    expect(recording.marks[0]?.flags).toEqual(['earned:first']);
    const second = await recording.parts.next(); expect(second.value).toMatchObject({ id: 'second', ticks: 1 });
    expect(recording.ticks()).toBe(2); expect(recording.marks[1]?.flags).toEqual(['earned:first', 'earned:second']);
    expect((await recording.parts.next()).done).toBe(true);
  } finally { await recording.stop(); }
});

test('a native refusal after an earlier part reaches the consumer and settles', async () => {
  let steps = 0;
  const recording = recordedCheckpoints(async (tick, mark) => {
    tick([]); await mark('first'); throw new Error('Later native refusal');
  }, () => { steps++; }, () => []);
  expect((await recording.parts.next()).done).toBe(false);
  await expect(recording.parts.next()).rejects.toThrow('Later native refusal');
  await recording.stop(); expect(steps).toBe(1);
});

test('returning or failing a streamed owner settles a paused recorder without later steps', async () => {
  let steps = 0, ended = false;
  const recording = recordedCheckpoints(async (tick, mark) => {
    try { tick([]); await mark('first'); tick([]); }
    finally { ended = true; }
  }, () => { steps++; }, () => []);
  await recording.parts.next(); await recording.parts.return(undefined);
  expect(steps).toBe(1); expect(ended).toBe(true);
  await recording.stop();
  const failed = recordedCheckpoints(() => Promise.reject(new Error('Native refusal')), () => { steps++; }, () => []);
  await expect(failed.parts.next()).rejects.toThrow('Native refusal'); await failed.stop();
  expect(steps).toBe(1);
});

test('long recorded fences retain the existing part and total-command bounds', async () => {
  let steps = 0;
  const recording = recordedCheckpoints(async (tick, mark) => {
    for (let i = 0; i < 36_001; i++) tick([]);
    await mark('long');
  }, () => { steps++; }, () => []);
  const parts = [];
  for await (const part of recording.parts) parts.push(part);
  expect(parts.map(part => part.ticks)).toEqual([18_000, 18_000, 1]);
  expect(parts.flatMap(part => part.frames ?? []).length).toBe(steps);
  expect(recording.ticks()).toBe(36_001);
  const exceeded = recordedCheckpoints(tick => { for (let i = 0; i <= 60_000; i++) tick([]); return Promise.resolve(); }, () => { steps++; }, () => []);
  await expect(exceeded.parts.next()).rejects.toThrow('tape allowance'); await exceeded.stop();
});
